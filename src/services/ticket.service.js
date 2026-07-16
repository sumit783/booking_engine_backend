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
    width: 140,
    color: { dark: "#0f172a", light: "#ffffff" }
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: "A4", 
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      bufferPages: true
    });
    
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Color Palette
    const primaryBrand = "#0f172a"; // Slate 900
    const primaryLight = "#1e293b"; // Slate 800
    const accent = "#38bdf8"; // Sky 400
    const textDark = "#1e293b"; 
    const textMuted = "#64748b"; // Slate 500
    const bgLight = "#f8fafc"; // Slate 50
    const border = "#e2e8f0"; // Slate 200
    
    // Status Colors
    const successBg = "#dcfce7";
    const successText = "#166534";
    const pendingBg = "#fef9c3";
    const pendingText = "#854d0e";

    // 1. Header Banner
    doc.rect(0, 0, 595, 120).fill(primaryBrand);
    
    doc.fillColor("#ffffff")
       .fontSize(28)
       .font("Helvetica-Bold")
       .text(booking.property.propertyName.toUpperCase(), 50, 40, { align: "left" });
    
    doc.fillColor(accent)
       .fontSize(12)
       .font("Helvetica-Bold")
       .text("BOOKING CONFIRMATION TICKET", 50, 75, { align: "left", letterSpacing: 2 });

    // 2. Main Content Area (Background)
    doc.rect(0, 120, 595, 722).fill("#ffffff");

    // Helper: Draw a Badge
    const drawBadge = (x, y, text, statusStr) => {
      const isSuccess = statusStr === "CONFIRMED" || statusStr === "PAID";
      const bgColor = isSuccess ? successBg : pendingBg;
      const textColor = isSuccess ? successText : pendingText;
      
      doc.rect(x, y, 90, 24).fill(bgColor);
      doc.fillColor(textColor)
         .fontSize(9)
         .font("Helvetica-Bold")
         .text(text.toUpperCase(), x, y + 7, { width: 90, align: "center" });
    };

    // 3. Two-Column Layout
    // LEFT COLUMN: Guest & Reservation Info
    doc.roundedRect(50, 150, 320, 220, 8).lineWidth(1).stroke(border);
    doc.rect(50, 150, 320, 40).fill(bgLight);
    doc.fillColor(textDark).fontSize(12).font("Helvetica-Bold").text("RESERVATION SUMMARY", 70, 164);
    
    // Border for the header of the card
    doc.moveTo(50, 190).lineTo(370, 190).stroke(border);

    // Reservation Details inside left card
    let yPos = 210;
    const drawRow = (label, value) => {
      doc.fillColor(textMuted).fontSize(10).font("Helvetica").text(label, 70, yPos);
      doc.fillColor(textDark).fontSize(10).font("Helvetica-Bold").text(value, 160, yPos);
      yPos += 22;
    };

    drawRow("Reference ID:", booking.bookingRef);
    drawRow("Guest Name:", booking.guestName);
    drawRow("Phone:", booking.guestPhone);
    if (booking.guestEmail) drawRow("Email:", booking.guestEmail);
    
    // Status Badges inside left card
    yPos += 5;
    doc.fillColor(textMuted).fontSize(10).font("Helvetica").text("Status:", 70, yPos + 6);
    drawBadge(160, yPos, booking.status, booking.status);
    
    yPos += 35;
    doc.fillColor(textMuted).fontSize(10).font("Helvetica").text("Payment:", 70, yPos + 6);
    drawBadge(160, yPos, booking.paymentStatus, booking.paymentStatus);

    // RIGHT COLUMN: QR Code Card
    doc.roundedRect(390, 150, 155, 220, 8).lineWidth(1).stroke(border);
    doc.image(qrBuffer, 397, 165, { width: 140 });
    
    doc.fillColor(textMuted)
       .fontSize(9)
       .font("Helvetica-Bold")
       .text("SCAN AT CHECK-IN", 390, 335, { width: 155, align: "center", letterSpacing: 1 });

    // 4. Stay Details Table
    doc.roundedRect(50, 400, 495, 180, 8).lineWidth(1).stroke(border);
    
    // Table Header
    doc.rect(50, 400, 495, 35).fill(primaryLight);
    doc.fillColor("#ffffff")
       .fontSize(10)
       .font("Helvetica-Bold")
       .text("Accommodation", 70, 412)
       .text("Check-In", 240, 412)
       .text("Check-Out", 340, 412)
       .text("Guests", 440, 412);

    // Table Content
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

    doc.fillColor(textDark)
       .fontSize(10)
       .font("Helvetica-Bold")
       .text(description, 70, 455, { width: 150 })
       .font("Helvetica")
       .text(checkIn, 240, 455)
       .text(checkOut, 340, 455)
       .text(String(booking.guests), 440, 455);
       
    let roomNumberText = "";
    if (booking.assignedRoomNumbers && Array.isArray(booking.assignedRoomNumbers) && booking.assignedRoomNumbers.length > 0) {
      roomNumberText = `Room No(s): ${booking.assignedRoomNumbers.join(", ")}`;
      doc.fillColor(accent).font("Helvetica-Bold").text(roomNumberText, 70, 485, { width: 150 });
    }

    // Divider Line above Total
    doc.moveTo(50, 530).lineTo(545, 530).stroke(border);
    
    // Total Section
    doc.rect(50, 530, 495, 50).fill(bgLight);
    doc.fillColor(textDark)
       .fontSize(14)
       .font("Helvetica-Bold")
       .text("TOTAL PAID", 70, 548);
       
    doc.fillColor(primaryBrand)
       .fontSize(16)
       .font("Helvetica-Bold")
       .text(`INR ${Number(booking.totalAmount).toLocaleString("en-IN")}`, 340, 546, { width: 185, align: "right" });

    // 5. Footer Footer Note
    doc.fillColor(textMuted)
       .fontSize(9)
       .font("Helvetica-Oblique")
       .text("Please present this ticket at the reception desk during check-in.", 50, 650, { align: "center", width: 495 })
       .text("Thank you for choosing us! Have a pleasant stay.", 50, 665, { align: "center", width: 495 });
       
    doc.moveTo(50, 690).lineTo(545, 690).stroke(border);
    doc.font("Helvetica").fontSize(8).text(`Generated on ${new Date().toLocaleString("en-IN")} • ${booking.bookingRef}`, 50, 700, { align: "center", width: 495 });

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

    let roomNumberText = "";
    if (booking.assignedRoomNumbers && Array.isArray(booking.assignedRoomNumbers) && booking.assignedRoomNumbers.length > 0) {
      roomNumberText = `\n*Room No(s):* ${booking.assignedRoomNumbers.join(", ")}`;
    }

    const text = `Hello *${booking.guestName}*,\n\nYour booking at *${booking.property.propertyName}* is confirmed! 🎉\n\n*Reference ID:* ${booking.bookingRef}\n*Accommodation:* ${description}${roomNumberText}\n*Check-in:* ${checkIn}\n*Check-out:* ${checkOut}\n*Total Paid:* INR ${Number(booking.totalAmount).toLocaleString("en-IN")}\n\nYou can download your PDF ticket here:\n${downloadUrl}\n\nThank you for choosing us!`;

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
