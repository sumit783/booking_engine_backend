import { prisma } from "../../config/db.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET /api/v1/admin/dashboard ────────────────────────────────────────────────
export const getAdminDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // 1. Stats Calculation
  const [
    totalProperties,
    pendingApprovals,
    todayBookings,
    revenueMTD,
    pendingWithdrawalsCount,
    pendingWithdrawalsSum,
    totalCommissionEarned
  ] = await Promise.all([
    prisma.property.count({ where: { isDeleted: false, status: "APPROVED" } }),
    prisma.property.count({ where: { isDeleted: false, status: { in: ["PENDING", "REUPLOADED"] } } }),
    prisma.booking.count({ where: { createdAt: { gte: today } } }),
    prisma.booking.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: startOfMonth } },
      _sum: { totalAmount: true, commissionAmount: true }
    }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.withdrawalRequest.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
    prisma.booking.aggregate({ where: { paymentStatus: "PAID" }, _sum: { commissionAmount: true } })
  ]);

  // 2. Chart Data (Last 7 Days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const recentBookingsForChart = await prisma.booking.findMany({
    where: { paymentStatus: "PAID", createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, totalAmount: true, commissionAmount: true }
  });

  const chartMap = new Map();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    chartMap.set(dateKey, { 
      day: dayNames[d.getDay()], 
      revenue: 0, 
      commission: 0,
      bookings: 0
    });
  }

  recentBookingsForChart.forEach(b => {
    const d = new Date(b.createdAt);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (chartMap.has(dateKey)) {
      const current = chartMap.get(dateKey);
      current.revenue += Number(b.totalAmount || 0);
      current.commission += Number(b.commissionAmount || 0);
      current.bookings += 1;
    }
  });

  const chartData = Array.from(chartMap.values());

  // 3. Recent Bookings List
  const recentBookings = await prisma.booking.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      property: { select: { propertyName: true } }
    }
  });

  // 4. Pending Properties List (for activities/alerts)
  const recentPendingProperties = await prisma.property.findMany({
    where: { isDeleted: false, status: { in: ["PENDING", "REUPLOADED"] } },
    take: 5,
    orderBy: { updatedAt: "asc" },
    select: { id: true, propertyName: true, status: true, updatedAt: true, user: { select: { fullName: true } } }
  });

  res.status(200).json(
    new ApiResponse(200, "Admin dashboard retrieved", {
      stats: {
        totalProperties,
        pendingApprovals,
        todayBookings,
        revenueMTD: Number(revenueMTD._sum.totalAmount || 0),
        commissionMTD: Number(revenueMTD._sum.commissionAmount || 0),
        totalCommissionEarned: Number(totalCommissionEarned._sum.commissionAmount || 0),
        pendingWithdrawalsCount,
        pendingWithdrawalsSum: Number(pendingWithdrawalsSum._sum.amount || 0),
      },
      chartData,
      recentBookings,
      recentPendingProperties
    })
  );
});
