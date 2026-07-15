import { prisma } from "../../config/db.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// Helper to get staff properties
const getStaffProperties = async (staff) => {
  if (staff.role !== "staff" || !staff.ownerId) return [];
  const props = await prisma.property.findMany({
    where: { userId: staff.ownerId, isDeleted: false, status: "APPROVED" },
    select: { id: true }
  });
  return props.map(p => p.id);
};

// ── GET /api/v1/staff/bookings/checkins ──────────────────────────────────────
export const getTodayCheckins = asyncHandler(async (req, res) => {
  const propertyIds = await getStaffProperties(req.user);
  if (!propertyIds.length) return res.status(200).json(new ApiResponse(200, "Success", { total: 0, bookings: [] }));

  const { page = 1, limit = 10, search, propertyId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filter = {
    propertyId: propertyId ? Number(propertyId) : { in: propertyIds },
    checkInDate: { gte: today, lt: tomorrow },
  };

  if (search) {
    filter.OR = [
      { guestName: { contains: search } },
      { bookingRef: { contains: search } },
      { guestPhone: { contains: search } }
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: filter,
      include: { property: { select: { propertyName: true } }, room: { select: { name: true } }, package: { select: { name: true } } },
      orderBy: { status: "asc" }, // CONFIRMED first, then CHECKED_IN
      skip,
      take: Number(limit)
    }),
    prisma.booking.count({ where: filter })
  ]);

  res.status(200).json(new ApiResponse(200, "Checkins retrieved", {
    total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)), bookings
  }));
});

// ── GET /api/v1/staff/bookings/checkouts ─────────────────────────────────────
export const getTodayCheckouts = asyncHandler(async (req, res) => {
  const propertyIds = await getStaffProperties(req.user);
  if (!propertyIds.length) return res.status(200).json(new ApiResponse(200, "Success", { total: 0, bookings: [] }));

  const { page = 1, limit = 10, search, propertyId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filter = {
    propertyId: propertyId ? Number(propertyId) : { in: propertyIds },
    checkOutDate: { gte: today, lt: tomorrow },
  };

  if (search) {
    filter.OR = [
      { guestName: { contains: search } },
      { bookingRef: { contains: search } },
      { guestPhone: { contains: search } }
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: filter,
      include: { property: { select: { propertyName: true } }, room: { select: { name: true } }, package: { select: { name: true } } },
      orderBy: { status: "asc" }, // CHECKED_IN first, then others
      skip,
      take: Number(limit)
    }),
    prisma.booking.count({ where: filter })
  ]);

  res.status(200).json(new ApiResponse(200, "Checkouts retrieved", {
    total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)), bookings
  }));
});

// ── GET /api/v1/staff/bookings/search ────────────────────────────────────────
export const searchBookings = asyncHandler(async (req, res) => {
  const propertyIds = await getStaffProperties(req.user);
  if (!propertyIds.length) return res.status(200).json(new ApiResponse(200, "Success", { total: 0, bookings: [] }));

  const { page = 1, limit = 10, search, status, propertyId, startDate, endDate } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = { propertyId: propertyId ? Number(propertyId) : { in: propertyIds } };

  if (status && status !== "ALL") filter.status = status;
  if (startDate && endDate) {
    filter.checkInDate = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  if (search) {
    filter.OR = [
      { guestName: { contains: search } },
      { bookingRef: { contains: search } },
      { ticketId: { contains: search } }, // For scanner
      { guestPhone: { contains: search } }
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: filter,
      include: { property: { select: { propertyName: true } }, room: { select: { name: true } }, package: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit)
    }),
    prisma.booking.count({ where: filter })
  ]);

  res.status(200).json(new ApiResponse(200, "Bookings retrieved", {
    total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)), bookings
  }));
});

// ── POST /api/v1/staff/bookings/:id/status ───────────────────────────────────
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const propertyIds = await getStaffProperties(req.user);

  const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
  if (!booking) return res.status(404).json(new ApiResponse(404, "Booking not found"));
  if (!propertyIds.includes(booking.propertyId)) {
    return res.status(403).json(new ApiResponse(403, "Access denied"));
  }

  const updated = await prisma.booking.update({
    where: { id: Number(id) },
    data: { status }
  });

  res.status(200).json(new ApiResponse(200, "Status updated", updated));
});
