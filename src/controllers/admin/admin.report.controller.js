import { prisma } from "../../config/db.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET /api/v1/admin/reports ────────────────────────────────────────────────
export const getAdminReports = asyncHandler(async (req, res) => {
  // 1. Overall Metrics
  const [totalUsers, totalProperties, totalBookings, paymentStats] = await Promise.all([
    prisma.user.count({ where: { role: "owner", isDeleted: false } }),
    prisma.property.count({ where: { isDeleted: false, status: "APPROVED" } }),
    prisma.booking.count(),
    prisma.booking.aggregate({
      where: { paymentStatus: "PAID" },
      _sum: { totalAmount: true, commissionAmount: true },
    }),
  ]);

  const totalRevenue = Number(paymentStats._sum.totalAmount || 0);
  const totalCommission = Number(paymentStats._sum.commissionAmount || 0);

  // 2. Trend Data (Last 6 Months)
  // We'll fetch all PAID bookings from the last 6 months and group them in JS
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1); // Start of that month

  const recentBookings = await prisma.booking.findMany({
    where: {
      paymentStatus: "PAID",
      createdAt: { gte: sixMonthsAgo },
    },
    select: {
      createdAt: true,
      totalAmount: true,
      commissionAmount: true,
    }
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Initialize the last 6 months map
  const trendMap = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    trendMap.set(key, { name: key, revenue: 0, commission: 0, bookings: 0 });
  }

  // Populate data
  recentBookings.forEach((b) => {
    const d = new Date(b.createdAt);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (trendMap.has(key)) {
      const current = trendMap.get(key);
      current.revenue += Number(b.totalAmount || 0);
      current.commission += Number(b.commissionAmount || 0);
      current.bookings += 1;
    }
  });

  const trendData = Array.from(trendMap.values());

  // 3. Top Properties by Bookings/Revenue
  const topPropertiesRaw = await prisma.booking.groupBy({
    by: ['propertyId'],
    where: { paymentStatus: "PAID" },
    _sum: { totalAmount: true, commissionAmount: true },
    _count: { id: true },
    orderBy: {
      _sum: { totalAmount: 'desc' }
    },
    take: 5
  });

  // Fetch names for top properties
  const propertyIds = topPropertiesRaw.map(p => p.propertyId);
  const properties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true, propertyName: true }
  });

  const propertyMap = properties.reduce((acc, curr) => {
    acc[curr.id] = curr.propertyName;
    return acc;
  }, {});

  const topProperties = topPropertiesRaw.map(p => ({
    propertyId: p.propertyId,
    propertyName: propertyMap[p.propertyId] || "Unknown Property",
    revenue: Number(p._sum.totalAmount || 0),
    commission: Number(p._sum.commissionAmount || 0),
    bookings: p._count.id
  }));

  res.status(200).json(
    new ApiResponse(200, "Admin reports retrieved", {
      metrics: {
        totalUsers,
        totalProperties,
        totalBookings,
        totalRevenue,
        totalCommission,
      },
      trendData,
      topProperties,
    })
  );
});
