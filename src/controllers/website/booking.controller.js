import { PrismaClient } from "@prisma/client";
import Razorpay from "razorpay";

const prisma = new PrismaClient();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "dummy_key_id";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "dummy_secret";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// Utility: check availability and calculate price
async function checkAvailabilityAndPrice(propertySlug, checkIn, checkOut, roomId, packageId, guests, roomCount = 1, extraPackages = []) {
  const property = await prisma.property.findUnique({
    where: { propertySlug },
    include: {
      rooms: roomId ? { where: { id: Number(roomId) } } : false,
      packages: packageId ? { where: { id: Number(packageId), isDeleted: false } } : false,
      extraPackages: extraPackages.length > 0 ? { where: { id: { in: extraPackages.map(e => e.id) }, isActive: true } } : false,
    },
  });

  if (!property) throw new Error("Property not found");

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    throw new Error("Invalid dates");
  }
  if (checkInDate >= checkOutDate) {
    throw new Error("Check-out must be after check-in");
  }

  const nights = Math.round((checkOutDate - checkInDate) / 86400000);
  let totalAmount = 0;
  let room = null;
  let pkg = null;
  let assignedRoomNumbers = null;

  // 1. Room Availability & Price
  if (roomId) {
    room = property.rooms[0];
    if (!room) throw new Error("Room not found");
    
    // Calculate overlapping bookings and fetch their assigned room numbers
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        roomId: room.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        OR: [
          { checkInDate: { lt: checkOutDate }, checkOutDate: { gt: checkInDate } }
        ]
      },
      select: { assignedRoomNumbers: true }
    });
    const overlappingCount = overlappingBookings.length;

    let occupiedRoomNumbers = new Set();
    overlappingBookings.forEach(b => {
      if (b.assignedRoomNumbers && Array.isArray(b.assignedRoomNumbers)) {
        b.assignedRoomNumbers.forEach(rn => occupiedRoomNumbers.add(rn));
      }
    });

    let availableRoomNumbers = [];
    if (room.roomNumbers && Array.isArray(room.roomNumbers)) {
      availableRoomNumbers = room.roomNumbers.filter(rn => !occupiedRoomNumbers.has(rn));
    }

    // Calculate overlapping blocks
    const overlappingBlocks = await prisma.roomBlock.count({
      where: {
        roomId: room.id,
        OR: [
          { startDate: { lt: checkOutDate }, endDate: { gt: checkInDate } }
        ]
      }
    });

    const unavailableUnits = overlappingCount + overlappingBlocks;
    if (unavailableUnits + (roomCount - 1) >= room.quantity) {
      throw new Error(`Not enough rooms available for these dates (Available: ${Math.max(0, room.quantity - unavailableUnits)})`);
    }

    // Assign room numbers using round robin (pick the first available N rooms)
    if (availableRoomNumbers.length > 0) {
      assignedRoomNumbers = availableRoomNumbers.slice(0, roomCount);
    }

    // Basic price calculation: basePrice * nights
    totalAmount += Number(room.basePrice) * nights * roomCount;
  }

  // 2. Package Price
  if (packageId) {
    pkg = property.packages[0];
    if (!pkg) throw new Error("Package not found");
    totalAmount += Number(pkg.price);
  }

  // 3. Extra Packages Price
  let extraPackagesTotal = 0;
  const extraPackagesSnapshot = [];
  
  if (extraPackages && extraPackages.length > 0) {
    for (const reqExtra of extraPackages) {
      const dbExtra = property.extraPackages.find(e => e.id === reqExtra.id);
      if (dbExtra) {
        const qty = Number(reqExtra.quantity) || 1;
        const cost = Number(dbExtra.price) * qty;
        extraPackagesTotal += cost;
        extraPackagesSnapshot.push({
          id: dbExtra.id,
          name: dbExtra.name,
          type: dbExtra.type,
          price: Number(dbExtra.price),
          quantity: qty,
          total: cost
        });
      }
    }
  }

  totalAmount += extraPackagesTotal;

  return { property, room, pkg, totalAmount, nights, extraPackagesSnapshot, extraPackagesTotal, assignedRoomNumbers };
}

export const calculatePrice = async (req, res) => {
  try {
    const { slug } = req.params;
    const { checkIn, checkOut, roomId, packageId, guests, roomCount = 1, extraPackages = [] } = req.body;

    const result = await checkAvailabilityAndPrice(slug, checkIn, checkOut, roomId, packageId, guests, roomCount, extraPackages);

    // Resolve commission rate using the same priority cascade as payment verification
    const globalSetting = await prisma.systemSetting.findUnique({
      where: { key: "global_commission_rate" }
    });
    const globalRate = globalSetting ? parseFloat(globalSetting.value) : 10.00;

    let appliedRate = globalRate;
    if (result.pkg && result.pkg.commissionRate !== null) {
      appliedRate = parseFloat(result.pkg.commissionRate);
    } else if (result.room && result.room.commissionRate !== null) {
      appliedRate = parseFloat(result.room.commissionRate);
    } else if (result.property && result.property.commissionRate !== null) {
      appliedRate = parseFloat(result.property.commissionRate);
    }

    const commissionAmount = parseFloat(((result.totalAmount * appliedRate) / 100).toFixed(2));
    const finalAmount = parseFloat((result.totalAmount + commissionAmount).toFixed(2));
    
    return res.status(200).json({
      success: true,
      data: {
        baseAmount: result.totalAmount - result.extraPackagesTotal,
        extraPackagesTotal: result.extraPackagesTotal,
        commissionRate: appliedRate,
        commissionAmount,
        totalAmount: finalAmount,  // Final amount user will pay (base + commission + extras)
        nights: result.nights,
        extraPackages: result.extraPackagesSnapshot
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const createBooking = async (req, res) => {
  try {
    const { slug } = req.params;
    const { checkIn, checkOut, roomId, packageId, guests, guestName, guestEmail, guestPhone, roomCount = 1, extraPackages = [] } = req.body;

    if (!guestName || !guestPhone) {
      return res.status(400).json({ success: false, message: "Guest name and phone are required" });
    }

    let { property, room, pkg, totalAmount, extraPackagesSnapshot, extraPackagesTotal, assignedRoomNumbers } = await checkAvailabilityAndPrice(
      slug, checkIn, checkOut, roomId, packageId, guests, roomCount, extraPackages
    );

    // Generate unique booking ref and ticketId
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `BK-${Date.now().toString().slice(-4)}${randomSuffix}`;
    const ticketId = `TK-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;

    // Resolve commission rate for this booking
    const globalSettingForBooking = await prisma.systemSetting.findUnique({
      where: { key: "global_commission_rate" }
    });
    const globalRateForBooking = globalSettingForBooking ? parseFloat(globalSettingForBooking.value) : 10.00;

    let appliedRateForBooking = globalRateForBooking;
    if (pkg && pkg.commissionRate !== null) {
      appliedRateForBooking = parseFloat(pkg.commissionRate);
    } else if (room && room.commissionRate !== null) {
      appliedRateForBooking = parseFloat(room.commissionRate);
    } else if (property.commissionRate !== null) {
      appliedRateForBooking = parseFloat(property.commissionRate);
    }

    const commissionAmountForBooking = parseFloat(((totalAmount * appliedRateForBooking) / 100).toFixed(2));
    // Final amount user pays = base room/package price + platform commission
    const finalAmountForBooking = parseFloat((totalAmount + commissionAmountForBooking).toFixed(2));

    // Create Razorpay Order
    let razorpayOrderId = null;
    if (finalAmountForBooking > 0) {
      try {
        const order = await razorpay.orders.create({
          amount: Math.round(finalAmountForBooking * 100), // amount in paise (base + commission)
          currency: "INR",
          receipt: bookingRef,
          payment_capture: 1, // Auto capture
        });
        razorpayOrderId = order.id;
      } catch (err) {
        // If razorpay fails, we can either throw or continue with PENDING.
        // Let's throw for now to avoid bookings without payment.
        if (RAZORPAY_KEY_ID !== "dummy_key_id") {
          throw new Error("Failed to initialize payment gateway: " + err.message);
        } else {
          // Fallback for dummy local dev
          razorpayOrderId = "order_dummy_" + Date.now();
        }
      }
    }

    const booking = await prisma.booking.create({
      data: {
        bookingRef,
        ticketId,
        propertyId: property.id,
        roomId: room ? room.id : null,
        packageId: pkg ? pkg.id : null,
        checkInDate: new Date(checkIn),
        checkOutDate: new Date(checkOut),
        guests: Number(guests) || 1,
        roomCount: Number(roomCount) || 1,
        guestName,
        guestEmail,
        guestPhone,
        totalAmount: finalAmountForBooking, // store final (base + commission + extras)
        extraPackages: extraPackagesSnapshot,
        extraPackagesTotal,
        assignedRoomNumbers: assignedRoomNumbers,
        commissionRate: appliedRateForBooking,
        commissionAmount: commissionAmountForBooking,
        status: "PENDING",
        paymentStatus: "PENDING",
        razorpayOrderId: razorpayOrderId,
      }
    });

    return res.status(201).json({
      success: true,
      message: "Booking initiated successfully",
      data: {
        bookingRef: booking.bookingRef,
        ticketId: booking.ticketId,
        baseAmount: totalAmount,
        commissionRate: appliedRateForBooking,
        commissionAmount: commissionAmountForBooking,
        totalAmount: booking.totalAmount, // Final charge (base + commission)
        razorpayOrderId: booking.razorpayOrderId,
        razorpayKeyId: RAZORPAY_KEY_ID,
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
