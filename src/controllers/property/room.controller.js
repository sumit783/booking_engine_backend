import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// Helper: Format single room to map images to URLs
const formatRoom = (room, req) => {
  if (!room) return null;
  const formatted = { ...room };
  if (room.images) {
    formatted.images = room.images.map((img) => ({
      _id: img.id,
      id: img.id,
      url: img.url,
    }));
  }
  return formatted;
};

// POST /api/v1/properties/:id/rooms
export const createRoom = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const { name, description, capacity, quantity, basePrice, childrenCount, bedsCount } = req.body;

  // 1. Verify property ownership
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      userId: req.user.id,
      isDeleted: false,
    },
  });

  if (!property) {
    throw new ApiError(404, "Property not found or access denied");
  }

  // 2. Validate input
  if (!name || !capacity || !quantity || !basePrice) {
    throw new ApiError(400, "Name, capacity, quantity, and basePrice are required");
  }

  // 3. Parse amenities
  let parsedAmenities = [];
  const rawAmenities = req.body["amenities[]"] || req.body.amenities;
  if (rawAmenities) {
    if (Array.isArray(rawAmenities)) {
      parsedAmenities = rawAmenities;
    } else if (typeof rawAmenities === "string") {
      parsedAmenities = rawAmenities.split(",").map(a => a.trim()).filter(a => a);
    } else {
      parsedAmenities = [rawAmenities];
    }
  }

  // 3b. Parse room numbers
  let parsedRoomNumbers = [];
  const rawRoomNumbers = req.body["roomNumbers[]"] || req.body.roomNumbers;
  if (rawRoomNumbers) {
    if (Array.isArray(rawRoomNumbers)) {
      parsedRoomNumbers = rawRoomNumbers;
    } else if (typeof rawRoomNumbers === "string") {
      parsedRoomNumbers = rawRoomNumbers.split(",").map(rn => rn.trim()).filter(rn => rn);
    } else {
      parsedRoomNumbers = [rawRoomNumbers];
    }
  }

  // 4. Create room
  const room = await prisma.room.create({
    data: {
      propertyId,
      name,
      description,
      capacity: Number(capacity),
      quantity: Number(quantity),
      basePrice: Number(basePrice),
      childrenCount: childrenCount ? Number(childrenCount) : 0,
      bedsCount: bedsCount ? Number(bedsCount) : 1,
      amenities: parsedAmenities,
      roomNumbers: parsedRoomNumbers,
    },
  });

  // 5. Save room images
  const images = req.files?.images;
  if (images && images.length > 0) {
    for (const file of images) {
      await prisma.roomImage.create({
        data: {
          roomId: room.id,
          url: file.path,
        },
      });
    }
  }

  // Refetch room with images to return formatted URLs
  const createdRoom = await prisma.room.findUnique({
    where: { id: room.id },
    include: { images: true },
  });

  res.status(201).json(
    new ApiResponse(201, "Room created successfully", formatRoom(createdRoom, req))
  );
});

// GET /api/v1/properties/:id/rooms
export const getRooms = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);

  // 1. Verify property ownership
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      userId: req.user.id,
      isDeleted: false,
    },
  });

  if (!property) {
    throw new ApiError(404, "Property not found or access denied");
  }

  // 2. Fetch rooms with images
  const rooms = await prisma.room.findMany({
    where: {
      propertyId,
    },
    include: {
      images: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.status(200).json(
    new ApiResponse(200, "Rooms retrieved successfully", rooms.map(r => formatRoom(r, req)))
  );
});

export const getRoomImage = asyncHandler(async (req, res) => {
  const image = await prisma.roomImage.findUnique({
    where: { id: Number(req.params.id) },
  });

  if (!image || !image.url) {
    throw new ApiError(404, "Room image not found");
  }

  res.redirect(image.url);
});

// PATCH /api/v1/properties/:id/rooms/:roomId
export const updateRoom = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId = Number(req.params.roomId);
  const { name, description, capacity, quantity, basePrice, childrenCount, bedsCount } = req.body;

  // 1. Verify property ownership
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      userId: req.user.id,
      isDeleted: false,
    },
  });

  if (!property) {
    throw new ApiError(404, "Property not found or access denied");
  }

  // 2. Find room
  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
      propertyId,
    },
  });

  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  // 3. Parse amenities if updated
  let parsedAmenities = undefined;
  const rawAmenities = req.body["amenities[]"] || req.body.amenities;
  if (rawAmenities !== undefined) {
    if (Array.isArray(rawAmenities)) {
      parsedAmenities = rawAmenities;
    } else if (typeof rawAmenities === "string") {
      parsedAmenities = rawAmenities.split(",").map(a => a.trim()).filter(a => a);
    } else {
      parsedAmenities = [rawAmenities];
    }
  }

  // 3b. Parse room numbers if updated
  let parsedRoomNumbers = undefined;
  const rawRoomNumbers = req.body["roomNumbers[]"] || req.body.roomNumbers;
  if (rawRoomNumbers !== undefined) {
    if (Array.isArray(rawRoomNumbers)) {
      parsedRoomNumbers = rawRoomNumbers;
    } else if (typeof rawRoomNumbers === "string") {
      parsedRoomNumbers = rawRoomNumbers.split(",").map(rn => rn.trim()).filter(rn => rn);
    } else {
      parsedRoomNumbers = [rawRoomNumbers];
    }
  }

  // 4. Update room
  await prisma.room.update({
    where: { id: roomId },
    data: {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      capacity: capacity !== undefined ? Number(capacity) : undefined,
      quantity: quantity !== undefined ? Number(quantity) : undefined,
      basePrice: basePrice !== undefined ? Number(basePrice) : undefined,
      childrenCount: childrenCount !== undefined ? Number(childrenCount) : undefined,
      bedsCount: bedsCount !== undefined ? Number(bedsCount) : undefined,
      amenities: parsedAmenities !== undefined ? parsedAmenities : undefined,
      roomNumbers: parsedRoomNumbers !== undefined ? parsedRoomNumbers : undefined,
    },
  });

  // 5. Save new images if uploaded
  const images = req.files?.images;
  if (images && images.length > 0) {
    for (const file of images) {
      await prisma.roomImage.create({
        data: {
          roomId: roomId,
          url: file.path,
        },
      });
    }
  }

  // Refetch room with images to return formatted URLs
  const finalRoom = await prisma.room.findUnique({
    where: { id: roomId },
    include: { images: true },
  });

  res.status(200).json(
    new ApiResponse(200, "Room updated successfully", formatRoom(finalRoom, req))
  );
});

// DELETE /api/v1/properties/:id/rooms/:roomId
export const deleteRoom = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.id);
  const roomId = Number(req.params.roomId);

  // 1. Verify property ownership
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      userId: req.user.id,
      isDeleted: false,
    },
  });

  if (!property) {
    throw new ApiError(404, "Property not found or access denied");
  }

  // 2. Find room
  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
      propertyId,
    },
  });

  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  // Delete room
  await prisma.room.delete({
    where: { id: roomId },
  });

  res.status(200).json(
    new ApiResponse(200, "Room deleted successfully", null)
  );
});
