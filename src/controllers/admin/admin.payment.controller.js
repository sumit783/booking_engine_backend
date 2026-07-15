import { prisma } from "../../config/db.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET /api/v1/admin/payments ────────────────────────────────────────────────
export const getAdminPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {};

  if (status && status.toUpperCase() !== "ALL") {
    filter.paymentStatus = status.toUpperCase();
  }

  if (search) {
    filter.OR = [
      { bookingRef: { contains: search } },
      { razorpayOrderId: { contains: search } },
      { razorpayPaymentId: { contains: search } },
      { guestName: { contains: search } },
    ];
  }

  const [payments, total, stats] = await Promise.all([
    prisma.booking.findMany({
      where: filter,
      select: {
        id: true,
        bookingRef: true,
        guestName: true,
        totalAmount: true,
        paymentStatus: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        commissionAmount: true,
        createdAt: true,
        property: {
          select: {
            id: true,
            propertyName: true,
          }
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.booking.count({ where: filter }),
    prisma.booking.aggregate({
      where: {
        paymentStatus: "PAID"
      },
      _sum: {
        totalAmount: true,
        commissionAmount: true,
      },
      _count: {
        id: true,
      }
    }),
  ]);

  const totalBookings = await prisma.booking.count();
  const successRate = totalBookings > 0 ? (stats._count.id / totalBookings) * 100 : 0;

  res.status(200).json(
    new ApiResponse(200, "Admin payments retrieved", {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      stats: {
        totalRevenue: stats._sum.totalAmount || 0,
        totalCommission: stats._sum.commissionAmount || 0,
        successfulPayments: stats._count.id,
        successRate: successRate.toFixed(1),
      },
      payments,
    })
  );
});
