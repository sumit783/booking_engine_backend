import Property from "../../models/property/property.model.js";
import User from "../../models/authentication/user.model.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { fileUrl, fileUrls } from "../../middleware/upload.middleware.js";

// ── Helper: handle verification re-uploads ─────────────────────────────────────
const handleVerificationReupload = (property, section) => {
  if (property.verification && property.verification[section]?.status === "REJECTED") {
    property.verification[section].status = "REUPLOADED";
    if (property.status === "REJECTED") {
      property.status = "REUPLOADED";
    }
  }
};

// ── Helper: load property that belongs to the requesting owner ────────────────
const findOwnedProperty = async (propertyId, userId) => {
  const property = await Property.findOne({
    _id: propertyId,
    userId,
    isDeleted: false,
  });
  if (!property) throw new ApiError(404, "Property not found or access denied");
  return property;
};

// ── POST /api/v1/properties ───────────────────────────────────────────────────
// Create a new property (DRAFT status). Only basic info required.
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

  const property = await Property.create({
    userId: req.user._id,
    propertyName,
    propertyType,
    description,
    establishedYear,
    totalRooms,
    totalFloors,
    checkInTime,
    checkOutTime,
    website,
    status: "DRAFT",
  });

  // Push property ref onto the owner document
  await User.findByIdAndUpdate(req.user._id, {
    $addToSet: { properties: property._id },
  });

  res.status(201).json(
    new ApiResponse(201, "Property created", {
      id: property._id,
      propertyName: property.propertyName,
      propertySlug: property.propertySlug,
      propertyType: property.propertyType,
      status: property.status,
    })
  );
});

// ── GET /api/v1/properties ────────────────────────────────────────────────────
// List all properties belonging to the authenticated owner.
export const getMyProperties = asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 10 } = req.query;

  const filter = { userId: req.user._id, isDeleted: false };
  if (status) filter.status = status.toUpperCase();
  if (type)   filter.propertyType = type.toUpperCase();

  const skip = (Number(page) - 1) * Number(limit);

  const [properties, total] = await Promise.all([
    Property.find(filter)
      .select("propertyName propertySlug propertyType status totalRooms coverImage createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Property.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Properties retrieved", {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      properties,
    })
  );
});

// ── GET /api/v1/properties/:id ────────────────────────────────────────────────
// Get a single property (full detail, without sensitive bank/documents).
export const getProperty = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);
  res.status(200).json(new ApiResponse(200, "Property retrieved", property));
});

// ── PATCH /api/v1/properties/:id/basic ───────────────────────────────────────
// Update basic information fields.
export const updateBasicInfo = asyncHandler(async (req, res) => {
  const {
    propertyName, propertyType, description,
    establishedYear, totalRooms, totalFloors,
    checkInTime, checkOutTime, website,
  } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user._id);

  if (propertyName)    property.propertyName    = propertyName;
  if (propertyType)    property.propertyType    = propertyType;
  if (description !== undefined) property.description = description;
  if (establishedYear) property.establishedYear = Number(establishedYear);
  if (totalRooms !== undefined)  property.totalRooms  = Number(totalRooms);
  if (totalFloors !== undefined) property.totalFloors = Number(totalFloors);
  if (checkInTime)     property.checkInTime     = checkInTime;
  if (checkOutTime)    property.checkOutTime    = checkOutTime;
  if (website !== undefined) property.website   = website;

  handleVerificationReupload(property, "propertyDetails");

  await property.save();
  res.status(200).json(new ApiResponse(200, "Basic info updated", property));
});

// ── PATCH /api/v1/properties/:id/address ─────────────────────────────────────
export const updateAddress = asyncHandler(async (req, res) => {
  const { addressLine1, addressLine2, landmark, city, district, state, country, pincode } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user._id);

  property.address = {
    ...property.address.toObject(),
    ...(addressLine1 !== undefined && { addressLine1 }),
    ...(addressLine2 !== undefined && { addressLine2 }),
    ...(landmark     !== undefined && { landmark }),
    ...(city         !== undefined && { city }),
    ...(district     !== undefined && { district }),
    ...(state        !== undefined && { state }),
    ...(country      !== undefined && { country }),
    ...(pincode      !== undefined && { pincode }),
  };

  handleVerificationReupload(property, "address");

  await property.save();
  res.status(200).json(new ApiResponse(200, "Address updated", property.address));
});

// ── PATCH /api/v1/properties/:id/location ────────────────────────────────────
export const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, googleMapUrl } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user._id);

  if (latitude    !== undefined) property.location.latitude    = Number(latitude);
  if (longitude   !== undefined) property.location.longitude   = Number(longitude);
  if (googleMapUrl !== undefined) property.location.googleMapUrl = googleMapUrl;

  handleVerificationReupload(property, "location");

  await property.save();
  res.status(200).json(new ApiResponse(200, "Location updated", property.location));
});

// ── PATCH /api/v1/properties/:id/contact ─────────────────────────────────────
export const updateContact = asyncHandler(async (req, res) => {
  const { primaryPhone, secondaryPhone, whatsapp, email, reservationEmail } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user._id);

  property.contact = {
    ...property.contact.toObject(),
    ...(primaryPhone      !== undefined && { primaryPhone }),
    ...(secondaryPhone    !== undefined && { secondaryPhone }),
    ...(whatsapp          !== undefined && { whatsapp }),
    ...(email             !== undefined && { email }),
    ...(reservationEmail  !== undefined && { reservationEmail }),
  };

  handleVerificationReupload(property, "contact");

  await property.save();
  res.status(200).json(new ApiResponse(200, "Contact updated", property.contact));
});

// ── PATCH /api/v1/properties/:id/media ───────────────────────────────────────
// Accepts multipart/form-data with optional fields: logo, coverImage, gallery
export const updateMedia = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);

  const logo       = fileUrl(req.files, "logo");
  const coverImage = fileUrl(req.files, "coverImage");
  const gallery    = fileUrls(req.files, "gallery");

  if (logo)        property.logo        = logo;
  if (coverImage)  property.coverImage  = coverImage;
  if (gallery) {
    const newGalleryItems = gallery.map((url) => ({ url, title: "", description: "" }));
    property.gallery = [...(property.gallery || []), ...newGalleryItems];
  }

  await property.save();
  res.status(200).json(
    new ApiResponse(200, "Media updated", {
      logo:        property.logo,
      coverImage:  property.coverImage,
      gallery:     property.gallery,
    })
  );
});

// ── DELETE /api/v1/properties/:id/gallery/:index ─────────────────────────────
// Remove a single gallery image by its array index.
export const removeGalleryImage = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);
  const index = Number(req.params.index);

  if (isNaN(index) || index < 0 || index >= property.gallery.length) {
    throw new ApiError(400, "Invalid gallery image index");
  }

  property.gallery.splice(index, 1);
  await property.save();
  res.status(200).json(new ApiResponse(200, "Gallery image removed", { gallery: property.gallery }));
});

// ── PATCH /api/v1/properties/:id/gallery/:index ──────────────────────────────
// Update title and description of a single gallery image
export const updateGalleryImage = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);
  const index = Number(req.params.index);
  const { title, description } = req.body;

  if (isNaN(index) || index < 0 || index >= property.gallery.length) {
    throw new ApiError(400, "Invalid gallery image index");
  }

  if (title !== undefined) property.gallery[index].title = title;
  if (description !== undefined) property.gallery[index].description = description;

  await property.save();
  res.status(200).json(new ApiResponse(200, "Gallery image updated", { gallery: property.gallery }));
});

// ── PATCH /api/v1/properties/:id/bank ────────────────────────────────────────
// Accepts multipart/form-data: text fields + optional cancelledCheque, panCard files
export const updateBank = asyncHandler(async (req, res) => {
  const {
    accountHolderName, bankName, accountNumber,
    ifscCode, branch, upiId, gstNumber,
  } = req.body;

  // Fetch WITH sensitive bank field
  const property = await Property.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  }).select("+bank");

  if (!property) throw new ApiError(404, "Property not found or access denied");

  const cancelledCheque = fileUrl(req.files, "cancelledCheque");
  const panCard         = fileUrl(req.files, "panCard");

  property.bank = {
    ...property.bank?.toObject(),
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

  await property.save();
  res.status(200).json(new ApiResponse(200, "Bank details updated"));
});

// ── PATCH /api/v1/properties/:id/documents ───────────────────────────────────
// Accepts multipart/form-data: owner / property document uploads
export const updateDocuments = asyncHandler(async (req, res) => {
  // Fetch WITH sensitive documents field
  const property = await Property.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: false,
  }).select("+documents");

  if (!property) throw new ApiError(404, "Property not found or access denied");

  const FIELDS = ["ownerPhoto", "ownerIdProof", "propertyLicense", "gstCertificate", "panCard", "cancelledCheque"];

  const updates = {};
  FIELDS.forEach((field) => {
    const url = fileUrl(req.files, field);
    if (url) updates[field] = url;
  });

  if (!Object.keys(updates).length) {
    throw new ApiError(400, "No document files were uploaded");
  }

  property.documents = { ...property.documents?.toObject(), ...updates };
  handleVerificationReupload(property, "ownerDetails");
  await property.save();

  res.status(200).json(new ApiResponse(200, "Documents updated"));
});

// ── PATCH /api/v1/properties/:id/policies ────────────────────────────────────
export const updatePolicies = asyncHandler(async (req, res) => {
  const { cancellationPolicy, childPolicy, petPolicy, smokingPolicy, checkInInstructions } = req.body;

  const property = await findOwnedProperty(req.params.id, req.user._id);

  property.policies = {
    ...property.policies.toObject(),
    ...(cancellationPolicy   !== undefined && { cancellationPolicy }),
    ...(childPolicy          !== undefined && { childPolicy }),
    ...(petPolicy            !== undefined && { petPolicy }),
    ...(smokingPolicy        !== undefined && { smokingPolicy }),
    ...(checkInInstructions  !== undefined && { checkInInstructions }),
  };

  await property.save();
  res.status(200).json(new ApiResponse(200, "Policies updated", property.policies));
});

// ── POST /api/v1/properties/:id/amenities ────────────────────────────────────
// Add a single amenity.
export const addAmenity = asyncHandler(async (req, res) => {
  const { name, icon } = req.body;
  if (!name) throw new ApiError(400, "Amenity name is required");

  const property = await findOwnedProperty(req.params.id, req.user._id);

  property.amenities.push({ name, icon });
  await property.save();

  const added = property.amenities[property.amenities.length - 1];
  res.status(201).json(new ApiResponse(201, "Amenity added", added));
});

// ── DELETE /api/v1/properties/:id/amenities/:amenityId ───────────────────────
// Remove an amenity by its subdocument _id.
export const removeAmenity = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);

  const before = property.amenities.length;
  property.amenities = property.amenities.filter(
    (a) => a._id.toString() !== req.params.amenityId
  );

  if (property.amenities.length === before) {
    throw new ApiError(404, "Amenity not found");
  }

  await property.save();
  res.status(200).json(new ApiResponse(200, "Amenity removed"));
});

// ── POST /api/v1/properties/:id/submit ───────────────────────────────────────
// Submit property for admin review.
export const submitForApproval = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);

  const SUBMITTABLE = ["DRAFT", "REJECTED"];
  if (!SUBMITTABLE.includes(property.status)) {
    throw new ApiError(
      400,
      `Cannot submit a property with status "${property.status}". Only DRAFT or REJECTED properties can be submitted.`
    );
  }

  // Minimal completeness check before submission
  const requiredFields = ["propertyName", "propertyType", "address"];
  const missing = requiredFields.filter((f) => !property[f]);
  if (missing.length) {
    throw new ApiError(400, `Cannot submit: missing required fields — ${missing.join(", ")}`);
  }

  property.status = property.status === "REJECTED" ? "REUPLOADED" : "PENDING";
  await property.save();

  res.status(200).json(
    new ApiResponse(200, `Property submitted for review (status: ${property.status})`, {
      id: property._id,
      status: property.status,
    })
  );
});

// ── DELETE /api/v1/properties/:id ────────────────────────────────────────────
// Soft-delete a property (only DRAFT or REJECTED or SUSPENDED can be deleted by owner).
export const deleteProperty = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);

  const DELETABLE = ["DRAFT", "REJECTED", "SUSPENDED"];
  if (!DELETABLE.includes(property.status)) {
    throw new ApiError(
      400,
      `Cannot delete a property with status "${property.status}"`
    );
  }

  property.isDeleted = true;
  await property.save();

  // Remove from owner's properties array
  await User.findByIdAndUpdate(req.user._id, {
    $pull: { properties: property._id },
  });

  res.status(200).json(new ApiResponse(200, "Property deleted"));
});

// ── GET /api/v1/properties/:id/is-verified ───────────────────────────────────
// Check if the property is approved
export const checkPropertyVerified = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);
  
  res.status(200).json(
    new ApiResponse(200, "Verification status retrieved", {
      isVerified: property.status === "APPROVED",
    })
  );
});

// ── GET /api/v1/properties/:id/verification-details ──────────────────────────
// Get the complete verification feedback/details
export const getVerificationDetails = asyncHandler(async (req, res) => {
  const property = await findOwnedProperty(req.params.id, req.user._id);

  res.status(200).json(
    new ApiResponse(200, "Verification details retrieved", {
      status: property.status,
      rejectionReason: property.rejectionReason,
      verification: property.verification,
    })
  );
});
