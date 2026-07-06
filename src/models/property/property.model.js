import mongoose from "mongoose";

const { Schema } = mongoose;

// ── Slug helper ───────────────────────────────────────────────────────────────
const toSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ── Regex validators ──────────────────────────────────────────────────────────
const timeRegex    = /^([01]\d|2[0-3]):([0-5]\d)$/;
const pincodeRegex = /^\d{6}$/;
const ifscRegex    = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const gstRegex     = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
const urlRegex     = /^https?:\/\/.+/;
const latRegex     = { min: -90,  max: 90  };
const lngRegex     = { min: -180, max: 180 };

// ── Sub-schemas (_id: false = value objects) ──────────────────────────────────

const addressSchema = new Schema(
  {
    addressLine1: { type: String, trim: true, maxlength: [200, "Too long"] },
    addressLine2: { type: String, trim: true, maxlength: [200, "Too long"] },
    landmark:     { type: String, trim: true, maxlength: [100, "Too long"] },
    city:         { type: String, trim: true, maxlength: [100, "Too long"] },
    district:     { type: String, trim: true, maxlength: [100, "Too long"] },
    state:        { type: String, trim: true, maxlength: [100, "Too long"] },
    country:      { type: String, trim: true, maxlength: [100, "Too long"], default: "India" },
    pincode: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || pincodeRegex.test(v),
        message: "Pincode must be a 6-digit number",
      },
    },
  },
  { _id: false }
);

const locationSchema = new Schema(
  {
    latitude: {
      type: Number,
      min: [latRegex.min, "Latitude must be >= -90"],
      max: [latRegex.max, "Latitude must be <= 90"],
    },
    longitude: {
      type: Number,
      min: [lngRegex.min, "Longitude must be >= -180"],
      max: [lngRegex.max, "Longitude must be <= 180"],
    },
    googleMapUrl: { type: String, trim: true },
  },
  { _id: false }
);

const contactSchema = new Schema(
  {
    primaryPhone:     { type: String, trim: true },
    secondaryPhone:   { type: String, trim: true },
    whatsapp:         { type: String, trim: true },
    email:            { type: String, trim: true, lowercase: true },
    reservationEmail: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

// Sensitive — excluded from default queries; use .select("+bank")
const bankSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    bankName:          { type: String, trim: true },
    accountNumber:     { type: String, trim: true },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: (v) => !v || ifscRegex.test(v),
        message: "Invalid IFSC code format",
      },
    },
    branch:  { type: String, trim: true },
    upiId:   { type: String, trim: true },
    cancelledCheque: String,
    panCard:         String,
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: (v) => !v || gstRegex.test(v),
        message: "Invalid GST number format",
      },
    },
  },
  { _id: false }
);

// Sensitive — excluded from default queries; use .select("+documents")
const documentsSchema = new Schema(
  {
    ownerPhoto:      String,
    ownerIdProof:    String,
    propertyLicense: String,
    gstCertificate:  String,
    panCard:         String,
    cancelledCheque: String,
  },
  { _id: false }
);

const amenitySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Amenity name is required"],
      trim: true,
      maxlength: [80, "Amenity name too long"],
    },
    icon: { type: String, trim: true },
  }
  // _id: true (default) — lets us target amenities individually via $pull / $set
);

const policiesSchema = new Schema(
  {
    cancellationPolicy:  { type: String, trim: true, maxlength: [2000, "Too long"] },
    childPolicy:         { type: String, trim: true, maxlength: [1000, "Too long"] },
    petPolicy:           { type: String, trim: true, maxlength: [1000, "Too long"] },
    smokingPolicy:       { type: String, trim: true, maxlength: [1000, "Too long"] },
    checkInInstructions: { type: String, trim: true, maxlength: [2000, "Too long"] },
  },
  { _id: false }
);

const websiteBuilderSchema = new Schema(
  {
    template: { type: Schema.Types.ObjectId, ref: "Template" },
    heroBanner: { type: String, trim: true },
    about: { type: String, trim: true },
    facilities: [{ type: String, trim: true }],
    socialLinks: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      twitter: { type: String, trim: true },
    },
    seoSettings: {
      metaTitle: { type: String, trim: true },
      metaDescription: { type: String, trim: true },
      keywords: [{ type: String, trim: true }],
    },
    isPublished: { type: Boolean, default: false },
  },
  { _id: false }
);

const verificationSectionSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REUPLOADED"],
      default: "PENDING",
    },
    message: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const verificationSchema = new Schema(
  {
    ownerDetails:    { type: verificationSectionSchema, default: () => ({}) },
    propertyDetails: { type: verificationSectionSchema, default: () => ({}) },
    address:         { type: verificationSectionSchema, default: () => ({}) },
    location:        { type: verificationSectionSchema, default: () => ({}) },
    contact:         { type: verificationSectionSchema, default: () => ({}) },
    websiteBuilder:  { type: verificationSectionSchema, default: () => ({}) },
  },
  { _id: false }
);

// ── Exported enums ────────────────────────────────────────────────────────────
export const PROPERTY_TYPES = [
  "HOTEL", "RESORT", "WATER_PARK", "VILLA",
  "HOMESTAY", "FARMHOUSE", "CAMPING", "APARTMENT",
];

export const PROPERTY_STATUSES = [
  "DRAFT", "PENDING", "APPROVED", "REJECTED", "REUPLOADED", "SUSPENDED",
];

// ── Main schema ───────────────────────────────────────────────────────────────
const propertySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner (userId) is required"],
    },

    propertyName: {
      type: String,
      required: [true, "Property name is required"],
      trim: true,
      minlength: [2, "Property name must be at least 2 characters"],
      maxlength: [150, "Property name cannot exceed 150 characters"],
    },

    propertySlug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    propertyType: {
      type: String,
      enum: { values: PROPERTY_TYPES, message: "{VALUE} is not a valid property type" },
      required: [true, "Property type is required"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },

    establishedYear: {
      type: Number,
      min: [1800, "Established year must be 1800 or later"],
      max: [new Date().getFullYear(), "Established year cannot be in the future"],
    },

    totalRooms:  { type: Number, min: [0, "Cannot be negative"], default: 0 },
    totalFloors: { type: Number, min: [0, "Cannot be negative"], default: 0 },

    checkInTime: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || timeRegex.test(v),
        message: 'Check-in time must be in HH:MM format (e.g. "14:00")',
      },
    },
    checkOutTime: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || timeRegex.test(v),
        message: 'Check-out time must be in HH:MM format (e.g. "11:00")',
      },
    },

    website: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || urlRegex.test(v),
        message: "Website must be a valid URL starting with http:// or https://",
      },
    },

    logo:       { type: String, trim: true },
    coverImage: { type: String, trim: true },
    gallery: {
      type: [{
        url: { type: String, required: true },
        title: { type: String, trim: true, default: "" },
        description: { type: String, trim: true, default: "" }
      }],
      default: [],
    },

    address:   { type: addressSchema,   default: () => ({}) },
    location:  { type: locationSchema,  default: () => ({}) },
    contact:   { type: contactSchema,   default: () => ({}) },
    amenities: { type: [amenitySchema], default: [] },
    policies:  { type: policiesSchema,  default: () => ({}) },
    websiteBuilder: { type: websiteBuilderSchema, default: () => ({}) },

    // Sensitive — excluded from default queries
    bank:      { type: bankSchema,      default: () => ({}), select: false },
    documents: { type: documentsSchema, default: () => ({}), select: false },

    status: {
      type: String,
      enum: { values: PROPERTY_STATUSES, message: "{VALUE} is not a valid status" },
      default: "DRAFT",
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Rejection reason too long"],
    },

    verification: { type: verificationSchema, default: () => ({}) },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: { type: Date, default: null },

    isDeleted: { type: Boolean, default: false, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
propertySchema.index({ userId: 1 });
propertySchema.index({ userId: 1, status: 1 });
propertySchema.index({ status: 1, isDeleted: 1 });
propertySchema.index({ propertyType: 1, status: 1 });
propertySchema.index({ "address.city": 1, "address.state": 1 });
propertySchema.index({ "location.latitude": 1, "location.longitude": 1 });
propertySchema.index(
  { propertyName: "text", description: "text" },
  { weights: { propertyName: 10, description: 3 }, name: "PropertyTextSearch" }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────
propertySchema.virtual("isLive").get(function () {
  return this.status === "APPROVED" && !this.isDeleted;
});

// ── Pre-save: auto-generate unique slug ───────────────────────────────────────
propertySchema.pre("save", async function (next) {
  if (!this.isModified("propertyName") && this.propertySlug) return next();

  const baseSlug = toSlug(this.propertyName);
  let slug = baseSlug;
  let counter = 1;

  const Property = mongoose.model("Property");
  while (await Property.exists({ propertySlug: slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  this.propertySlug = slug;
  next();
});

// ── Instance methods ──────────────────────────────────────────────────────────
propertySchema.methods.isApproved = function () {
  return this.status === "APPROVED";
};

propertySchema.methods.approve = function (adminId) {
  this.status = "APPROVED";
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.rejectionReason = undefined;
};

propertySchema.methods.reject = function (reason) {
  this.status = "REJECTED";
  this.rejectionReason = reason;
};

// ── Static methods ────────────────────────────────────────────────────────────
propertySchema.statics.findByOwner = function (userId) {
  return this.find({ userId, isDeleted: false }).sort({ createdAt: -1 });
};

propertySchema.statics.findApproved = function (filter = {}) {
  return this.find({ ...filter, status: "APPROVED", isDeleted: false });
};

propertySchema.statics.findBySlug = function (slug) {
  return this.findOne({ propertySlug: slug, status: "APPROVED", isDeleted: false });
};

export default mongoose.model("Property", propertySchema);
