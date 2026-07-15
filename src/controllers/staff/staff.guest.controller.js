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

// ── GET /api/v1/staff/guests ─────────────────────────────────────────────────
export const getStaffGuests = asyncHandler(async (req, res) => {
  const propertyIds = await getStaffProperties(req.user);
  if (!propertyIds.length) return res.status(200).json(new ApiResponse(200, "Success", { total: 0, guests: [] }));

  const { page = 1, limit = 10, search, propertyId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const filterPropertyIds = propertyId ? [Number(propertyId)] : propertyIds;

  // We find distinct guests by email or phone from bookings
  // Since we don't have a distinct Guest model, we aggregate from bookings
  
  const searchFilter = search ? `AND (guestName LIKE '%${search}%' OR guestEmail LIKE '%${search}%' OR guestPhone LIKE '%${search}%')` : "";
  const propFilter = `propertyId IN (${filterPropertyIds.join(",")})`;

  // Use raw query for DISTINCT since prisma doesn't support complex distinct pagination easily with counts
  const countQuery = await prisma.$queryRawUnsafe(`
    SELECT COUNT(DISTINCT guestPhone) as total 
    FROM Booking 
    WHERE ${propFilter} ${searchFilter}
  `);

  const total = Number(countQuery[0].total);

  const guestsRaw = await prisma.$queryRawUnsafe(`
    SELECT guestName, guestEmail, guestPhone, MAX(createdAt) as lastVisit, COUNT(id) as totalBookings
    FROM Booking
    WHERE ${propFilter} ${searchFilter}
    GROUP BY guestPhone, guestName, guestEmail
    ORDER BY lastVisit DESC
    LIMIT ${Number(limit)} OFFSET ${skip}
  `);

  const guests = guestsRaw.map(g => ({
    ...g,
    totalBookings: Number(g.totalBookings)
  }));

  res.status(200).json(new ApiResponse(200, "Guests retrieved", {
    total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)), guests
  }));
});
