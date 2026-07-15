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
  getPropertyLogo,
  getPropertyCover,
  getGalleryImage,
  getBookings,
  getCustomers,
  getReviews,
  getReports,
  getDashboard,
  verifyBookingDetails,
  updateBookingStatus,
  sendPaymentLink,
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
  uploadRoomImages,
} from "../../middleware/upload.middleware.js";
import { createRoom, getRooms, getRoomImage, updateRoom, deleteRoom } from "../../controllers/property/room.controller.js";
import { getWallet, saveBankDetails, requestWithdrawal } from "../../controllers/property/wallet.controller.js";

const router = Router();


// All property routes require a logged-in owner
const ownerOnly = [verifyUserToken, requireRole("owner")];

// ── Core CRUD ──────────────────────────────────────────────────────────────────

// POST   /api/v1/properties           → create property (DRAFT)
// GET    /api/v1/properties           → list owner's properties (?status&type&page&limit)
// GET    /api/v1/properties/:id       → get single property detail
// DELETE /api/v1/properties/:id       → soft-delete property
router.post(  "/",    ...ownerOnly, createProperty);
router.get(   "/",    verifyUserToken, requireRole("owner", "staff"), getMyProperties);

// ── Owner Wallet (must be BEFORE /:id to prevent route collision) ─────────────
// GET  /api/v1/properties/wallet               → balance + transactions + withdrawals
// PUT  /api/v1/properties/wallet/bank-details  → save bank/UPI details
// POST /api/v1/properties/wallet/withdraw      → submit withdrawal request
router.get( "/wallet",                verifyUserToken, requireRole("owner", "staff"), getWallet);
router.put( "/wallet/bank-details",   verifyUserToken, requireRole("owner"), saveBankDetails);
router.post("/wallet/withdraw",       verifyUserToken, requireRole("owner"), requestWithdrawal);

router.get(   "/:id", verifyUserToken, requireRole("owner", "staff"), getProperty);
router.delete("/:id", ...ownerOnly, deleteProperty);

// GET /api/v1/properties/website/templates → list active templates
router.get("/website/templates", ...ownerOnly, getActiveTemplates);

// GET /api/v1/properties/:id/bookings → list all bookings
router.get("/:id/bookings", verifyUserToken, requireRole("owner", "staff"), getBookings);

// GET /api/v1/properties/:id/customers → list all unique customers from bookings
router.get("/:id/customers", verifyUserToken, requireRole("owner", "staff"), getCustomers);

// GET /api/v1/properties/:id/reviews → list all reviews
router.get("/:id/reviews", verifyUserToken, requireRole("owner", "staff"), getReviews);

// GET /api/v1/properties/:id/reports → aggregated revenue & occupancy report
router.get("/:id/reports", verifyUserToken, requireRole("owner", "staff"), getReports);

// GET /api/v1/properties/:id/dashboard → dashboard summary
router.get("/:id/dashboard", verifyUserToken, requireRole("owner", "staff"), getDashboard);

// Booking verification & scanner routes (both owner and staff can access)
router.get("/bookings/verify/:bookingRef", verifyUserToken, verifyBookingDetails);
router.patch("/bookings/:id/status", verifyUserToken, updateBookingStatus);
router.post("/bookings/:id/payment-link", verifyUserToken, requireRole("owner", "staff"), sendPaymentLink);

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

// ── Rooms ─────────────────────────────────────────────────────────────────────

// POST /api/v1/properties/:id/rooms
//   Body (multipart): name, description, capacity, quantity, basePrice, amenities[]
//   Files: images (up to 10)
router.post("/:id/rooms", ...ownerOnly, uploadRoomImages, createRoom);

// GET /api/v1/properties/:id/rooms
router.get("/:id/rooms", ...ownerOnly, getRooms);

// PATCH /api/v1/properties/:id/rooms/:roomId
router.patch("/:id/rooms/:roomId", ...ownerOnly, uploadRoomImages, updateRoom);

// DELETE /api/v1/properties/:id/rooms/:roomId
router.delete("/:id/rooms/:roomId", ...ownerOnly, deleteRoom);

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

// ── Serving public media buffers ──────────────────────────────────────────────
router.get("/:id/logo", getPropertyLogo);
router.get("/:id/cover", getPropertyCover);
router.get("/gallery/:id", getGalleryImage);
router.get("/rooms/images/:id", getRoomImage);

export default router;
