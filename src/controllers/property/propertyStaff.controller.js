import Property from "../../models/property/property.model.js";
import PropertyStaff from "../../models/property/propertyStaff.model.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

const findOwnedProperty = async (propertyId, userId) => {
  const property = await Property.findOne({ _id: propertyId, userId, isDeleted: false });
  if (!property) throw new ApiError(404, "Property not found or access denied");
  return property;
};

// ── POST /api/v1/properties/staff ─────────────────────────────────────────────
// Add a staff member to a property.
export const addPropertyStaff = asyncHandler(async (req, res) => {
  const {
    propertyId,
    employeeId,
    firstName,
    lastName,
    email,
    phone,
    department,
    designation,
    address,
    status,
  } = req.body;

  if (!propertyId || !employeeId || !firstName || !email) {
    throw new ApiError(400, "propertyId, employeeId, firstName and email are required");
  }

  const property = await findOwnedProperty(propertyId, req.user._id);

  const existing = await PropertyStaff.findOne({ propertyId, employeeId, isDeleted: false });
  if (existing) {
    throw new ApiError(409, "Employee ID already exists for this property");
  }

  const staff = await PropertyStaff.create({
    ownerId: req.user._id,
    propertyId,
    employeeId: employeeId.trim(),
    firstName: firstName.trim(),
    lastName: lastName?.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim(),
    department: department?.trim(),
    designation: designation?.trim(),
    address: address || {},
    status: status || "Active",
  });

  res.status(201).json(new ApiResponse(201, "Property staff added", staff));
});

// ── GET /api/v1/properties/staff?propertyId=<id> ───────────────────────────────
// List staff members for a property.
export const getPropertyStaff = asyncHandler(async (req, res) => {
  const { propertyId } = req.query;
  if (!propertyId) {
    throw new ApiError(400, "propertyId is required");
  }

  await findOwnedProperty(propertyId, req.user._id);

  const staff = await PropertyStaff.find({ propertyId, isDeleted: false }).sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, "Property staff retrieved", { staff }));
});

// ── PATCH /api/v1/properties/staff/:id ─────────────────────────────────────────
// Update a property staff member.
export const updatePropertyStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    employeeId,
    firstName,
    lastName,
    email,
    phone,
    department,
    designation,
    address,
    status,
  } = req.body;

  const staff = await PropertyStaff.findOne({ _id: id, isDeleted: false });
  if (!staff) throw new ApiError(404, "Property staff member not found");

  await findOwnedProperty(staff.propertyId, req.user._id);

  if (employeeId) {
    const duplicate = await PropertyStaff.findOne({
      propertyId: staff.propertyId,
      employeeId: employeeId.trim(),
      _id: { $ne: staff._id },
      isDeleted: false,
    });
    if (duplicate) {
      throw new ApiError(409, "Employee ID already exists for this property");
    }
    staff.employeeId = employeeId.trim();
  }

  if (firstName !== undefined) staff.firstName = firstName.trim();
  if (lastName !== undefined) staff.lastName = lastName.trim();
  if (email !== undefined) staff.email = email.trim().toLowerCase();
  if (phone !== undefined) staff.phone = phone.trim();
  if (department !== undefined) staff.department = department.trim();
  if (designation !== undefined) staff.designation = designation.trim();
  if (address !== undefined) staff.address = address;
  if (status !== undefined) staff.status = status;

  await staff.save();
  res.status(200).json(new ApiResponse(200, "Property staff updated", staff));
});

// ── DELETE /api/v1/properties/staff/:id ───────────────────────────────────────
// Soft-delete a property staff member.
export const removePropertyStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const staff = await PropertyStaff.findOne({ _id: id, isDeleted: false });
  if (!staff) throw new ApiError(404, "Property staff member not found");

  await findOwnedProperty(staff.propertyId, req.user._id);

  staff.isDeleted = true;
  await staff.save();

  res.status(200).json(new ApiResponse(200, "Property staff removed"));
});
