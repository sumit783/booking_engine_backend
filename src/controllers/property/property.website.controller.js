import Property from "../../models/property/property.model.js";
import Template from "../../models/admin/template.model.js";
import ApiError from "../../utils/apiError.js";
import asyncHandler from "../../utils/asyncHandler.js";

// @desc    Get all active website templates
// @route   GET /api/v1/properties/templates
// @access  Owner (or Public, but Owner for selection)
export const getActiveTemplates = asyncHandler(async (req, res) => {
  const templates = await Template.find({ isActive: true }).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: templates,
  });
});

// @desc    Update website template selection
// @route   PATCH /api/v1/properties/:id/website-template
// @access  Owner
export const updateWebsiteTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.body;

  if (!templateId) {
    throw new ApiError(400, "Template ID is required");
  }

  const template = await Template.findOne({ _id: templateId, isActive: true });
  if (!template) {
    throw new ApiError(404, "Template not found or inactive");
  }

  const property = await Property.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  });

  if (!property) throw new ApiError(404, "Property not found");

  property.websiteBuilder.template = templateId;
  await property.save();

  res.status(200).json({
    success: true,
    message: "Website template updated successfully",
    data: property.websiteBuilder,
  });
});

// @desc    Update website builder details (Hero, About, Facilities, Social, SEO)
// @route   PATCH /api/v1/properties/:id/website-builder
// @access  Owner
export const updateWebsiteBuilder = asyncHandler(async (req, res) => {
  const { heroBanner, about, facilities, socialLinks, seoSettings } = req.body;

  const property = await Property.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  });

  if (!property) throw new ApiError(404, "Property not found");

  if (heroBanner !== undefined) property.websiteBuilder.heroBanner = heroBanner;
  if (about !== undefined) property.websiteBuilder.about = about;
  if (facilities !== undefined) property.websiteBuilder.facilities = facilities;
  
  if (socialLinks) {
    if (socialLinks.facebook !== undefined) property.websiteBuilder.socialLinks.facebook = socialLinks.facebook;
    if (socialLinks.instagram !== undefined) property.websiteBuilder.socialLinks.instagram = socialLinks.instagram;
    if (socialLinks.twitter !== undefined) property.websiteBuilder.socialLinks.twitter = socialLinks.twitter;
  }

  if (seoSettings) {
    if (seoSettings.metaTitle !== undefined) property.websiteBuilder.seoSettings.metaTitle = seoSettings.metaTitle;
    if (seoSettings.metaDescription !== undefined) property.websiteBuilder.seoSettings.metaDescription = seoSettings.metaDescription;
    if (seoSettings.keywords !== undefined) property.websiteBuilder.seoSettings.keywords = seoSettings.keywords;
  }

  await property.save();

  res.status(200).json({
    success: true,
    message: "Website builder updated successfully",
    data: property.websiteBuilder,
  });
});

// @desc    Publish website (transitions websiteBuilder verification to PENDING)
// @route   POST /api/v1/properties/:id/website-publish
// @access  Owner
export const publishWebsite = asyncHandler(async (req, res) => {
  const property = await Property.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  });

  if (!property) throw new ApiError(404, "Property not found");

  property.websiteBuilder.isPublished = true;
  // If property is already live, maybe this section needs reverification, or maybe we just set the section to pending
  // Similar to submitForApproval, we set the specific section status to PENDING so admin can verify it
  property.verification.websiteBuilder.status = "PENDING";
  property.verification.websiteBuilder.message = undefined;

  // If the property itself is APPROVED but a section became PENDING, do we transition property status?
  // Let's keep it simple: just mark the section PENDING and if needed, property status to PENDING or REUPLOADED.
  if (property.status === "APPROVED") {
    property.status = "REUPLOADED";
  } else if (property.status === "DRAFT") {
    // maybe we shouldn't change from draft unless they submit everything?
    // The prompt just says admin verify at verification process. So setting section to PENDING is enough.
  }

  await property.save();

  res.status(200).json({
    success: true,
    message: "Website published and submitted for verification",
    data: {
      isPublished: property.websiteBuilder.isPublished,
      verification: property.verification.websiteBuilder,
    },
  });
});
