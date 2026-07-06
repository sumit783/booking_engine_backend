import asyncHandler from "../../utils/asyncHandler.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import Property from "../../models/property/property.model.js";

// ── GET /api/v1/website/:slug ────────────────────────────────────────────────
// Public route to fetch all necessary data for the website builder
export const getWebsiteData = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // We find the property by its slug and populate necessary data
  const property = await Property.findOne({ propertySlug: slug })
    .populate("websiteBuilder.template", "name description previewImage url")
    .select("-verification -documents -bank -rejectionReason");

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  // Ensure only published properties are accessible (unless we want to allow preview)
  // For now we'll allow fetching but can optionally check property.websiteBuilder.isPublished

  res.status(200).json(
    new ApiResponse(200, "Website data fetched successfully", { property })
  );
});
