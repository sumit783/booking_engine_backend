import PDFDocument from "pdfkit";
import qrcode from "qrcode";
import transporter from "../config/mailer.js";
import { PrismaClient } from "@prisma/client";
import { sendWhatsAppMessage, getSessionStatus } from "./whatsapp.service.js";

const prisma = new PrismaClient();

/**
 * Helper to generate a PDF ticket buffer using pdfkit
 */
export const generateTicketPDF = async (booking) => {
  const qrBuffer = await qrcode.toBuffer(booking.ticketId || booking.bookingRef, {
    margin: 1,
    width: 120,
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: "A4", 
      margins: { top: 40, left: 50, right: 50, bottom: 40 }
    });
    
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Color Palette
    const primaryColor = "#0f172a"; // Slate 900
    const secondaryColor = "#475569"; // Slate 600
    const lightBg = "#f8fafc"; // Slate 50
    const borderColor = "#e2e8f0"; // Slate 200

    // Header / Title
    doc.fillColor(primaryColor)
       .fontSize(22)
       .font("Helvetica-Bold")
       .text(booking.property.propertyName.toUpperCase(), { align: "left" });
    
    doc.fontSize(10)
       .font("Helvetica")
       .fillColor(secondaryColor)
       .text("Booking Confirmation Ticket", { align: "left" });

    // Decorative line
    doc.moveTo(50, 90).lineTo(545, 90).strokeColor(borderColor).lineWidth(1).stroke();

    // QR Code Positioned on Right Side
    doc.image(qrBuffer, 425, 110, { width: 120 });

    // Booking Details Section
    doc.fillColor(primaryColor)
       .fontSize(12)
       .font("Helvetica-Bold")
       .text("RESERVATION DETAILS", 50, 110);

    doc.fontSize(10)
       .font("Helvetica")
       .fillColor(secondaryColor)
       .text(`Reference ID:`, 50, 135)
       .font("Helvetica-Bold")
       .fillColor(primaryColor)
       .text(booking.bookingRef, 140, 135);

    doc.font("Helvetica")
       .fillColor(secondaryColor)
       .text(`Status:`, 50, 155)
       .font("Helvetica-Bold")
       .fillColor("#059669") // Emerald 600
       .text(booking.status, 140, 155);

    doc.font("Helvetica")
       .fillColor(secondaryColor)
       .text(`Payment:`, 50, 175)
       .font("Helvetica-Bold")
       .fillColor("#059669")
       .text(booking.paymentStatus, 140, 175);

    // Guest Info Section
    doc.fillColor(primaryColor)
       .fontSize(12)
       .font("Helvetica-Bold")
       .text("GUEST DETAILS", 50, 215);

    doc.fontSize(10)
       .font("Helvetica")
       .fillColor(secondaryColor)
       .text(`Name:`, 50, 240)
       .font("Helvetica-Bold")
       .fillColor(primaryColor)
       .text(booking.guestName, 140, 240);

    doc.font("Helvetica")
       .fillColor(secondaryColor)
       .text(`Phone:`, 50, 260)
       .font("Helvetica-Bold")
       .fillColor(primaryColor)
       .text(booking.guestPhone, 140, 260);

    if (booking.guestEmail) {
      doc.font("Helvetica")
         .fillColor(secondaryColor)
         .text(`Email:`, 50, 280)
         .font("Helvetica-Bold")
         .fillColor(primaryColor)
         .text(booking.guestEmail, 140, 280);
    }

    // Accommodation Info Table
    doc.fillColor(primaryColor)
       .fontSize(12)
       .font("Helvetica-Bold")
       .text("STAY DETAILS", 50, 320);

    // Table Header Box
    doc.rect(50, 340, 495, 24).fill(lightBg);
    doc.fillColor(primaryColor)
       .fontSize(9)
       .font("Helvetica-Bold")
       .text("Description", 60, 348)
       .text("Check-In", 200, 348)
       .text("Check-Out", 320, 348)
       .text("Guests", 440, 348)
       .text("Total Paid", 500, 348);

    // Table Body
    const checkIn = new Date(booking.checkInDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const checkOut = new Date(booking.checkOutDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    
    let description = "Room & Package Booking";
    if (booking.room && booking.package) {
      description = `${booking.room.name} + ${booking.package.name}`;
    } else if (booking.room) {
      description = booking.room.name;
    } else if (booking.package) {
      description = booking.package.name;
    }

    doc.fillColor(secondaryColor)
       .font("Helvetica")
       .text(description, 60, 375, { width: 130 })
       .text(checkIn, 200, 375)
       .text(checkOut, 320, 375)
       .text(String(booking.guests), 440, 375)
       .font("Helvetica-Bold")
       .fillColor(primaryColor)
       .text(`INR ${Number(booking.totalAmount).toLocaleString("en-IN")}`, 490, 375);

    // Footer note
    doc.moveTo(50, 430).lineTo(545, 430).strokeColor(borderColor).lineWidth(1).stroke();
    
    doc.fillColor(secondaryColor)
       .fontSize(8)
       .font("Helvetica-Oblique")
       .text("Please present this ticket at the reception desk during check-in.", 50, 450, { align: "center" })
       .text("Thank you for your booking! Have a pleasant stay.", 50, 465, { align: "center" });

    doc.end();
  });
};

/**
 * Generates and sends ticket email to guest
 */
export const sendTicketEmail = async (bookingId) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: {
        property: true,
        room: true,
        package: true,
      }
    });

    if (!booking) {
      console.error(`Booking not found for ID: ${bookingId}`);
      return;
    }

    if (!booking.guestEmail) {
      console.log(`No email configured for booking reference ${booking.bookingRef}, skipping email ticket.`);
      return;
    }

    const pdfBuffer = await generateTicketPDF(booking);
    
    const checkIn = new Date(booking.checkInDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const checkOut = new Date(booking.checkOutDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    
    let description = "Stay Reservation";
    if (booking.room && booking.package) {
      description = `${booking.room.name} and ${booking.package.name}`;
    } else if (booking.room) {
      description = booking.room.name;
    } else if (booking.package) {
      description = booking.package.name;
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Booking Engine" <no-reply@bookingengine.com>',
      to: booking.guestEmail,
      subject: `Your Stay Ticket Confirmed - ${booking.property.propertyName} (${booking.bookingRef})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a;">Booking Confirmed!</h2>
          <p>Hello <strong>${booking.guestName}</strong>,</p>
          <p>Thank you for choosing <strong>${booking.property.propertyName}</strong>. Your stay has been successfully booked and confirmed.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Booking Reference</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${booking.bookingRef}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Accommodation</td>
              <td style="padding: 8px 0; text-align: right;">${description}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Check-In</td>
              <td style="padding: 8px 0; text-align: right;">${checkIn}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Check-Out</td>
              <td style="padding: 8px 0; text-align: right;">${checkOut}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; font-weight: bold; color: #475569;">Total Paid</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #059669;">INR ${Number(booking.totalAmount).toLocaleString("en-IN")}</td>
            </tr>
          </table>
          
          <p>We have attached your official PDF ticket containing the check-in QR Code. Please present this ticket upon check-in at the reception.</p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: center;">
            Need help? Contact us at ${booking.property.contactPhone || 'reception'} or reply to this email.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `ticket-${booking.bookingRef}.pdf`,
          content: pdfBuffer,
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`Ticket email sent successfully for ${booking.bookingRef} to ${booking.guestEmail}`);
  } catch (error) {
    console.error(`Failed to send ticket email for bookingId ${bookingId}:`, error);
  }
};

/**
 * Automatically sends booking confirmation ticket details to guest via WhatsApp
 */
export const sendTicketWhatsApp = async (bookingId) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: {
        property: true,
        room: true,
        package: true,
      }
    });

    if (!booking) {
      console.error(`Booking not found for WhatsApp ID: ${bookingId}`);
      return;
    }

    // Check if owner's whatsapp is connected
    const status = getSessionStatus(booking.property.userId);
    if (status?.status !== "Connected") {
      console.log(`WhatsApp not connected for owner ${booking.property.userId}, skipping WhatsApp ticket.`);
      return;
    }

    const checkIn = new Date(booking.checkInDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const checkOut = new Date(booking.checkOutDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    
    let description = "Stay Reservation";
    if (booking.room && booking.package) {
      description = `${booking.room.name} and ${booking.package.name}`;
    } else if (booking.room) {
      description = booking.room.name;
    } else if (booking.package) {
      description = booking.package.name;
    }

    const downloadUrl = `http://localhost:5000/api/v1/website/${booking.property.propertySlug}/bookings/${booking.bookingRef}/ticket`;

    const text = `Hello *${booking.guestName}*,\n\nYour booking at *${booking.property.propertyName}* is confirmed! 🎉\n\n*Reference ID:* ${booking.bookingRef}\n*Accommodation:* ${description}\n*Check-in:* ${checkIn}\n*Check-out:* ${checkOut}\n*Total Paid:* INR ${Number(booking.totalAmount).toLocaleString("en-IN")}\n\nYou can download your PDF ticket here:\n${downloadUrl}\n\nThank you for choosing us!`;

    // Generate QR Code image buffer to send to WhatsApp using ticketId
    const qrBuffer = await qrcode.toBuffer(booking.ticketId || booking.bookingRef, {
      margin: 1,
      width: 300,
    });

    await sendWhatsAppMessage(booking.property.userId, booking.guestPhone, text, { image: qrBuffer });
    console.log(`Ticket WhatsApp with QR sent successfully for ${booking.bookingRef} to ${booking.guestPhone}`);
  } catch (error) {
    console.error(`Failed to send ticket WhatsApp for bookingId ${bookingId}:`, error);
  }
};
