import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// Helper: Format single property to map id to _id for backward compatibility
const formatProperty = (property, req) => {
  if (!property) return null;
  const formatted = {
    ...property,
    _id: property.id,
  };

  const baseUrl = req ? `${req.protocol}://${req.get("host")}/api/v1` : "";

  // Convert raw buffers to endpoints
  formatted.logo = property.logo ? `${baseUrl}/properties/${property.id}/logo` : null;
  formatted.coverImage = property.coverImage ? `${baseUrl}/properties/${property.id}/cover` : null;

  if (property.gallery) {
    formatted.gallery = property.gallery.map((img) => ({
      _id: img.id,
      id: img.id,
      url: `${baseUrl}/properties/gallery/${img.id}`,
      title: img.title || "",
      description: img.description || "",
    }));
  }

  if (property.user) {
    formatted.userId = {
      ...property.user,
      _id: property.user.id,
    };
    delete formatted.user;
  }

  delete formatted.logo;
  delete formatted.coverImage;

  return formatted;
};

// ── GET /api/v1/admin/properties ────────────────────────────────────────────────
export const getPendingProperties = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, type } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {
    isDeleted: false,
  };

  if (status && status.toUpperCase() !== "ALL") {
    filter.status = status.toUpperCase();
  } else if (!status && req.path.includes("pending")) {
    filter.status = { in: ["PENDING", "REUPLOADED", "REJECTED"] };
  }

  if (type) {
    filter.propertyType = type;
  }

  if (search) {
    filter.propertyName = { contains: search };
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where: filter,
      select: {
        id: true,
        propertyName: true,
        propertyType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" }, // oldest first for queue
      skip,
      take: Number(limit),
    }),
    prisma.property.count({ where: filter }),
  ]);

  const formatted = properties.map((p) => formatProperty(p, req));

  res.status(200).json(
    new ApiResponse(200, "Properties retrieved", {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      properties: formatted,
    })
  );
});

export const getProperties = getPendingProperties; // Alias for routing

// ── GET /api/v1/admin/properties/:id ──────────────────────────────────────────
export const getPropertyForReview = asyncHandler(async (req, res) => {
  const property = await prisma.property.findFirst({
    where: {
      id: Number(req.params.id),
      isDeleted: false,
    },
    include: {
      gallery: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatar: true,
        },
      },
    },
  });

  if (!property) throw new ApiError(404, "Property not found");

  res.status(200).json(new ApiResponse(200, "Property details retrieved", formatProperty(property, req)));
});

// ── POST /api/v1/admin/properties/:id/verify ──────────────────────────────────
export const verifyProperty = asyncHandler(async (req, res) => {
  const { ownerDetails, propertyDetails, address, location, contact, websiteBuilder } = req.body;

  const property = await prisma.property.findFirst({
    where: {
      id: Number(req.params.id),
      isDeleted: false,
    },
  });

  if (!property) throw new ApiError(404, "Property not found");

  const SECTIONS = ["ownerDetails", "propertyDetails", "address", "location", "contact", "websiteBuilder"];
  let hasRejection = false;
  let hasPending = false;

  const updates = { ownerDetails, propertyDetails, address, location, contact, websiteBuilder };
  const verificationCopy = { ...(property.verification || {}) };

  SECTIONS.forEach((section) => {
    if (updates[section]) {
      verificationCopy[section] = {
        status: updates[section].status,
        message: updates[section].message || undefined,
      };
    }
    
    // Check overall status of all sections
    if (verificationCopy[section]?.status === "REJECTED") {
      hasRejection = true;
    } else if (
      verificationCopy[section]?.status === "PENDING" ||
      verificationCopy[section]?.status === "REUPLOADED"
    ) {
      hasPending = true;
    }
  });

  const data = {
    verification: verificationCopy,
  };

  // Determine overall property status
  if (hasRejection) {
    data.status = "REJECTED";
    data.rejectionReason = "One or more sections were rejected. Please check the section messages for details.";
  } else if (!hasPending) {
    // If no rejections and no pending/reuploaded sections, the property is fully approved
    data.status = "APPROVED";
    data.approvedBy = req.admin ? req.admin.id : null;
    data.approvedAt = new Date();
    data.rejectionReason = null;
  }

  const updated = await prisma.property.update({
    where: { id: property.id },
    data,
  });

  res.status(200).json(
    new ApiResponse(200, `Property verification updated (Status: ${updated.status})`, {
      status: updated.status,
      verification: updated.verification,
    })
  );
});

// ── PATCH /api/v1/admin/properties/:id/website-access ──────────────────────
export const toggleWebsiteAccess = asyncHandler(async (req, res) => {
  const { isWebsiteEnabled } = req.body;
  const property = await prisma.property.findFirst({
    where: { id: Number(req.params.id), isDeleted: false },
  });

  if (!property) throw new ApiError(404, "Property not found");

  const wb = { ...(property.websiteBuilder || {}) };
  wb.isWebsiteEnabled = isWebsiteEnabled;

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: { websiteBuilder: wb },
  });

  res.status(200).json(
    new ApiResponse(200, "Website access updated successfully", {
      isWebsiteEnabled: updated.websiteBuilder.isWebsiteEnabled,
    })
  );
});
