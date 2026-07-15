import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { fileUrl } from "../../middleware/upload.middleware.js";

// Helper: Format single template to map id to _id for backward compatibility
const formatTemplate = (template) => {
  if (!template) return null;
  return {
    ...template,
    _id: template.id,
  };
};

// @desc    Add a new template
// @route   POST /api/v1/admin/templates
// @access  Admin
export const addTemplate = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const previewImage = fileUrl(req.files, "previewImage") || req.body.previewImage;

  if (!name) {
    throw new ApiError(400, "Template name is required");
  }

  const existingTemplate = await prisma.template.findUnique({ where: { name } });
  if (existingTemplate) {
    throw new ApiError(400, "Template with this name already exists");
  }

  const template = await prisma.template.create({
    data: {
      name,
      description,
      previewImage,
    },
  });

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: formatTemplate(template),
  });
});

// @desc    Get all templates
// @route   GET /api/v1/admin/templates
// @access  Admin
export const getTemplates = asyncHandler(async (req, res) => {
  const templates = await prisma.template.findMany({ orderBy: { createdAt: "desc" } });
  const totalCount = await prisma.template.count();

  const formattedTemplates = templates.map((t) => formatTemplate(t));

  res.status(200).json({
    success: true,
    count: totalCount,
    data: formattedTemplates,
  });
});

// @desc    Update a template
// @route   PATCH /api/v1/admin/templates/:id
// @access  Admin
export const updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive } = req.body;
  const previewImage = fileUrl(req.files, "previewImage") || req.body.previewImage;

  const template = await prisma.template.findUnique({ where: { id: Number(id) } });
  if (!template) {
    throw new ApiError(404, "Template not found");
  }

  const data = {};

  if (name && name !== template.name) {
    const existingTemplate = await prisma.template.findUnique({ where: { name } });
    if (existingTemplate) {
      throw new ApiError(400, "Template with this name already exists");
    }
    data.name = name;
  }

  if (description !== undefined) data.description = description;
  if (previewImage !== undefined) data.previewImage = previewImage;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.template.update({
    where: { id: template.id },
    data,
  });

  res.status(200).json({
    success: true,
    message: "Template updated successfully",
    data: formatTemplate(updated),
  });
});

// @desc    Delete a template
// @route   DELETE /api/v1/admin/templates/:id
// @access  Admin
export const deleteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const template = await prisma.template.findUnique({ where: { id: Number(id) } });
  if (!template) {
    throw new ApiError(404, "Template not found");
  }

  await prisma.template.delete({ where: { id: template.id } });

  res.status(200).json({
    success: true,
    message: "Template deleted successfully",
  });
});
