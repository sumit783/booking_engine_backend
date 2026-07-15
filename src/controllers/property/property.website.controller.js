import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import asyncHandler from "../../utils/asyncHandler.js";

// Helper: Format single property to map id to _id for backward compatibility
const formatProperty = (property) => {
  if (!property) return null;
  return {
    ...property,
    _id: property.id,
  };
};

// @desc    Get all active website templates
// @route   GET /api/v1/properties/templates
// @access  Owner (or Public, but Owner for selection)
export const getActiveTemplates = asyncHandler(async (req, res) => {
  const templates = await prisma.template.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  
  const formattedTemplates = templates.map((t) => ({
    ...t,
    _id: t.id,
  }));

  res.status(200).json({
    success: true,
    data: formattedTemplates,
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

  const template = await prisma.template.findFirst({
    where: { id: Number(templateId), isActive: true },
  });
  if (!template) {
    throw new ApiError(404, "Template not found or inactive");
  }

  const property = await prisma.property.findFirst({
    where: {
      id: Number(req.params.id),
      userId: req.user.id,
      isDeleted: false,
    },
  });

  if (!property) throw new ApiError(404, "Property not found");

  const wb = { ...(property.websiteBuilder || {}) };
  wb.template = templateId;

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: {
      websiteBuilder: wb,
      templateId: Number(templateId),
    },
  });

  res.status(200).json({
    success: true,
    message: "Website template updated successfully",
    data: updated.websiteBuilder,
  });
});

// @desc    Update website builder details (Hero, About, Facilities, Social, SEO)
// @route   PATCH /api/v1/properties/:id/website-builder
// @access  Owner
export const updateWebsiteBuilder = asyncHandler(async (req, res) => {
  const { heroBanner, about, facilities, socialLinks, seoSettings } = req.body;

  const property = await prisma.property.findFirst({
    where: {
      id: Number(req.params.id),
      userId: req.user.id,
      isDeleted: false,
    },
  });

  if (!property) throw new ApiError(404, "Property not found");

  const wb = { ...(property.websiteBuilder || {}) };

  if (heroBanner !== undefined) wb.heroBanner = heroBanner;
  if (about !== undefined) wb.about = about;
  if (facilities !== undefined) wb.facilities = facilities;
  
  if (socialLinks) {
    if (!wb.socialLinks) wb.socialLinks = {};
    if (socialLinks.facebook !== undefined) wb.socialLinks.facebook = socialLinks.facebook;
    if (socialLinks.instagram !== undefined) wb.socialLinks.instagram = socialLinks.instagram;
    if (socialLinks.twitter !== undefined) wb.socialLinks.twitter = socialLinks.twitter;
  }

  if (seoSettings) {
    if (!wb.seoSettings) wb.seoSettings = {};
    if (seoSettings.metaTitle !== undefined) wb.seoSettings.metaTitle = seoSettings.metaTitle;
    if (seoSettings.metaDescription !== undefined) wb.seoSettings.metaDescription = seoSettings.metaDescription;
    if (seoSettings.keywords !== undefined) wb.seoSettings.keywords = seoSettings.keywords;
  }

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: { websiteBuilder: wb },
  });

  res.status(200).json({
    success: true,
    message: "Website builder updated successfully",
    data: updated.websiteBuilder,
  });
});

// @desc    Publish website (transitions websiteBuilder verification to PENDING)
// @route   POST /api/v1/properties/:id/website-publish
// @access  Owner
export const publishWebsite = asyncHandler(async (req, res) => {
  const property = await prisma.property.findFirst({
    where: {
      id: Number(req.params.id),
      userId: req.user.id,
      isDeleted: false,
    },
  });

  if (!property) throw new ApiError(404, "Property not found");

  const wb = { ...(property.websiteBuilder || {}) };
  wb.isPublished = true;

  const verificationCopy = { ...(property.verification || {}) };
  if (!verificationCopy.websiteBuilder) verificationCopy.websiteBuilder = {};
  verificationCopy.websiteBuilder.status = "PENDING";
  verificationCopy.websiteBuilder.message = null;

  const data = {
    websiteBuilder: wb,
    verification: verificationCopy,
  };

  if (property.status === "APPROVED") {
    data.status = "REUPLOADED";
  }

  const updated = await prisma.property.update({
    where: { id: property.id },
    data,
  });

  res.status(200).json({
    success: true,
    message: "Website published and submitted for verification",
    data: {
      isPublished: updated.websiteBuilder.isPublished,
      verification: updated.verification.websiteBuilder,
    },
  });
});
