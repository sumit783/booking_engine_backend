import multer from "multer";
import CloudinaryStorage from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import ApiError from "../utils/apiError.js";

// ── MIME type filters ─────────────────────────────────────────────────────────
const IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DOC_MIME_TYPES   = [...IMAGE_MIME_TYPES, "application/pdf"];

const imageFilter = (_req, file, cb) => {
  if (IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError(400, `${file.fieldname}: only JPEG, PNG and WebP images are allowed`));
};

const docFilter = (_req, file, cb) => {
  if (DOC_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError(400, `${file.fieldname}: only images and PDF files are allowed`));
};

// ── Cloudinary storage engines ────────────────────────────────────────────────

/**
 * Media storage — images only.
 * Uploads into  booking-engine/properties/media/<fieldname>/
 * Auto-quality + format optimisation applied.
 */
const mediaStorage = new CloudinaryStorage({
  cloudinary,
  folder: "booking-engine/properties/media",
  allowedFormats: ["jpg", "jpeg", "png", "webp"],
});

/**
 * Document storage — images + PDFs.
 * Uploads into  booking-engine/properties/documents/
 * resource_type:"auto" lets Cloudinary detect image vs raw (PDF).
 */
const docStorage = new CloudinaryStorage({
  cloudinary,
  folder: "booking-engine/properties/documents",
  // resource_type auto is default or we can just let it be
});

// ── Named multer uploaders ────────────────────────────────────────────────────

/**
 * Media upload: logo (1), coverImage (1), gallery (up to 10)
 * Content-Type: multipart/form-data
 * Max per file: 5 MB
 */
export const uploadMedia = multer({
  storage:    mediaStorage,
  fileFilter: imageFilter,
  limits:     { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: "logo",       maxCount: 1  },
  { name: "coverImage", maxCount: 1  },
  { name: "gallery",    maxCount: 10 },
]);

/**
 * Template Media storage — images only.
 * Uploads into booking-engine/templates/media/
 */
const templateMediaStorage = new CloudinaryStorage({
  cloudinary,
  folder: "booking-engine/templates/media",
  allowedFormats: ["jpg", "jpeg", "png", "webp"],
});

/**
 * Template media upload: previewImage
 */
export const uploadTemplateMedia = multer({
  storage:    templateMediaStorage,
  fileFilter: imageFilter,
  limits:     { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: "previewImage", maxCount: 1 },
]);

/**
 * Owner / property document uploads
 * Content-Type: multipart/form-data
 * Max per file: 10 MB
 */
export const uploadDocuments = multer({
  storage:    docStorage,
  fileFilter: docFilter,
  limits:     { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: "ownerPhoto",       maxCount: 1 },
  { name: "ownerIdProof",     maxCount: 1 },
  { name: "propertyLicense",  maxCount: 1 },
  { name: "gstCertificate",   maxCount: 1 },
  { name: "panCard",          maxCount: 1 },
  { name: "cancelledCheque",  maxCount: 1 },
]);

/**
 * Bank document uploads: cancelled cheque + PAN card
 * Content-Type: multipart/form-data
 * Max per file: 10 MB
 */
export const uploadBankDocs = multer({
  storage:    docStorage,
  fileFilter: docFilter,
  limits:     { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: "cancelledCheque", maxCount: 1 },
  { name: "panCard",         maxCount: 1 },
]);

// ── URL helpers ───────────────────────────────────────────────────────────────
// With CloudinaryStorage, multer populates file.path with the Cloudinary secure_url.

/**
 * Extract the Cloudinary URL for a single-file field.
 * @param {object} files  req.files from multer
 * @param {string} field  field name
 * @returns {string|undefined}
 */
export const fileUrl = (files, field) => files?.[field]?.[0]?.path ?? undefined;

/**
 * Extract Cloudinary URLs for a multi-file field (e.g. gallery).
 * @param {object} files  req.files from multer
 * @param {string} field  field name
 * @returns {string[]|undefined}
 */
export const fileUrls = (files, field) => {
  const entries = files?.[field];
  return entries?.length ? entries.map((f) => f.path) : undefined;
};
