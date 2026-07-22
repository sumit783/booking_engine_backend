import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// Helper: Format single package to map images to URLs
const formatPackage = (pkg, req) => {
  if (!pkg) return null;
  const formatted = { ...pkg };
  
  // Convert Decimal price to Number for JSON response
  if (pkg.price) {
    formatted.price = Number(pkg.price);
  }

  if (pkg.images) {
    formatted.images = pkg.images.map((img) => ({
      _id: img.id,
      id: img.id,
      url: img.url,
    }));
  }
  return formatted;
};

// POST /api/v1/properties/:propertyId/packages
export const createPackage = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.propertyId);
  const { name, description, price } = req.body;

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
  if (!name || !price) {
    throw new ApiError(400, "Name and price are required");
  }

  // 3. Parse activities
  let parsedActivities = [];
  const rawActivities = req.body["activities[]"] || req.body.activities;
  if (rawActivities) {
    if (Array.isArray(rawActivities)) {
      parsedActivities = rawActivities;
    } else if (typeof rawActivities === "string") {
      parsedActivities = rawActivities.split(",").map(a => a.trim()).filter(a => a);
    } else {
      parsedActivities = [rawActivities];
    }
  }

  // 4. Create package
  const pkg = await prisma.package.create({
    data: {
      propertyId,
      name,
      description,
      price: Number(price),
      activities: parsedActivities,
    },
  });

  // 5. Save package images
  const images = req.files?.images || req.files; // Accept multiple forms
  if (images && images.length > 0) {
    for (const file of images) {
      await prisma.packageImage.create({
        data: {
          packageId: pkg.id,
          url: file.path || file.secure_url || file.url,
        },
      });
    }
  }

  // Refetch package with images to return formatted URLs
  const createdPkg = await prisma.package.findUnique({
    where: { id: pkg.id },
    include: { images: true },
  });

  res.status(201).json(
    new ApiResponse(201, "Package created successfully", formatPackage(createdPkg, req))
  );
});

// PATCH /api/v1/properties/:propertyId/packages/:packageId
export const updatePackage = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.propertyId);
  const packageId = Number(req.params.packageId);
  const { name, description, price } = req.body;

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

  // 2. Find package
  const pkg = await prisma.package.findFirst({
    where: {
      id: packageId,
      propertyId,
      isDeleted: false,
    },
  });

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  // 3. Parse activities if updated
  let parsedActivities = undefined;
  const rawActivities = req.body["activities[]"] || req.body.activities;
  if (rawActivities !== undefined) {
    if (Array.isArray(rawActivities)) {
      parsedActivities = rawActivities;
    } else if (typeof rawActivities === "string") {
      parsedActivities = rawActivities.split(",").map(a => a.trim()).filter(a => a);
    } else {
      parsedActivities = [rawActivities];
    }
  }

  // 4. Update package
  const updatedPkg = await prisma.package.update({
    where: { id: packageId },
    data: {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      price: price !== undefined ? Number(price) : undefined,
      activities: parsedActivities !== undefined ? parsedActivities : undefined,
    },
  });

  // 5. Save new package images if uploaded
  const images = req.files?.images || req.files;
  if (images && images.length > 0) {
    for (const file of images) {
      await prisma.packageImage.create({
        data: {
          packageId: packageId,
          url: file.path || file.secure_url || file.url,
        },
      });
    }
  }

  // Refetch package with images to return formatted URLs
  const finalPkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: { images: true },
  });

  res.status(200).json(
    new ApiResponse(200, "Package updated successfully", formatPackage(finalPkg, req))
  );
});

// DELETE /api/v1/properties/:propertyId/packages/:packageId
export const deletePackage = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.propertyId);
  const packageId = Number(req.params.packageId);

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

  // 2. Find package
  const pkg = await prisma.package.findFirst({
    where: {
      id: packageId,
      propertyId,
      isDeleted: false,
    },
  });

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  // Soft delete package
  await prisma.package.update({
    where: { id: packageId },
    data: { isDeleted: true },
  });

  res.status(200).json(
    new ApiResponse(200, "Package deleted successfully", null)
  );
});

// GET /api/v1/properties/:propertyId/packages
export const getPropertyPackages = asyncHandler(async (req, res) => {
  const propertyId = Number(req.params.propertyId);

  const packages = await prisma.package.findMany({
    where: {
      propertyId,
      isDeleted: false,
    },
    include: { images: true },
  });

  const formatted = packages.map(pkg => formatPackage(pkg, req));

  res.status(200).json(
    new ApiResponse(200, "Packages fetched successfully", formatted)
  );
});

export const getPackageImage = asyncHandler(async (req, res) => {
  const imageId = Number(req.params.imageId);

  const image = await prisma.packageImage.findUnique({
    where: { id: imageId },
  });

  if (!image || !image.url) {
    throw new ApiError(404, "Image not found");
  }

  res.redirect(image.url);
});
