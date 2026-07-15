import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET /api/v1/admin/owners ──────────────────────────────────────────────────
export const getOwners = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 10 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const whereClause = {
    role: "owner",
    isDeleted: false,
  };

  if (status && status !== "ALL") {
    whereClause.status = status.toLowerCase();
  }

  if (search) {
    whereClause.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const [owners, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { properties: true }
        },
        properties: {
          select: {
            id: true,
            propertyName: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5 // Get top 5 recent properties for the details dialog
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum,
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Owners retrieved successfully", {
      owners,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum,
    })
  );
});
