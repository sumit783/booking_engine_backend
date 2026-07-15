import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

const VALID_TYPES = ["WEEKDAY", "WEEKEND", "SEASONAL", "FESTIVAL", "HOLIDAY", "DYNAMIC"];
const VALID_ADJ = ["FIXED", "PERCENT"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getOwnedProperty = async (propertyId, userId) => {
  const p = await prisma.property.findFirst({ where: { id: propertyId, userId, isDeleted: false } });
  if (!p) throw new ApiError(404, "Property not found or access denied");
  return p;
};

const getPropertyRoom = async (roomId, propertyId) => {
  const r = await prisma.room.findFirst({ where: { id: roomId, propertyId } });
  if (!r) throw new ApiError(404, "Room not found");
  return r;
};

// ── Controllers ──────────────────────────────────────────────────────────────

// GET /api/v1/properties/:id/rooms/:roomId/pricing
export const getPricingRules = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId     = Number(req.params.roomId);

  await getOwnedProperty(propertyId, req.user.id);
  await getPropertyRoom(roomId, propertyId);

  const rules = await prisma.pricingRule.findMany({
    where:   { roomId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  res.json(new ApiResponse(200, "Pricing rules fetched", rules));
});

// POST /api/v1/properties/:id/rooms/:roomId/pricing
export const createPricingRule = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId     = Number(req.params.roomId);

  await getOwnedProperty(propertyId, req.user.id);
  await getPropertyRoom(roomId, propertyId);

  const {
    name, type, adjustmentType, adjustmentValue,
    startDate, endDate, daysOfWeek, minOccupancy,
    priority = 0, isActive = true,
  } = req.body;

  if (!name?.trim())                        throw new ApiError(400, "name is required");
  if (!VALID_TYPES.includes(type))          throw new ApiError(400, `type must be one of: ${VALID_TYPES.join(", ")}`);
  if (!VALID_ADJ.includes(adjustmentType))  throw new ApiError(400, `adjustmentType must be FIXED or PERCENT`);
  if (adjustmentValue == null)              throw new ApiError(400, "adjustmentValue is required");

  // Date validation for date-range types
  if (["SEASONAL", "FESTIVAL", "HOLIDAY"].includes(type)) {
    if (!startDate || !endDate) throw new ApiError(400, "startDate and endDate required for this rule type");
    if (new Date(startDate) > new Date(endDate)) throw new ApiError(400, "startDate must be before endDate");
  }

  const rule = await prisma.pricingRule.create({
    data: {
      roomId,
      name: name.trim(),
      type,
      adjustmentType,
      adjustmentValue: Number(adjustmentValue),
      startDate:       startDate ? new Date(startDate) : null,
      endDate:         endDate   ? new Date(endDate)   : null,
      daysOfWeek:      daysOfWeek ?? null,
      minOccupancy:    minOccupancy ? Number(minOccupancy) : null,
      priority:        Number(priority),
      isActive:        Boolean(isActive),
    },
  });

  res.status(201).json(new ApiResponse(201, "Pricing rule created", rule));
});

// PATCH /api/v1/properties/:id/rooms/:roomId/pricing/:ruleId
export const updatePricingRule = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId     = Number(req.params.roomId);
  const ruleId     = Number(req.params.ruleId);

  await getOwnedProperty(propertyId, req.user.id);
  await getPropertyRoom(roomId, propertyId);

  const existing = await prisma.pricingRule.findFirst({ where: { id: ruleId, roomId } });
  if (!existing) throw new ApiError(404, "Pricing rule not found");

  const {
    name, type, adjustmentType, adjustmentValue,
    startDate, endDate, daysOfWeek, minOccupancy,
    priority, isActive,
  } = req.body;

  const resolvedType = type ?? existing.type;

  if (type && !VALID_TYPES.includes(type))         throw new ApiError(400, `type must be one of: ${VALID_TYPES.join(", ")}`);
  if (adjustmentType && !VALID_ADJ.includes(adjustmentType)) throw new ApiError(400, "adjustmentType must be FIXED or PERCENT");

  const data = {};
  if (name            !== undefined) data.name           = name.trim();
  if (type            !== undefined) data.type           = type;
  if (adjustmentType  !== undefined) data.adjustmentType = adjustmentType;
  if (adjustmentValue !== undefined) data.adjustmentValue = Number(adjustmentValue);
  if (startDate       !== undefined) data.startDate      = startDate ? new Date(startDate) : null;
  if (endDate         !== undefined) data.endDate        = endDate   ? new Date(endDate)   : null;
  if (daysOfWeek      !== undefined) data.daysOfWeek     = daysOfWeek;
  if (minOccupancy    !== undefined) data.minOccupancy   = minOccupancy ? Number(minOccupancy) : null;
  if (priority        !== undefined) data.priority       = Number(priority);
  if (isActive        !== undefined) data.isActive       = Boolean(isActive);

  const updated = await prisma.pricingRule.update({ where: { id: ruleId }, data });

  res.json(new ApiResponse(200, "Pricing rule updated", updated));
});

// DELETE /api/v1/properties/:id/rooms/:roomId/pricing/:ruleId
export const deletePricingRule = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId     = Number(req.params.roomId);
  const ruleId     = Number(req.params.ruleId);

  await getOwnedProperty(propertyId, req.user.id);
  await getPropertyRoom(roomId, propertyId);

  const existing = await prisma.pricingRule.findFirst({ where: { id: ruleId, roomId } });
  if (!existing) throw new ApiError(404, "Pricing rule not found");

  await prisma.pricingRule.delete({ where: { id: ruleId } });

  res.json(new ApiResponse(200, "Pricing rule deleted", null));
});
