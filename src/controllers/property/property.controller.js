import { prisma } from "../../config/db.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { fileToBase64 } from "../../middleware/upload.middleware.js";
import Razorpay from "razorpay";


// Helper to generate a simple unique ID for JSON nested subdocuments (like amenities)
const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

// Slug helper
const toSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateUniqueSlug = async (propertyName, currentId = 0) => {
  const baseSlug = toSlug(propertyName);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.property.findFirst({
      where: {
        propertySlug: slug,
        id: { not: currentId },
      },
    });
    if (!existing) break;
    slug = `${baseSlug}-${counter++}`;
  }
  return slug;
};

// Helper: handle verification re-uploads
const handleVerificationReupload = (property, section, data) => {
  if (property.verification && property.verification[section]?.status === "REJECTED") {
    const verificationCopy = { ...property.verification };
    verificationCopy[section] = {
      ...verificationCopy[section],
      status: "REUPLOADED",
    };
    data.verification = verificationCopy;

    if (property.status === "REJECTED") {
      data.status = "REUPLOADED";
    }
  }
};

// Helper: load property that belongs to the requesting owner
const findOwnedProperty = async (propertyId, userId) => {
  const property = await prisma.property.findFirst({
    where: {
      id: Number(propertyId),
      userId,
      isDeleted: false,
    },
    include: {
      gallery: true,
    },
  });
  if (!property) throw new ApiError(404, "Property not found or access denied");
  return property;
};

// Helper: Format single property to map id to _id for backward compatibility
const formatProperty = (property) => {
  if (!property) return null;
  const formatted = {
    ...property,
    _id: property.id,
  };

  // Convert raw buffers to endpoints
  formatted.logo = property.logo ? `/api/v1/properties/${property.id}/logo` : null;
  formatted.coverImage = property.coverImage ? `/api/v1/properties/${property.id}/cover` : null;

  if (property.gallery) {
    formatted.gallery = property.gallery.map((img) => ({
      _id: img.id,
      id: img.id,
      url: `/api/v1/properties/gallery/${img.id}`,
      title: img.title || "",
      description: img.description || "",
    }));
  }

  // Remove actual buffer fields so we don't send huge payloads
  delete formatted.logoMimeType;
  delete formatted.coverImageMimeType;

  return formatted;
};

// ── POST /api/v1/properties ───────────────────────────────────────────────────
export const createProperty = asyncHandler(async (req, res) => {
  const {
    propertyName,
    propertyType,
    description,
    establishedYear,
    totalRooms,
    totalFloors,
    checkInTime,
    checkOutTime,
    website,
  } = req.body;

  if (!propertyName || !propertyType) {
    throw new ApiError(400, "Property name and type are required");
  }

  const slug = await generateUniqueSlug(propertyName);

  const property = await prisma.property.create({
    data: {
      userId: req.user.id,
      propertyName,
      propertySlug: slug,
      propertyType,
      description,
      establishedYear: establishedYear ? Number(establishedYear) : null,
      totalRooms: totalRooms ? Number(totalRooms) : 0,
      totalFloors: totalFloors ? Number(totalFloors) : 0,
      checkInTime,
      checkOutTime,
      website,
      status: "DRAFT",
      address: {},
      location: {},
      contact: {},
      amenities: [],
      policies: {},
      websiteBuilder: {},
      bank: {},
      documents: {},
      verification: {
        ownerDetails: { status: "PENDING" },
        propertyDetails: { status: "PENDING" },
        address: { status: "PENDING" },
        location: { status: "PENDING" },
        contact: { status: "PENDING" },
        websiteBuilder: { status: "PENDING" },
      },
    },
  });

  res.status(201).json(
    new ApiResponse(201, "Property created", {
      id: property.id,
      propertyName: property.propertyName,
      propertySlug: property.propertySlug,
      propertyType: property.propertyType,
      status: property.status,
    })
  );
});

// ── GET /api/v1/properties ────────────────────────────────────────────────────
export const getMyProperties = asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 10 } = req.query;

  const ownerId = req.user.role === "staff" ? req.user.ownerId : req.user.id;
  const filter = { userId: ownerId, isDeleted: false };
  if (status) filter.status = status.toUpperCase();
  if (type)   filter.propertyType = type.toUpperCase();

  const skip = (Number(page) - 1) * Number(limit);

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where: filter,
      select: {
        id: true,
        propertyName: true,
        propertySlug: true,
        propertyType: true,
        status: true,
        totalRooms: true,
        coverImage: true,
        websiteBuilder: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.property.count({ where: filter }),
  ]);

  const formattedProperties = properties.map(p => formatProperty(p));

  res.status(200).json(
    new ApiResponse(200, "Properties retrieved", {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      properties: formattedProperties,
    })
  );
});

// ── GET /api/v1/properties/:id ────────────────────────────────────────────────
export const getProperty = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);
  
  // Exclude sensitive bank and documents fields
  const { bank, documents, ...rest } = property;

  res.status(200).json(new ApiResponse(200, "Property retrieved", formatProperty(rest)));
});

// ── PATCH /api/v1/properties/:id/basic ───────────────────────────────────────
export const updateBasicInfo = asyncHandler(async (req, res) => {
  const {
    propertyName, propertyType, description,
    establishedYear, totalRooms, totalFloors,
    checkInTime, checkOutTime, website,
  } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user.id);
  const data = {};

  if (propertyName) {
    data.propertyName = propertyName;
    data.propertySlug = await generateUniqueSlug(propertyName, property.id);
  }
  if (propertyType) data.propertyType = propertyType;
  if (description !== undefined) data.description = description;
  if (establishedYear) data.establishedYear = Number(establishedYear);
  if (totalRooms !== undefined) data.totalRooms = Number(totalRooms);
  if (totalFloors !== undefined) data.totalFloors = Number(totalFloors);
  if (checkInTime) data.checkInTime = checkInTime;
  if (checkOutTime) data.checkOutTime = checkOutTime;
  if (website !== undefined) data.website = website;

  handleVerificationReupload(property, "propertyDetails", data);

  const updated = await prisma.property.update({
    where: { id: property.id },
    data,
  });

  res.status(200).json(new ApiResponse(200, "Basic info updated", formatProperty(updated)));
});

// ── PATCH /api/v1/properties/:id/address ─────────────────────────────────────
export const updateAddress = asyncHandler(async (req, res) => {
  const { addressLine1, addressLine2, landmark, city, district, state, country, pincode } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user.id);
  
  const address = {
    ...(property.address || {}),
    ...(addressLine1 !== undefined && { addressLine1 }),
    ...(addressLine2 !== undefined && { addressLine2 }),
    ...(landmark     !== undefined && { landmark }),
    ...(city         !== undefined && { city }),
    ...(district     !== undefined && { district }),
    ...(state        !== undefined && { state }),
    ...(country      !== undefined && { country }),
    ...(pincode      !== undefined && { pincode }),
  };

  const data = { address };
  handleVerificationReupload(property, "address", data);

  const updated = await prisma.property.update({
    where: { id: property.id },
    data,
  });

  res.status(200).json(new ApiResponse(200, "Address updated", updated.address));
});

// ── PATCH /api/v1/properties/:id/location ────────────────────────────────────
export const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, googleMapUrl } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user.id);

  const location = {
    ...(property.location || {}),
  };
  if (latitude !== undefined) location.latitude = Number(latitude);
  if (longitude !== undefined) location.longitude = Number(longitude);
  if (googleMapUrl !== undefined) location.googleMapUrl = googleMapUrl;

  const data = { location };
  handleVerificationReupload(property, "location", data);

  const updated = await prisma.property.update({
    where: { id: property.id },
    data,
  });

  res.status(200).json(new ApiResponse(200, "Location updated", updated.location));
});

// ── PATCH /api/v1/properties/:id/contact ─────────────────────────────────────
export const updateContact = asyncHandler(async (req, res) => {
  const { primaryPhone, secondaryPhone, whatsapp, email, reservationEmail } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user.id);

  const contact = {
    ...(property.contact || {}),
    ...(primaryPhone      !== undefined && { primaryPhone }),
    ...(secondaryPhone    !== undefined && { secondaryPhone }),
    ...(whatsapp          !== undefined && { whatsapp }),
    ...(email             !== undefined && { email }),
    ...(reservationEmail  !== undefined && { reservationEmail }),
  };

  const data = { contact };
  handleVerificationReupload(property, "contact", data);

  const updated = await prisma.property.update({
    where: { id: property.id },
    data,
  });

  res.status(200).json(new ApiResponse(200, "Contact updated", updated.contact));
});

// ── PATCH /api/v1/properties/:id/media ───────────────────────────────────────
export const updateMedia = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);

  const logoFile       = req.files?.logo?.[0];
  const coverImageFile = req.files?.coverImage?.[0];
  const galleryFiles   = req.files?.gallery;

  const data = {};
  if (logoFile) {
    data.logo = logoFile.buffer;
    data.logoMimeType = logoFile.mimetype;
  }
  if (coverImageFile) {
    data.coverImage = coverImageFile.buffer;
    data.coverImageMimeType = coverImageFile.mimetype;
  }

  if (Object.keys(data).length > 0) {
    await prisma.property.update({
      where: { id: property.id },
      data,
    });
  }

  if (galleryFiles && galleryFiles.length > 0) {
    for (const file of galleryFiles) {
      await prisma.propertyGalleryImage.create({
        data: {
          propertyId: property.id,
          data: file.buffer,
          mimeType: file.mimetype,
          title: "",
          description: "",
        },
      });
    }
  }

  // Refetch to return populated URLs
  const updatedProperty = await prisma.property.findUnique({
    where: { id: property.id },
    include: { gallery: true },
  });

  res.status(200).json(
    new ApiResponse(200, "Media updated", formatProperty(updatedProperty))
  );
});

// ── DELETE /api/v1/properties/:id/gallery/:index ─────────────────────────────
export const removeGalleryImage = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);
  const index = Number(req.params.index);

  const galleryImages = await prisma.propertyGalleryImage.findMany({
    where: { propertyId: property.id },
    orderBy: { id: "asc" },
  });

  if (isNaN(index) || index < 0 || index >= galleryImages.length) {
    throw new ApiError(400, "Invalid gallery image index");
  }

  const targetImage = galleryImages[index];

  await prisma.propertyGalleryImage.delete({
    where: { id: targetImage.id },
  });

  const updatedImages = await prisma.propertyGalleryImage.findMany({
    where: { propertyId: property.id },
    orderBy: { id: "asc" },
  });

  res.status(200).json(
    new ApiResponse(200, "Gallery image removed", {
      gallery: updatedImages.map((img) => ({
        _id: img.id,
        id: img.id,
        url: `/api/v1/properties/gallery/${img.id}`,
        title: img.title || "",
        description: img.description || "",
      })),
    })
  );
});

// ── PATCH /api/v1/properties/:id/gallery/:index ──────────────────────────────
export const updateGalleryImage = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);
  const index = Number(req.params.index);
  const { title, description } = req.body;

  const galleryImages = await prisma.propertyGalleryImage.findMany({
    where: { propertyId: property.id },
    orderBy: { id: "asc" },
  });

  if (isNaN(index) || index < 0 || index >= galleryImages.length) {
    throw new ApiError(400, "Invalid gallery image index");
  }

  const targetImage = galleryImages[index];

  const updatedImage = await prisma.propertyGalleryImage.update({
    where: { id: targetImage.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
    },
  });

  res.status(200).json(new ApiResponse(200, "Gallery image updated", {
    _id: updatedImage.id,
    id: updatedImage.id,
    url: `/api/v1/properties/gallery/${updatedImage.id}`,
    title: updatedImage.title || "",
    description: updatedImage.description || "",
  }));
});
// ── PATCH /api/v1/properties/:id/bank ────────────────────────────────────────
export const updateBank = asyncHandler(async (req, res) => {
  const {
    accountHolderName, bankName, accountNumber,
    ifscCode, branch, upiId, gstNumber,
  } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user.id);

  const cancelledCheque = fileToBase64(req.files, "cancelledCheque");
  const panCard         = fileToBase64(req.files, "panCard");

  const bank = {
    ...(property.bank || {}),
    ...(accountHolderName !== undefined && { accountHolderName }),
    ...(bankName          !== undefined && { bankName }),
    ...(accountNumber     !== undefined && { accountNumber }),
    ...(ifscCode          !== undefined && { ifscCode }),
    ...(branch            !== undefined && { branch }),
    ...(upiId             !== undefined && { upiId }),
    ...(gstNumber         !== undefined && { gstNumber }),
    ...(cancelledCheque                 && { cancelledCheque }),
    ...(panCard                         && { panCard }),
  };

  await prisma.property.update({
    where: { id: property.id },
    data: { bank },
  });

  res.status(200).json(new ApiResponse(200, "Bank details updated"));
});

// ── PATCH /api/v1/properties/:id/documents ───────────────────────────────────
export const updateDocuments = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);

  const FIELDS = ["ownerPhoto", "ownerIdProof", "propertyLicense", "gstCertificate", "panCard", "cancelledCheque"];

  const updates = {};
  FIELDS.forEach((field) => {
    const dataUri = fileToBase64(req.files, field);
    if (dataUri) updates[field] = dataUri;
  });

  if (!Object.keys(updates).length) {
    throw new ApiError(400, "No document files were uploaded");
  }

  const documents = { ...(property.documents || {}), ...updates };
  const data = { documents };

  handleVerificationReupload(property, "ownerDetails", data);

  await prisma.property.update({
    where: { id: property.id },
    data,
  });

  res.status(200).json(new ApiResponse(200, "Documents updated"));
});

// ── PATCH /api/v1/properties/:id/policies ────────────────────────────────────
export const updatePolicies = asyncHandler(async (req, res) => {
  const { cancellationPolicy, childPolicy, petPolicy, smokingPolicy, checkInInstructions } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user.id);

  const policies = {
    ...(property.policies || {}),
    ...(cancellationPolicy   !== undefined && { cancellationPolicy }),
    ...(childPolicy          !== undefined && { childPolicy }),
    ...(petPolicy            !== undefined && { petPolicy }),
    ...(smokingPolicy        !== undefined && { smokingPolicy }),
    ...(checkInInstructions  !== undefined && { checkInInstructions }),
  };

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: { policies },
  });

  res.status(200).json(new ApiResponse(200, "Policies updated", updated.policies));
});

// ── POST /api/v1/properties/:id/amenities ────────────────────────────────────
export const addAmenity = asyncHandler(async (req, res) => {
  const { name, icon } = req.body;
  if (!name) throw new ApiError(400, "Amenity name is required");

  const property = await findOwnedProperty(req.params.id, req.user.id);

  const amenities = [...(property.amenities || [])];
  const newAmenity = { _id: generateId(), name, icon };
  amenities.push(newAmenity);

  await prisma.property.update({
    where: { id: property.id },
    data: { amenities },
  });

  res.status(201).json(new ApiResponse(201, "Amenity added", newAmenity));
});

// ── DELETE /api/v1/properties/:id/amenities/:amenityId ───────────────────────
export const removeAmenity = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);

  const before = property.amenities.length;
  const filtered = property.amenities.filter(
    (a) => a._id?.toString() !== req.params.amenityId && a.id?.toString() !== req.params.amenityId
  );

  if (filtered.length === before) {
    throw new ApiError(404, "Amenity not found");
  }

  await prisma.property.update({
    where: { id: property.id },
    data: { amenities: filtered },
  });

  res.status(200).json(new ApiResponse(200, "Amenity removed"));
});

// ── POST /api/v1/properties/:id/submit ───────────────────────────────────────
export const submitForApproval = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);

  const SUBMITTABLE = ["DRAFT", "REJECTED"];
  if (!SUBMITTABLE.includes(property.status)) {
    throw new ApiError(
      400,
      `Cannot submit a property with status "${property.status}". Only DRAFT or REJECTED properties can be submitted.`
    );
  }

  // Minimal completeness check before submission
  const requiredFields = ["propertyName", "propertyType"];
  const missing = requiredFields.filter((f) => !property[f]);
  if (missing.length) {
    throw new ApiError(400, `Cannot submit: missing required fields — ${missing.join(", ")}`);
  }

  const status = property.status === "REJECTED" ? "REUPLOADED" : "PENDING";

  const updated = await prisma.property.update({
    where: { id: property.id },
    data: { status },
  });

  res.status(200).json(
    new ApiResponse(200, `Property submitted for review (status: ${updated.status})`, {
      id: updated.id,
      status: updated.status,
    })
  );
});

// ── DELETE /api/v1/properties/:id ────────────────────────────────────────────
export const deleteProperty = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);

  const DELETABLE = ["DRAFT", "REJECTED", "SUSPENDED"];
  if (!DELETABLE.includes(property.status)) {
    throw new ApiError(
      400,
      `Cannot delete a property with status "${property.status}"`
    );
  }

  await prisma.property.update({
    where: { id: property.id },
    data: { isDeleted: true },
  });

  res.status(200).json(new ApiResponse(200, "Property deleted"));
});

// ── GET /api/v1/properties/:id/is-verified ───────────────────────────────────
export const checkPropertyVerified = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);
  
  res.status(200).json(
    new ApiResponse(200, "Verification status retrieved", {
      isVerified: property.status === "APPROVED",
    })
  );
});

// ── GET /api/v1/properties/:id/verification-details ──────────────────────────
export const getVerificationDetails = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user.id);

  res.status(200).json(
    new ApiResponse(200, "Verification details retrieved", {
      status: property.status,
      rejectionReason: property.rejectionReason,
      verification: property.verification,
    })
  );
});

// ── GET /api/v1/properties/:id/logo ──────────────────────────────────────────
export const getPropertyLogo = asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: Number(req.params.id) },
    select: { logo: true, logoMimeType: true },
  });

  if (!property || !property.logo) {
    throw new ApiError(404, "Logo not found");
  }

  res.set("Content-Type", property.logoMimeType || "image/jpeg");
  res.send(property.logo);
});

// ── GET /api/v1/properties/:id/cover ─────────────────────────────────────────
export const getPropertyCover = asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: Number(req.params.id) },
    select: { coverImage: true, coverImageMimeType: true },
  });

  if (!property || !property.coverImage) {
    throw new ApiError(404, "Cover image not found");
  }

  res.set("Content-Type", property.coverImageMimeType || "image/jpeg");
  res.send(property.coverImage);
});

// ── GET /api/v1/properties/gallery/:id ───────────────────────────────────────
export const getGalleryImage = asyncHandler(async (req, res) => {
  const image = await prisma.propertyGalleryImage.findUnique({
    where: { id: Number(req.params.id) },
  });

  if (!image) {
    throw new ApiError(404, "Image not found");
  }

  res.set("Content-Type", image.mimeType);
  res.send(image.data);
});

// ── Bookings ──────────────────────────────────────────────────────────────────
export const getBookings = asyncHandler(async (req, res) => {
  const propertyId = parseInt(req.params.id);
  const ownerId = req.user.role === "staff" ? req.user.ownerId : req.user.id;
  const { search, status, paymentStatus, startDate, endDate, page = 1, limit = 10, phone } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: ownerId, isDeleted: false },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  const whereClause = { propertyId };

  if (status) {
    whereClause.status = status;
  }

  if (paymentStatus) {
    whereClause.paymentStatus = paymentStatus;
  }
  
  if (phone) {
    whereClause.guestPhone = phone;
  }

  const { roomId, date } = req.query;
  if (roomId) {
    whereClause.roomId = parseInt(roomId);
  }

  if (date) {
    const targetDate = new Date(date);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    whereClause.checkInDate = { lte: targetDate };
    whereClause.checkOutDate = { gt: targetDate };
  } else if (startDate || endDate) {
    whereClause.checkInDate = {};
    if (startDate) {
      whereClause.checkInDate.gte = new Date(startDate);
    }
    if (endDate) {
      whereClause.checkInDate.lte = new Date(endDate);
    }
  }

  if (search) {
    whereClause.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { guestPhone: { contains: search, mode: "insensitive" } },
      { bookingRef: { contains: search, mode: "insensitive" } },
      { ticketId: { contains: search, mode: "insensitive" } }
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: whereClause,
      include: {
        room: { select: { name: true } },
        package: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum
    }),
    prisma.booking.count({ where: whereClause })
  ]);

  res.status(200).json(
    new ApiResponse(200, "Bookings retrieved successfully", {
      bookings,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum
    })
  );
});

// ── Customers ─────────────────────────────────────────────────────────────────
export const getCustomers = asyncHandler(async (req, res) => {
  const propertyId = parseInt(req.params.id);
  const ownerId = req.user.role === "staff" ? req.user.ownerId : req.user.id;
  const { search, page = 1, limit = 10 } = req.query;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: ownerId, isDeleted: false },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const whereClause = { propertyId };

  if (search) {
    whereClause.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { guestPhone: { contains: search, mode: "insensitive" } },
      { guestEmail: { contains: search, mode: "insensitive" } }
    ];
  }

  const groupedCustomers = await prisma.booking.groupBy({
    by: ['guestPhone', 'guestEmail', 'guestName'],
    where: whereClause,
    _count: { id: true },
    _sum: { totalAmount: true },
    _max: { createdAt: true },
    orderBy: {
      _max: {
        createdAt: 'desc'
      }
    }
  });

  const total = groupedCustomers.length;
  
  const paginatedCustomers = groupedCustomers.slice(skip, skip + limitNum).map(c => ({
    name: c.guestName,
    email: c.guestEmail,
    phone: c.guestPhone,
    totalBookings: c._count.id,
    totalSpent: c._sum.totalAmount,
    lastBookingDate: c._max.createdAt
  }));

  res.status(200).json(
    new ApiResponse(200, "Customers retrieved successfully", {
      customers: paginatedCustomers,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum
    })
  );
});

// ── Reviews ───────────────────────────────────────────────────────────────────
export const getReviews = asyncHandler(async (req, res) => {
  const propertyId = parseInt(req.params.id);
  const ownerId = req.user.role === "staff" ? req.user.ownerId : req.user.id;
  const { search, rating, page = 1, limit = 10 } = req.query;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: ownerId, isDeleted: false },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const whereClause = { propertyId };

  if (rating) {
    whereClause.rating = parseInt(rating);
  }

  if (search) {
    whereClause.OR = [
      { guestName: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { comment: { contains: search, mode: "insensitive" } }
    ];
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: whereClause,
      include: {
        booking: {
          select: { bookingRef: true, checkInDate: true, checkOutDate: true }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNum
    }),
    prisma.review.count({ where: whereClause })
  ]);

  res.status(200).json(
    new ApiResponse(200, "Reviews retrieved successfully", {
      reviews,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum
    })
  );
});

// ── Reports ───────────────────────────────────────────────────────────────────
export const getReports = asyncHandler(async (req, res) => {
  const propertyId = parseInt(req.params.id);
  const ownerId = req.user.role === "staff" ? req.user.ownerId : req.user.id;
  const { period = "30" } = req.query; // days: 7, 30, 90, 365

  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: ownerId, isDeleted: false },
  });

  if (!property) throw new ApiError(404, "Property not found");

  const days = parseInt(period);
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const prevStart = new Date(startDate);
  prevStart.setDate(prevStart.getDate() - days);

  const baseWhere = {
    propertyId,
    createdAt: { gte: startDate }
  };
  const prevWhere = {
    propertyId,
    createdAt: { gte: prevStart, lt: startDate }
  };

  // Parallel fetches
  const [
    currentBookings,
    prevBookings,
    reviewStats,
    statusBreakdown,
    paymentBreakdown,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: baseWhere,
      select: { totalAmount: true, status: true, paymentStatus: true, checkInDate: true, createdAt: true }
    }),
    prisma.booking.aggregate({
      where: prevWhere,
      _count: { id: true },
      _sum: { totalAmount: true }
    }),
    prisma.review.aggregate({
      where: { propertyId },
      _avg: { rating: true },
      _count: { id: true }
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { id: true }
    }),
    prisma.booking.groupBy({
      by: ["paymentStatus"],
      where: baseWhere,
      _count: { id: true }
    }),
  ]);

  const totalRevenue = currentBookings.reduce((s, b) => s + Number(b.totalAmount), 0);
  const totalBookings = currentBookings.length;
  const prevRevenue = Number(prevBookings._sum.totalAmount ?? 0);
  const prevCount = prevBookings._count.id;

  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const bookingChange = prevCount > 0 ? ((totalBookings - prevCount) / prevCount) * 100 : 0;

  // Monthly trend grouped by month
  const trendMap = new Map();
  for (const b of currentBookings) {
    const key = new Date(b.createdAt).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    if (!trendMap.has(key)) trendMap.set(key, { month: key, revenue: 0, bookings: 0 });
    const entry = trendMap.get(key);
    entry.revenue += Number(b.totalAmount);
    entry.bookings += 1;
  }
  const trend = Array.from(trendMap.values());

  res.status(200).json(
    new ApiResponse(200, "Report retrieved successfully", {
      period: days,
      summary: {
        totalRevenue,
        totalBookings,
        avgRating: reviewStats._avg.rating ? Number(reviewStats._avg.rating).toFixed(1) : null,
        totalReviews: reviewStats._count.id,
        revenueChange: revenueChange.toFixed(1),
        bookingChange: bookingChange.toFixed(1),
      },
      statusBreakdown,
      paymentBreakdown,
      trend,
    })
  );
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard = asyncHandler(async (req, res) => {
  const propertyId = parseInt(req.params.id);
  const ownerId = req.user.role === "staff" ? req.user.ownerId : req.user.id;

  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: ownerId, isDeleted: false },
    select: { id: true, propertyName: true }
  });
  if (!property) throw new ApiError(404, "Property not found");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last30Start = new Date(today);
  last30Start.setDate(last30Start.getDate() - 29);

  const prev30Start = new Date(last30Start);
  prev30Start.setDate(prev30Start.getDate() - 30);

  const [
    todayBookings,
    yesterdayBookings,
    pendingCheckIns,
    pendingCheckOuts,
    recentBookings,
    last30,
    prev30,
    walletData,
    reviewStats,
    statusBreakdown,
  ] = await Promise.all([
    // Today's bookings & revenue
    prisma.booking.findMany({
      where: { propertyId, createdAt: { gte: today, lte: todayEnd } },
      select: { totalAmount: true }
    }),
    // Yesterday's bookings
    prisma.booking.findMany({
      where: { propertyId, createdAt: { gte: yesterday, lt: today } },
      select: { totalAmount: true }
    }),
    // Pending check-ins (check-in date = today, not checked in yet)
    prisma.booking.count({
      where: { propertyId, checkInDate: { gte: today, lte: todayEnd }, status: "CONFIRMED" }
    }),
    // Pending check-outs (check-out date = today, still checked in)
    prisma.booking.count({
      where: { propertyId, checkOutDate: { gte: today, lte: todayEnd }, status: "CHECKED_IN" }
    }),
    // 5 most recent bookings
    prisma.booking.findMany({
      where: { propertyId },
      include: { room: { select: { name: true } }, package: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    // Last 30 days aggregates
    prisma.booking.aggregate({
      where: { propertyId, createdAt: { gte: last30Start } },
      _sum: { totalAmount: true },
      _count: { id: true }
    }),
    // Previous 30 days aggregates
    prisma.booking.aggregate({
      where: { propertyId, createdAt: { gte: prev30Start, lt: last30Start } },
      _sum: { totalAmount: true },
      _count: { id: true }
    }),
    // Wallet
    prisma.wallet.findUnique({ where: { userId: ownerId }, select: { balance: true } }),
    // Reviews
    prisma.review.aggregate({
      where: { propertyId },
      _avg: { rating: true },
      _count: { id: true }
    }),
    // Status breakdown (all time)
    prisma.booking.groupBy({
      by: ['status'],
      where: { propertyId },
      _count: { id: true }
    }),
  ]);

  // 30-day revenue trend grouped by day
  const allLast30 = await prisma.booking.findMany({
    where: { propertyId, createdAt: { gte: last30Start } },
    select: { totalAmount: true, createdAt: true }
  });
  const trendMap = new Map();
  for (let i = 0; i < 30; i++) {
    const d = new Date(last30Start);
    d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    trendMap.set(key, { date: key, revenue: 0, bookings: 0 });
  }
  for (const b of allLast30) {
    const key = new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    if (trendMap.has(key)) {
      const entry = trendMap.get(key);
      entry.revenue += Number(b.totalAmount);
      entry.bookings += 1;
    }
  }
  const trend = Array.from(trendMap.values());

  const todayRev = todayBookings.reduce((s, b) => s + Number(b.totalAmount), 0);
  const yesterdayRev = yesterdayBookings.reduce((s, b) => s + Number(b.totalAmount), 0);
  const prevRevenue = Number(prev30._sum.totalAmount ?? 0);
  const currRevenue = Number(last30._sum.totalAmount ?? 0);

  res.status(200).json(
    new ApiResponse(200, "Dashboard data retrieved", {
      property: { id: property.id, name: property.propertyName },
      stats: {
        todayBookings: todayBookings.length,
        todayRevenue: todayRev,
        todayBookingsDelta: yesterdayBookings.length > 0 ? (((todayBookings.length - yesterdayBookings.length) / yesterdayBookings.length) * 100).toFixed(0) : 0,
        todayRevenueDelta: yesterdayRev > 0 ? (((todayRev - yesterdayRev) / yesterdayRev) * 100).toFixed(0) : 0,
        pendingCheckIns,
        pendingCheckOuts,
        walletBalance: Number(walletData?.balance ?? 0),
        avgRating: reviewStats._avg.rating ? Number(reviewStats._avg.rating).toFixed(1) : null,
        totalReviews: reviewStats._count.id,
        last30Revenue: currRevenue,
        last30Bookings: last30._count.id,
        revenueChange: prevRevenue > 0 ? (((currRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : "0",
      },
      recentBookings,
      trend,
      statusBreakdown: statusBreakdown.map((item) => ({
        status: item.status,
        count: item._count.id
      }))
    })
  );
});

// ── GET /api/v1/properties/bookings/verify/:bookingRef ─────────────────────────
export const verifyBookingDetails = asyncHandler(async (req, res) => {
  const { bookingRef } = req.params;
  const currentUserId = req.user.id;
  const currentUserRole = req.user.role;
  const ownerId = currentUserRole === "staff" ? req.user.ownerId : currentUserId;

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [
        { bookingRef },
        { ticketId: bookingRef }
      ]
    },
    include: {
      property: true,
      room: true,
      package: true,
    }
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  // Security check
  if (booking.property.userId !== ownerId) {
    throw new ApiError(403, "Unauthorized: This booking belongs to another property");
  }

  res.status(200).json(
    new ApiResponse(200, "Booking details retrieved successfully", booking)
  );
});

// ── PATCH /api/v1/properties/bookings/:id/status ──────────────────────────────
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id);
  const { status } = req.body;
  const currentUserId = req.user.id;
  const currentUserRole = req.user.role;
  const ownerId = currentUserRole === "staff" ? req.user.ownerId : currentUserId;

  if (!status) {
    throw new ApiError(400, "Status is required");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: true }
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.property.userId !== ownerId) {
    throw new ApiError(403, "Unauthorized: This booking belongs to another property");
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status }
  });

  res.status(200).json(
    new ApiResponse(200, `Booking status updated to ${status} successfully`, updatedBooking)
  );
});

export const sendPaymentLink = asyncHandler(async (req, res) => {
  const { id } = req.params; // booking id
  const currentUserId = req.user.id;
  const currentUserRole = req.user.role;
  const ownerId = currentUserRole === "staff" ? req.user.ownerId : currentUserId;

  const booking = await prisma.booking.findUnique({
    where: { id: Number(id) },
    include: { property: true }
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.property.userId !== ownerId) {
    throw new ApiError(403, "Unauthorized: This booking belongs to another property");
  }

  if (booking.paymentStatus === "PAID") {
    throw new ApiError(400, "Booking is already paid");
  }

  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "dummy_key_id";
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "dummy_secret";

  if (RAZORPAY_KEY_ID === "dummy_key_id") {
    // For local dev without real credentials, return a dummy link
    return res.status(200).json(
      new ApiResponse(200, "Payment link generated (dummy)", {
        short_url: "https://razorpay.me/dummy-link"
      })
    );
  }

  const razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });

  // Check if we already created an order for this booking
  const amountToCharge = Math.round(Number(booking.totalAmount) * 100);

  let paymentLink;
  try {
    let contact = booking.guestPhone;
    if (contact && contact.length === 10 && !contact.startsWith('+')) {
      contact = '+91' + contact;
    }
    
    paymentLink = await razorpay.paymentLink.create({
      amount: amountToCharge,
      currency: "INR",
      accept_partial: false,
      description: `Payment for Booking ${booking.bookingRef}`,
      reference_id: booking.bookingRef,
      customer: {
        name: booking.guestName,
        contact: contact,
        email: booking.guestEmail || undefined,
      },
      notify: {
        sms: true,
        email: !!booking.guestEmail,
      },
      reminder_enable: true,
      callback_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/booking/${booking.bookingRef}/success`,
      callback_method: "get"
    });
  } catch (error) {
    console.error("Razorpay Error:", error);
    throw new ApiError(
      error.statusCode || 400,
      error.error?.description || error.message || "Failed to create payment link"
    );
  }

  res.status(200).json(
    new ApiResponse(200, "Payment link generated successfully", {
      short_url: paymentLink.short_url,
      id: paymentLink.id,
    })
  );
});
