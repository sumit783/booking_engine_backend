import { PrismaClient } from "@prisma/client";
import { generateTicketPDF } from "../../services/ticket.service.js";

const prisma = new PrismaClient();

export const downloadTicket = async (req, res) => {
  try {
    const { bookingRef } = req.params;

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { bookingRef },
          { ticketId: bookingRef }
        ]
      },
      include: {
        property: true,
        room: true,
        package: true,
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const pdfBuffer = await generateTicketPDF(booking);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=ticket-${booking.bookingRef}.pdf`,
      "Content-Length": pdfBuffer.length,
    });

    return res.end(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
