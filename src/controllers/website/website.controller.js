import asyncHandler from "../../utils/asyncHandler.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import { prisma } from "../../config/db.js";

// Helper: Format single property to map id to _id for backward compatibility
const formatProperty = (property) => {
  if (!property) return null;
  const formatted = {
    ...property,
    _id: property.id,
  };
  if (property.template) {
    formatted.websiteBuilder = {
      ...(property.websiteBuilder || {}),
      template: {
        ...property.template,
        _id: property.template.id,
      },
    };
    delete formatted.template;
  }
  return formatted;
};

// ── GET /api/v1/website/:slug ────────────────────────────────────────────────
// Public route to fetch all necessary data for the website builder
export const getWebsiteData = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const property = await prisma.property.findFirst({
    where: { propertySlug: slug },
    select: {
      id: true,
      userId: true,
      propertyName: true,
      propertySlug: true,
      propertyType: true,
      description: true,
      establishedYear: true,
      totalRooms: true,
      totalFloors: true,
      checkInTime: true,
      checkOutTime: true,
      website: true,
      logo: true,
      coverImage: true,
      gallery: true,
      address: true,
      location: true,
      contact: true,
      amenities: true,
      policies: true,
      websiteBuilder: true,
      template: {
        select: { id: true, name: true, description: true, previewImage: true },
      },
      status: true,
      approvedBy: true,
      approvedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!property) throw new ApiError(404, "Property not found");

  res.status(200).json(
    new ApiResponse(200, "Website data fetched successfully", { property: formatProperty(property) })
  );
});

// ── GET /api/v1/website/properties/all ────────────────────────────────────
// Public route: list all active/approved properties for the landing page
export const getAllPublicProperties = asyncHandler(async (req, res) => {
  const properties = await prisma.property.findMany({
    where: { 
      status: "APPROVED",
      isDeleted: false,
    },
    select: {
      id: true,
      propertyName: true,
      propertySlug: true,
      propertyType: true,
      description: true,
      location: true,
      coverImage: true,
      website: true,
    },
    orderBy: { createdAt: "desc" }
  });

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const formatted = properties.map(p => ({
    id: p.id,
    name: p.propertyName,
    slug: p.propertySlug,
    type: p.propertyType,
    description: p.description,
    location: p.location,
    website: p.website,
    coverImageUrl: p.coverImage ? p.coverImage : null,
  }));

  res.status(200).json(
    new ApiResponse(200, "Public properties fetched successfully", formatted)
  );
});

// ── GET /api/v1/website/:slug/rooms ─────────────────────────────────────────
// Public route: list rooms for a property by slug
export const getPublicRooms = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { checkIn, checkOut, guests, type, children, beds, minPrice, maxPrice, amenities } = req.query;

  const property = await prisma.property.findFirst({
    where: { propertySlug: slug },
    select: { id: true, propertyName: true, propertySlug: true, checkInTime: true, checkOutTime: true, website: true },
  });
  if (!property) throw new ApiError(404, "Property not found");

  let whereClause = { propertyId: property.id };
  if (guests) {
    whereClause.capacity = { gte: parseInt(guests, 10) };
  }
  if (children) {
    whereClause.childrenCount = { gte: parseInt(children, 10) };
  }
  if (beds) {
    whereClause.bedsCount = { gte: parseInt(beds, 10) };
  }
  if (type) {
    whereClause.name = { contains: type };
  }
  if (minPrice || maxPrice) {
    whereClause.basePrice = {};
    if (minPrice) whereClause.basePrice.gte = parseFloat(minPrice);
    if (maxPrice) whereClause.basePrice.lte = parseFloat(maxPrice);
  }

  const allRooms = await prisma.room.findMany({
    where: whereClause,
    include: { 
      images: { select: { id: true, url: true } },
      bookings: true,
      blocks: true 
    },
    orderBy: { createdAt: "asc" },
  });

  // Filter availability and amenities
  let availableRooms = allRooms;
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    availableRooms = allRooms.filter(room => {
      const bookedCount = room.bookings.filter(b => {
        return (new Date(b.checkInDate) < checkOutDate && new Date(b.checkOutDate) > checkInDate);
      }).length;
      
      const blockedCount = room.blocks.filter(b => {
        return (new Date(b.startDate) < checkOutDate && new Date(b.endDate) > checkInDate);
      }).length;
      
      const totalUnavailable = bookedCount + blockedCount;
      return totalUnavailable < room.quantity;
    });
  }

  if (amenities) {
    const amenitiesList = Array.isArray(amenities) ? amenities : amenities.split(",").map(a => a.trim().toLowerCase());
    availableRooms = availableRooms.filter(room => {
      if (!room.amenities) return false;
      const roomAmenities = Array.isArray(room.amenities) ? room.amenities.map(a => typeof a === 'string' ? a.toLowerCase() : '') : [];
      return amenitiesList.every(required => roomAmenities.includes(required));
    });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const formatted = availableRooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    capacity: room.capacity,
    childrenCount: room.childrenCount,
    bedsCount: room.bedsCount,
    quantity: room.quantity,
    basePrice: Number(room.basePrice),
    amenities: room.amenities || [],
    images: room.images.map((img) => ({
      id: img.id,
      url: img.url,
    })),
  }));

  const allPropertyRooms = await prisma.room.findMany({
    where: { propertyId: property.id },
    select: { name: true, amenities: true }
  });
  const allRoomTypes = [...new Set(allPropertyRooms.map(r => r.name))];
  const allAmenities = [...new Set(
    allPropertyRooms.flatMap(r => {
      if (!r.amenities) return [];
      if (Array.isArray(r.amenities)) return r.amenities.map(a => typeof a === 'string' ? a.trim() : '');
      return [];
    }).filter(Boolean)
  )];

  res.status(200).json(
    new ApiResponse(200, "Rooms fetched", {
      property: {
        id: property.id,
        name: property.propertyName,
        slug: property.propertySlug,
        website: property.website,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
      },
      rooms: formatted,
      allRoomTypes,
      allAmenities,
    })
  );
});

// ── GET /api/v1/website/:slug/packages ──────────────────────────────────────
// Public route: list packages for a property by slug
export const getPublicPackages = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { type, minPrice, maxPrice, amenities } = req.query;

  const property = await prisma.property.findFirst({
    where: { propertySlug: slug },
    select: { id: true, propertyName: true, propertySlug: true, checkInTime: true, checkOutTime: true },
  });
  if (!property) throw new ApiError(404, "Property not found");

  let whereClause = { propertyId: property.id, isDeleted: false };
  if (type) {
    whereClause.name = { contains: type };
  }
  if (minPrice || maxPrice) {
    whereClause.price = {};
    if (minPrice) whereClause.price.gte = parseFloat(minPrice);
    if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
  }

  let packages = await prisma.package.findMany({
    where: whereClause,
    include: { images: { select: { id: true, url: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (amenities) {
    const amenitiesList = Array.isArray(amenities) ? amenities : amenities.split(",").map(a => a.trim().toLowerCase());
    packages = packages.filter(pkg => {
      if (!pkg.activities) return false;
      const pkgActivities = Array.isArray(pkg.activities) ? pkg.activities.map(a => typeof a === 'string' ? a.toLowerCase() : '') : [];
      return amenitiesList.every(required => pkgActivities.includes(required));
    });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const formatted = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: Number(pkg.price),
    activities: pkg.activities || [],
    images: pkg.images.map((img) => ({
      id: img.id,
      url: img.url,
    })),
  }));

  const allPropertyPackages = await prisma.package.findMany({
    where: { propertyId: property.id, isDeleted: false },
    select: { activities: true }
  });
  const allActivities = [...new Set(
    allPropertyPackages.flatMap(p => {
      if (!p.activities) return [];
      if (Array.isArray(p.activities)) return p.activities.map(a => typeof a === 'string' ? a.trim() : '');
      return [];
    }).filter(Boolean)
  )];

  res.status(200).json(
    new ApiResponse(200, "Packages fetched", {
      property: {
        id: property.id,
        name: property.propertyName,
        slug: property.propertySlug,
        website: property.website,
      },
      packages: formatted,
      allActivities,
    })
  );
});

// ── GET /api/v1/website/:slug/rooms/featured ──────────────────────────────
// Public route: list top 3 rooms for a property by slug
export const getFeaturedRooms = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const property = await prisma.property.findFirst({
    where: { propertySlug: slug },
    select: { id: true, propertyName: true, propertySlug: true, website: true },
  });
  if (!property) throw new ApiError(404, "Property not found");

  const rooms = await prisma.room.findMany({
    where: { propertyId: property.id },
    include: { images: { select: { id: true, url: true } } },
    orderBy: { createdAt: "asc" },
    take: 3,
  });

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const formatted = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    capacity: room.capacity,
    quantity: room.quantity,
    basePrice: Number(room.basePrice),
    amenities: room.amenities || [],
    images: room.images.map((img) => ({
      id: img.id,
      url: img.url,
    })),
  }));

  res.status(200).json(
    new ApiResponse(200, "Featured rooms fetched", { rooms: formatted })
  );
});

// ── GET /api/v1/website/:slug/packages/featured ───────────────────────────
// Public route: list top 3 packages for a property by slug
export const getFeaturedPackages = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const property = await prisma.property.findFirst({
    where: { propertySlug: slug },
    select: { id: true, propertyName: true, propertySlug: true, website: true },
  });
  if (!property) throw new ApiError(404, "Property not found");

  const packages = await prisma.package.findMany({
    where: { propertyId: property.id, isDeleted: false },
    include: { images: { select: { id: true, url: true } } },
    orderBy: { createdAt: "asc" },
    take: 3,
  });

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const formatted = packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    price: Number(pkg.price),
    activities: pkg.activities || [],
    images: pkg.images.map((img) => ({
      id: img.id,
      url: img.url,
    })),
  }));

  res.status(200).json(
    new ApiResponse(200, "Featured packages fetched", { packages: formatted })
  );
});

// ── GET /api/v1/website/:slug/extras ────────────────────────────────────────
// Public route: list extra packages (add-ons) for a property by slug
export const getPublicExtraPackages = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const property = await prisma.property.findFirst({
    where: { propertySlug: slug },
    select: { id: true, propertyName: true },
  });
  if (!property) throw new ApiError(404, "Property not found");

  const extras = await prisma.extraPackage.findMany({
    where: { propertyId: property.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  res.status(200).json(
    new ApiResponse(200, "Extra packages fetched", {
      property: {
        id: property.id,
        name: property.propertyName,
      },
      extras,
    })
  );
});
