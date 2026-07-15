import { PrismaClient } from "@prisma/client";
import ApiError from "../../utils/apiError.js";

const prisma = new PrismaClient();

// POST /api/v1/properties/:propertyId/extras
export const createExtraPackage = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const { name, description, price, type, isActive, image } = req.body;

    const property = await prisma.property.findFirst({
      where: { id: Number(propertyId), userId: req.user.id }
    });

    if (!property) {
      throw new ApiError(404, "Property not found or access denied");
    }

    const extraPackage = await prisma.extraPackage.create({
      data: {
        propertyId: property.id,
        name,
        description,
        price: Number(price),
        type,
        isActive: isActive !== undefined ? isActive : true,
        image
      }
    });

    res.status(201).json({ success: true, data: extraPackage });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/properties/:propertyId/extras
export const getPropertyExtraPackages = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const { activeOnly } = req.query;

    const whereClause = { propertyId: Number(propertyId) };
    if (activeOnly === 'true') {
      whereClause.isActive = true;
    }

    const extraPackages = await prisma.extraPackage.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ success: true, data: extraPackages });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/properties/:propertyId/extras/:extraId
export const updateExtraPackage = async (req, res, next) => {
  try {
    const { propertyId, extraId } = req.params;
    const { name, description, price, type, isActive, image } = req.body;

    const property = await prisma.property.findFirst({
      where: { id: Number(propertyId), userId: req.user.id }
    });

    if (!property) {
      throw new ApiError(404, "Property not found or access denied");
    }

    const extraPackage = await prisma.extraPackage.findFirst({
      where: { id: Number(extraId), propertyId: property.id }
    });

    if (!extraPackage) {
      throw new ApiError(404, "Extra Package not found");
    }

    const updated = await prisma.extraPackage.update({
      where: { id: Number(extraId) },
      data: {
        name: name || extraPackage.name,
        description: description !== undefined ? description : extraPackage.description,
        price: price !== undefined ? Number(price) : extraPackage.price,
        type: type || extraPackage.type,
        isActive: isActive !== undefined ? isActive : extraPackage.isActive,
        image: image !== undefined ? image : extraPackage.image
      }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/properties/:propertyId/extras/:extraId
export const deleteExtraPackage = async (req, res, next) => {
  try {
    const { propertyId, extraId } = req.params;

    const property = await prisma.property.findFirst({
      where: { id: Number(propertyId), userId: req.user.id }
    });

    if (!property) {
      throw new ApiError(404, "Property not found or access denied");
    }

    const extraPackage = await prisma.extraPackage.findFirst({
      where: { id: Number(extraId), propertyId: property.id }
    });

    if (!extraPackage) {
      throw new ApiError(404, "Extra Package not found");
    }

    await prisma.extraPackage.delete({
      where: { id: Number(extraId) }
    });

    res.status(200).json({ success: true, message: "Extra package deleted successfully" });
  } catch (error) {
    next(error);
  }
};
