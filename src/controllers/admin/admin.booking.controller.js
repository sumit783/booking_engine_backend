import { prisma } from "../../config/db.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET /api/v1/admin/bookings ────────────────────────────────────────────────
export const getAdminBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, paymentStatus, propertyId, startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};

  if (status && status.toUpperCase() !== "ALL") {
    filter.status = status.toUpperCase();
  }

  if (paymentStatus && paymentStatus.toUpperCase() !== "ALL") {
    filter.paymentStatus = paymentStatus.toUpperCase();
  }

  if (propertyId) {
    filter.propertyId = Number(propertyId);
  }

  if (startDate && endDate) {
    filter.checkInDate = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  } else if (startDate) {
    filter.checkInDate = { gte: new Date(startDate) };
  } else if (endDate) {
    filter.checkInDate = { lte: new Date(endDate) };
  }

  if (search) {
    filter.OR = [
      { bookingRef: { contains: search } },
      { guestName: { contains: search } },
      { guestEmail: { contains: search } },
      { guestPhone: { contains: search } },
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: filter,
      include: {
        property: {
          select: {
            id: true,
            propertyName: true,
          }
        },
        room: {
          select: {
            id: true,
            name: true,
          }
        },
        package: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.booking.count({ where: filter }),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Admin bookings retrieved", {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      bookings,
    })
  );
});
