import { PrismaClient } from "@prisma/client";
import { 
  connectOwner, 
  disconnectOwner, 
  getSessionStatus, 
  sendWhatsAppMessage 
} from "../../services/whatsapp.service.js";

const prisma = new PrismaClient();

export const connectWhatsApp = async (req, res) => {
  try {
    const ownerId = req.user.id;
    await connectOwner(ownerId);
    
    return res.status(200).json({
      success: true,
      message: "WhatsApp connection initialization started",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getWhatsAppStatus = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const state = getSessionStatus(ownerId);
    
    return res.status(200).json({
      success: true,
      data: state,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const disconnectWhatsApp = async (req, res) => {
  try {
    const ownerId = req.user.id;
    await disconnectOwner(ownerId);
    
    return res.status(200).json({
      success: true,
      message: "WhatsApp disconnected successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const sendWhatsAppNotification = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { bookingId, templateName } = req.body;

    if (!bookingId || !templateName) {
      return res.status(400).json({ success: false, message: "bookingId and templateName are required" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: {
        property: true,
        room: true,
        package: true,
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Security check: ensure this booking belongs to a property owned by req.user.id
    if (booking.property.userId !== ownerId) {
      return res.status(403).json({ success: false, message: "Unauthorized access to this booking" });
    }

    const checkIn = new Date(booking.checkInDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const checkOut = new Date(booking.checkOutDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    
    let text = "";
    
    if (templateName === "booking_confirmation") {
      const roomName = booking.room ? booking.room.name : "Selected Accomodation";
      text = `Hello ${booking.guestName},\n\nYour booking for ${roomName} has been confirmed.\n\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\n\nThank you for choosing ${booking.property.propertyName}.`;
    } else if (templateName === "package_confirmation") {
      const packageName = booking.package ? booking.package.name : "Selected Package";
      text = `Hello ${booking.guestName},\n\nYour package booking for ${packageName} has been confirmed.\n\nThank you for choosing ${booking.property.propertyName}.`;
    } else if (templateName === "checkin_reminder") {
      text = `Hello ${booking.guestName},\n\nThis is a reminder that your check-in is tomorrow.\n\nWe look forward to welcoming you at ${booking.property.propertyName}.`;
    } else if (templateName === "checkout_review") {
      const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
      const reviewUrl = `${FRONTEND_URL}/review/${booking.property.propertySlug}/${booking.bookingRef}`;
      text = `Hello ${booking.guestName},\n\nThank you for choosing ${booking.property.propertyName} for your stay. We hope you had a wonderful time.\n\nWe'd love to hear about your experience! Please take a moment to leave a review:\n${reviewUrl}\n\nYour feedback means a lot to us. Thank you!`;
    } else {
      return res.status(400).json({ success: false, message: "Unsupported template type" });
    }

    if (!booking.guestPhone) {
      return res.status(400).json({ success: false, message: "Guest phone number is missing from this booking" });
    }

    await sendWhatsAppMessage(ownerId, booking.guestPhone, text);

    return res.status(200).json({
      success: true,
      message: "WhatsApp message sent successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
