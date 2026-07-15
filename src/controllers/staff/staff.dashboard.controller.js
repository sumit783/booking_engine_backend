import { prisma } from "../../config/db.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET /api/v1/staff/dashboard ─────────────────────────────────────────────
export const getStaffDashboard = asyncHandler(async (req, res) => {
  const staff = req.user;
  
  if (staff.role !== "staff" || !staff.ownerId) {
    return res.status(403).json(new ApiResponse(403, "Forbidden: Invalid staff account"));
  }

  // Find all properties assigned to the staff's owner
  const properties = await prisma.property.findMany({
    where: { userId: staff.ownerId, isDeleted: false, status: "APPROVED" },
    select: { id: true, propertyName: true }
  });

  const propertyIds = properties.map(p => p.id);

  if (propertyIds.length === 0) {
    return res.status(200).json(new ApiResponse(200, "Dashboard retrieved", {
      stats: { todayCheckins: 0, todayCheckouts: 0, inHouse: 0, todayBookings: 0 },
      recentCheckins: [],
      properties: []
    }));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Stats: Check-ins today, Check-outs today, Current In-House, Bookings created today
  const [
    todayCheckins,
    todayCheckouts,
    inHouse,
    todayBookings,
    recentCheckins
  ] = await Promise.all([
    // Check-ins expected or done today
    prisma.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkInDate: { gte: today, lt: tomorrow },
        status: { not: "CANCELLED" }
      }
    }),
    // Check-outs expected or done today
    prisma.booking.count({
      where: {
        propertyId: { in: propertyIds },
        checkOutDate: { gte: today, lt: tomorrow },
        status: { not: "CANCELLED" }
      }
    }),
    // Guests currently in-house (checked-in)
    prisma.booking.count({
      where: {
        propertyId: { in: propertyIds },
        status: "CHECKED_IN"
      }
    }),
    // Bookings created today
    prisma.booking.count({
      where: {
        propertyId: { in: propertyIds },
        createdAt: { gte: today }
      }
    }),
    // Recent pending check-ins for today
    prisma.booking.findMany({
      where: {
        propertyId: { in: propertyIds },
        checkInDate: { gte: today, lt: tomorrow },
        status: "CONFIRMED" // Not checked in yet
      },
      take: 5,
      orderBy: { createdAt: "asc" },
      include: {
        property: { select: { propertyName: true } }
      }
    })
  ]);

  res.status(200).json(
    new ApiResponse(200, "Staff dashboard retrieved", {
      stats: {
        todayCheckins,
        todayCheckouts,
        inHouse,
        todayBookings
      },
      recentCheckins,
      properties
    })
  );
});
