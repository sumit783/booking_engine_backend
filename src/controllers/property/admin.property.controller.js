import Property from "../../models/property/property.model.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET /api/v1/admin/properties/pending ──────────────────────────────────────
// List properties awaiting verification (PENDING or REUPLOADED)
export const getPendingProperties = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, type } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {
    isDeleted: false,
  };

  if (status) {
    filter.status = status.toUpperCase();
  } else {
    filter.status = { $in: ["PENDING", "REUPLOADED", "REJECTED"] };
  }

  if (type) {
    filter.propertyType = type;
  }

  if (search) {
    filter.propertyName = { $regex: search, $options: "i" };
  }

  const [properties, total] = await Promise.all([
    Property.find(filter)
      .populate("userId", "fullName email phone status")
      .select("propertyName propertyType status createdAt updatedAt")
      .sort({ updatedAt: 1 }) // oldest first for queue
      .skip(skip)
      .limit(Number(limit)),
    Property.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Properties retrieved", {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      properties,
    })
  );
});

// ── GET /api/v1/admin/properties/:id ──────────────────────────────────────────
// Get full property details including documents/bank for admin review
export const getPropertyForReview = asyncHandler(async (req, res) => {
  const property = await Property.findOne({
    _id: req.params.id,
    isDeleted: false,
  })
    .populate("userId", "fullName email phone avatar")
    .select("+documents +bank"); // admin needs to see these to verify

  if (!property) throw new ApiError(404, "Property not found");

  res.status(200).json(new ApiResponse(200, "Property details retrieved", property));
});

// ── POST /api/v1/admin/properties/:id/verify ──────────────────────────────────
// Verify specific sections of a property
export const verifyProperty = asyncHandler(async (req, res) => {
  const { ownerDetails, propertyDetails, address, location, contact, websiteBuilder } = req.body;

  const property = await Property.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!property) throw new ApiError(404, "Property not found");

  const SECTIONS = ["ownerDetails", "propertyDetails", "address", "location", "contact", "websiteBuilder"];
  let hasRejection = false;
  let hasPending = false;

  // Update provided sections
  const updates = { ownerDetails, propertyDetails, address, location, contact, websiteBuilder };
  
  SECTIONS.forEach((section) => {
    if (updates[section]) {
      property.verification[section].status = updates[section].status;
      property.verification[section].message = updates[section].message || undefined;
    }
    
    // Check overall status of all sections
    if (property.verification[section].status === "REJECTED") {
      hasRejection = true;
    } else if (property.verification[section].status === "PENDING" || property.verification[section].status === "REUPLOADED") {
      hasPending = true;
    }
  });

  // Determine overall property status
  if (hasRejection) {
    property.status = "REJECTED";
    property.rejectionReason = "One or more sections were rejected. Please check the section messages for details.";
  } else if (!hasPending) {
    // If no rejections and no pending/reuploaded sections, the property is fully approved
    property.status = "APPROVED";
    property.approvedBy = req.admin ? req.admin.id : null; // assuming req.admin from supabase auth
    property.approvedAt = new Date();
    property.rejectionReason = undefined;
  }

  await property.save();

  res.status(200).json(
    new ApiResponse(200, `Property verification updated (Status: ${property.status})`, {
      status: property.status,
      verification: property.verification,
    })
  );
});
