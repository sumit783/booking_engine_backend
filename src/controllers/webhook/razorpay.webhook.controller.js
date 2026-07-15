import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { sendTicketEmail, sendTicketWhatsApp } from "../../services/ticket.service.js";

const prisma = new PrismaClient();

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "dummy_webhook_secret";

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    
    // Webhook verification
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    let isAuthentic = expectedSignature === signature;
    if (RAZORPAY_WEBHOOK_SECRET === "dummy_webhook_secret" && signature === "dummy_signature") {
      isAuthentic = true; // allow bypass in dev
    }

    if (!isAuthentic) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const { event, payload } = req.body;

    if (event === "payment_link.paid") {
      const paymentLink = payload.payment_link.entity;
      const payment = payload.payment?.entity; // associated payment object if available

      // Reference ID is the booking reference
      const bookingRef = paymentLink.reference_id;
      if (!bookingRef) {
        return res.status(200).send("No reference_id found in payment link");
      }

      const booking = await prisma.booking.findFirst({
        where: { bookingRef: bookingRef },
        include: {
          property: true,
          room: true,
          package: true,
        }
      });

      if (!booking) {
        return res.status(200).send("Booking not found");
      }

      // If already paid, do nothing
      if (booking.paymentStatus === "PAID") {
        return res.status(200).send("Booking already paid");
      }

      // Calculate commission based on priority overrides
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
          razorpayPaymentId: payment ? payment.id : null,
          razorpaySignature: signature,
          commissionRate: appliedRate,
          commissionAmount: commissionAmount,
        }
      });

      // Credit owner's wallet: owner earns (totalAmount - commissionAmount)
      const ownerId = booking.property.userId;
      const ownerEarnings = parseFloat((Number(booking.totalAmount) - Number(commissionAmount)).toFixed(2));

      await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.upsert({
          where: { userId: ownerId },
          update: { balance: { increment: ownerEarnings } },
          create: { userId: ownerId, balance: ownerEarnings },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: ownerEarnings,
            type: "BOOKING_EARNING",
            bookingId: booking.id,
            description: `Payment Link for ${booking.bookingRef} paid — ₹${ownerEarnings} credited (after ${appliedRate}% platform commission)`,
          }
        });
      });

      // Send Ticket Email & WhatsApp asynchronously
      sendTicketEmail(booking.id).catch((err) => console.error("Error sending ticket email:", err));
      sendTicketWhatsApp(booking.id).catch((err) => console.error("Error sending ticket WhatsApp:", err));

      return res.status(200).json({ success: true, message: "Payment processed successfully" });
    }

    // Acknowledge other events
    return res.status(200).send("Event not handled");
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
