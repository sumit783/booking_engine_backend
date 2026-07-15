import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// Helper: verify property ownership
const getOwnedProperty = async (propertyId, userId) => {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      userId,
      isDeleted: false,
    },
  });
  if (!property) throw new ApiError(404, "Property not found or access denied");
  return property;
};

// Helper: verify room belongs to property
const getPropertyRoom = async (roomId, propertyId) => {
  const room = await prisma.room.findFirst({
    where: { id: roomId, propertyId },
  });
  if (!room) throw new ApiError(404, "Room not found");
  return room;
};

// POST /api/v1/properties/:id/rooms/:roomId/blocks
export const createRoomBlock = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId = Number(req.params.roomId);
  const { startDate, endDate, status = "BLOCKED", reason } = req.body;

  await getOwnedProperty(propertyId, req.user.id);
  await getPropertyRoom(roomId, propertyId);

  if (!startDate || !endDate) {
    throw new ApiError(400, "startDate and endDate are required");
  }
  if (new Date(startDate) > new Date(endDate)) {
    throw new ApiError(400, "startDate must be before or equal to endDate");
  }

  const allowedStatuses = ["BLOCKED", "MAINTENANCE"];
  if (!allowedStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of: ${allowedStatuses.join(", ")}`);
  }

  const block = await prisma.roomBlock.create({
    data: {
      roomId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status,
      reason: reason || null,
    },
  });

  res.status(201).json(
    new ApiResponse(201, "Room block created", block)
  );
});

// DELETE /api/v1/properties/:id/rooms/:roomId/blocks/:blockId
export const deleteRoomBlock = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId = Number(req.params.roomId);
  const blockId = Number(req.params.blockId);

  await getOwnedProperty(propertyId, req.user.id);
  await getPropertyRoom(roomId, propertyId);

  const block = await prisma.roomBlock.findFirst({
    where: { id: blockId, roomId },
  });
  if (!block) throw new ApiError(404, "Block not found");

  await prisma.roomBlock.delete({ where: { id: blockId } });

  res.status(200).json(
    new ApiResponse(200, "Room block deleted", null)
  );
});

// GET /api/v1/properties/:id/rooms/availability?year=2025&month=7
export const getRoomAvailability = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);

  // Build date range: default to current month
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || (new Date().getMonth() + 1);

  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month, 0, 23, 59, 59); // last day of month

  // Fetch all rooms for the property
  const rooms = await prisma.room.findMany({
    where: { propertyId },
    select: {
      id: true,
      name: true,
      quantity: true,
      blocks: {
        where: {
          startDate: { lte: rangeEnd },
          endDate: { gte: rangeStart },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
          reason: true,
        },
      },
    },
  });

  res.status(200).json(
    new ApiResponse(200, "Availability fetched", { year, month, rooms })
  );
});

// GET /api/v1/properties/:id/rooms/:roomId/blocks
export const getRoomBlocks = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId = Number(req.params.roomId);

  await getOwnedProperty(propertyId, req.user.id);
  await getPropertyRoom(roomId, propertyId);

  const blocks = await prisma.roomBlock.findMany({
    where: { roomId },
    orderBy: { startDate: "asc" },
  });

  res.status(200).json(
    new ApiResponse(200, "Room blocks fetched", blocks)
  );
});
