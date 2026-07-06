import { Router } from "express";
import {
  createProperty,
  getMyProperties,
  getProperty,
  updateBasicInfo,
  updateAddress,
  updateLocation,
  updateContact,
  updateMedia,
  removeGalleryImage,
  updateGalleryImage,
  updateBank,
  updateDocuments,
  updatePolicies,
  addAmenity,
  removeAmenity,
  submitForApproval,
  deleteProperty,
  checkPropertyVerified,
  getVerificationDetails,
} from "../../controllers/property/property.controller.js";
import {
  getActiveTemplates,
  updateWebsiteTemplate,
  updateWebsiteBuilder,
  publishWebsite,
} from "../../controllers/property/property.website.controller.js";
import { verifyUserToken, requireRole } from "../../middleware/auth.middleware.js";
import {
  uploadMedia,
  uploadDocuments,
  uploadBankDocs,
} from "../../middleware/upload.middleware.js";

const router = Router();

// All property routes require a logged-in owner
const ownerOnly = [verifyUserToken, requireRole("owner")];

// ── Core CRUD ──────────────────────────────────────────────────────────────────

// POST   /api/v1/properties           → create property (DRAFT)
// GET    /api/v1/properties           → list owner's properties (?status&type&page&limit)
// GET    /api/v1/properties/:id       → get single property detail
// DELETE /api/v1/properties/:id       → soft-delete property
router.post(  "/",    ...ownerOnly, createProperty);
router.get(   "/",    ...ownerOnly, getMyProperties);
router.get(   "/:id", ...ownerOnly, getProperty);
router.delete("/:id", ...ownerOnly, deleteProperty);

// GET /api/v1/properties/website/templates → list active templates
router.get("/website/templates", ...ownerOnly, getActiveTemplates);

// ── Section updates (all PATCH, each section independent) ─────────────────────

// PATCH /api/v1/properties/:id/basic
//   Body (JSON): propertyName, propertyType, description, establishedYear,
//                totalRooms, totalFloors, checkInTime, checkOutTime, website
router.patch("/:id/basic",    ...ownerOnly, updateBasicInfo);

// PATCH /api/v1/properties/:id/address
//   Body (JSON): addressLine1, addressLine2, landmark, city, district,
//                state, country, pincode
router.patch("/:id/address",  ...ownerOnly, updateAddress);

// PATCH /api/v1/properties/:id/location
//   Body (JSON): latitude, longitude, googleMapUrl
router.patch("/:id/location", ...ownerOnly, updateLocation);

// PATCH /api/v1/properties/:id/contact
//   Body (JSON): primaryPhone, secondaryPhone, whatsapp, email, reservationEmail
router.patch("/:id/contact",  ...ownerOnly, updateContact);

// PATCH /api/v1/properties/:id/policies
//   Body (JSON): cancellationPolicy, childPolicy, petPolicy, smokingPolicy,
//                checkInInstructions
router.patch("/:id/policies", ...ownerOnly, updatePolicies);

// ── Website Builder ───────────────────────────────────────────────────────────

// PATCH /api/v1/properties/:id/website-template
router.patch("/:id/website-template", ...ownerOnly, updateWebsiteTemplate);

// PATCH /api/v1/properties/:id/website-builder
router.patch("/:id/website-builder", ...ownerOnly, updateWebsiteBuilder);

// POST /api/v1/properties/:id/website-publish
router.post("/:id/website-publish", ...ownerOnly, publishWebsite);

// ── Media uploads (multipart/form-data) ───────────────────────────────────────

// PATCH /api/v1/properties/:id/media
//   Files: logo (1), coverImage (1), gallery (up to 10) — all images
//   Supported: JPEG, PNG, WebP — max 5 MB each
router.patch("/:id/media", ...ownerOnly, uploadMedia, updateMedia);

// DELETE /api/v1/properties/:id/gallery/:index
//   Remove a gallery image by its 0-based array index
router.delete("/:id/gallery/:index", ...ownerOnly, removeGalleryImage);

// PATCH /api/v1/properties/:id/gallery/:index
//   Update title/description of a gallery image
router.patch("/:id/gallery/:index", ...ownerOnly, updateGalleryImage);

// ── Document uploads (multipart/form-data) ────────────────────────────────────

// PATCH /api/v1/properties/:id/documents
//   Files: ownerPhoto, ownerIdProof, propertyLicense, gstCertificate,
//          panCard, cancelledCheque — images or PDFs, max 10 MB each
router.patch("/:id/documents", ...ownerOnly, uploadDocuments, updateDocuments);

// PATCH /api/v1/properties/:id/bank
//   Body (JSON): accountHolderName, bankName, accountNumber, ifscCode,
//                branch, upiId, gstNumber
//   Files: cancelledCheque, panCard — images or PDFs, max 10 MB each
router.patch("/:id/bank", ...ownerOnly, uploadBankDocs, updateBank);

// ── Amenities ─────────────────────────────────────────────────────────────────

// POST   /api/v1/properties/:id/amenities           → add amenity
//   Body (JSON): { name: string, icon?: string }
// DELETE /api/v1/properties/:id/amenities/:amenityId → remove amenity
router.post(  "/:id/amenities",              ...ownerOnly, addAmenity);
router.delete("/:id/amenities/:amenityId",   ...ownerOnly, removeAmenity);

// ── Approval workflow ─────────────────────────────────────────────────────────

// POST /api/v1/properties/:id/submit
//   Transitions DRAFT → PENDING or REJECTED → REUPLOADED
router.post("/:id/submit", ...ownerOnly, submitForApproval);

// GET /api/v1/properties/:id/is-verified
router.get("/:id/is-verified", ...ownerOnly, checkPropertyVerified);

// GET /api/v1/properties/:id/verification-details
router.get("/:id/verification-details", ...ownerOnly, getVerificationDetails);

export default router;
