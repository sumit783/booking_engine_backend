import { PrismaClient } from "@prisma/client";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/apiResponse.js";
import ApiError from "../../utils/apiError.js";

const prisma = new PrismaClient();

// GET /api/v1/admin/commissions/global
export const getGlobalCommission = asyncHandler(async (req, res) => {
  let setting = await prisma.systemSetting.findUnique({
    where: { key: "global_commission_rate" },
  });

  if (!setting) {
    setting = await prisma.systemSetting.create({
      data: {
        key: "global_commission_rate",
        value: "10.00", // default 10%
      },
    });
  }

  res.status(200).json(
    new ApiResponse(200, "Global commission rate retrieved", {
      rate: parseFloat(setting.value),
    })
  );
});

// POST /api/v1/admin/commissions/global
export const updateGlobalCommission = asyncHandler(async (req, res) => {
  const { rate } = req.body;

  if (rate === undefined || isNaN(rate) || rate < 0 || rate > 100) {
    throw new ApiError(400, "Invalid commission rate. Must be between 0 and 100.");
  }

  const setting = await prisma.systemSetting.upsert({
    where: { key: "global_commission_rate" },
    update: { value: rate.toString() },
    create: { key: "global_commission_rate", value: rate.toString() },
  });

  res.status(200).json(
    new ApiResponse(200, "Global commission rate updated successfully", {
      rate: parseFloat(setting.value),
    })
  );
});

// GET /api/v1/admin/commissions/properties
export const getPropertiesCommissions = asyncHandler(async (req, res) => {
  const properties = await prisma.property.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      propertyName: true,
      commissionRate: true,
      rooms: {
        select: {
          id: true,
          name: true,
          commissionRate: true,
        },
      },
      packages: {
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          commissionRate: true,
        },
      },
    },
  });

  res.status(200).json(
    new ApiResponse(200, "Properties and overrides retrieved", properties)
  );
});

// PATCH /api/v1/admin/commissions/properties/:id
export const updatePropertyCommission = asyncHandler(async (req, res) => {
  const propertyId = parseInt(req.params.id);
  const { rate } = req.body; // percentage or null to clear override

  if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
    throw new ApiError(400, "Invalid commission rate. Must be between 0 and 100, or null.");
  }

  const property = await prisma.property.update({
    where: { id: propertyId },
    data: { commissionRate: rate === null ? null : rate },
  });

  res.status(200).json(
    new ApiResponse(200, "Property commission override updated", property)
  );
});

// PATCH /api/v1/admin/commissions/rooms/:id
export const updateRoomCommission = asyncHandler(async (req, res) => {
  const roomId = parseInt(req.params.id);
  const { rate } = req.body;

  if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
    throw new ApiError(400, "Invalid commission rate. Must be between 0 and 100, or null.");
  }

  const room = await prisma.room.update({
    where: { id: roomId },
    data: { commissionRate: rate === null ? null : rate },
  });

  res.status(200).json(
    new ApiResponse(200, "Room commission override updated", room)
  );
});

// PATCH /api/v1/admin/commissions/packages/:id
export const updatePackageCommission = asyncHandler(async (req, res) => {
  const packageId = parseInt(req.params.id);
  const { rate } = req.body;

  if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
    throw new ApiError(400, "Invalid commission rate. Must be between 0 and 100, or null.");
  }

  const pkg = await prisma.package.update({
    where: { id: packageId },
    data: { commissionRate: rate === null ? null : rate },
  });

  res.status(200).json(
    new ApiResponse(200, "Package commission override updated", pkg)
  );
});
