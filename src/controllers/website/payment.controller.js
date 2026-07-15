import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { sendTicketEmail, sendTicketWhatsApp } from "../../services/ticket.service.js";

const prisma = new PrismaClient();

// In a real scenario, use process.env.RAZORPAY_KEY_SECRET
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || "dummy_secret";

/**
 * Verify Razorpay payment signature
 */
export const verifyPayment = async (req, res) => {
  try {
    const { slug } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing Razorpay parameters" });
    }

    // Find the booking to verify it exists
    const booking = await prisma.booking.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
      include: {
        property: true,   // userId is a scalar field on property, no nested include needed
        room: true,
        package: true,
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found for this order" });
    }

    if (booking.property.propertySlug !== slug) {
      return res.status(400).json({ success: false, message: "Property mismatch" });
    }

    // Verify Signature
    // Format: hmac_sha256(razorpay_order_id + "|" + razorpay_payment_id, secret)
    const bodyText = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_SECRET)
      .update(bodyText.toString())
      .digest("hex");

    // In a production environment, if you are using test keys or dummy keys, 
    // the signature will not match unless we actually made a request to razorpay. 
    // For local dev without real keys, we might bypass or just log warning, but let's implement strict check:
    let isAuthentic = expectedSignature === razorpay_signature;
    
    // Developer bypass if dummy secret is used (for seamless local testing without real Razorpay account)
    if (RAZORPAY_SECRET === "dummy_secret" && razorpay_signature === "dummy_signature") {
      isAuthentic = true; 
    }

    if (isAuthentic) {
      // Calculate commission rate based on priority overrides
      const globalSetting = await prisma.systemSetting.findUnique({
        where: { key: "global_commission_rate" }
      });
      const globalRate = globalSetting ? parseFloat(globalSetting.value) : 10.00;

      let appliedRate = globalRate;
      if (booking.package && booking.package.commissionRate !== null) {
        appliedRate = parseFloat(booking.package.commissionRate);
      } else if (booking.room && booking.room.commissionRate !== null) {
        appliedRate = parseFloat(booking.room.commissionRate);
      } else if (booking.property && booking.property.commissionRate !== null) {
        appliedRate = parseFloat(booking.property.commissionRate);
      }

      const commissionAmount = (Number(booking.totalAmount) * appliedRate) / 100;

      // Update booking status and commission
      const updatedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          commissionRate: appliedRate,
          commissionAmount: commissionAmount,
        }
      });

      // Credit owner's wallet: owner earns (totalAmount - commissionAmount)
      // Note: Property model stores owner as `userId`, not `ownerId`
      const ownerId = booking.property.userId;
      const ownerEarnings = parseFloat((Number(booking.totalAmount) - Number(commissionAmount)).toFixed(2));

      await prisma.$transaction(async (tx) => {
        // Upsert wallet (create if first time)
        const wallet = await tx.wallet.upsert({
          where: { userId: ownerId },
          update: { balance: { increment: ownerEarnings } },
          create: { userId: ownerId, balance: ownerEarnings },
        });

        // Record transaction
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: ownerEarnings,
            type: "BOOKING_EARNING",
            bookingId: booking.id,
            description: `Booking ${booking.bookingRef} confirmed — ₹${ownerEarnings} credited (after ${appliedRate}% platform commission)`,
          }
        });
      });

      // Send Ticket Email & WhatsApp asynchronously
      sendTicketEmail(booking.id).catch((err) => {
        console.error("Error sending ticket email asynchronously:", err);
      });
      sendTicketWhatsApp(booking.id).catch((err) => {
        console.error("Error sending ticket WhatsApp asynchronously:", err);
      });

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: { bookingRef: booking.bookingRef }
      });
    } else {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: "FAILED" }
      });
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
