import Template from "../../models/admin/template.model.js";
import ApiError from "../../utils/apiError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { fileUrl } from "../../middleware/upload.middleware.js";

// @desc    Add a new template
// @route   POST /api/v1/admin/templates
// @access  Admin
export const addTemplate = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const previewImage = fileUrl(req.files, "previewImage") || req.body.previewImage;

  if (!name) {
    throw new ApiError(400, "Template name is required");
  }

  const existingTemplate = await Template.findOne({ name });
  if (existingTemplate) {
    throw new ApiError(400, "Template with this name already exists");
  }

  const template = await Template.create({
    name,
    description,
    previewImage,
  });

  res.status(201).json({
    success: true,
    message: "Template created successfully",
    data: template,
  });
});

// @desc    Get all templates
// @route   GET /api/v1/admin/templates
// @access  Admin
export const getTemplates = asyncHandler(async (req, res) => {
  const templates = await Template.find().sort({ createdAt: -1 });
  const totalCount = await Template.countDocuments();

  res.status(200).json({
    success: true,
    count: totalCount,
    data: templates,
  });
});

// @desc    Update a template
// @route   PATCH /api/v1/admin/templates/:id
// @access  Admin
export const updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive } = req.body;
  const previewImage = fileUrl(req.files, "previewImage") || req.body.previewImage;

  const template = await Template.findById(id);
  if (!template) {
    throw new ApiError(404, "Template not found");
  }

  if (name && name !== template.name) {
    const existingTemplate = await Template.findOne({ name });
    if (existingTemplate) {
      throw new ApiError(400, "Template with this name already exists");
    }
    template.name = name;
  }

  if (description !== undefined) template.description = description;
  if (previewImage !== undefined) template.previewImage = previewImage;
  if (isActive !== undefined) template.isActive = isActive;

  await template.save();

  res.status(200).json({
    success: true,
    message: "Template updated successfully",
    data: template,
  });
});

// @desc    Delete a template
// @route   DELETE /api/v1/admin/templates/:id
// @access  Admin
export const deleteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const template = await Template.findByIdAndDelete(id);
  if (!template) {
    throw new ApiError(404, "Template not found");
  }

  res.status(200).json({
    success: true,
    message: "Template deleted successfully",
  });
});
