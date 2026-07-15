import { Router } from "express";
import {
  getProperties,
  getPendingProperties,
  getPropertyForReview,
  verifyProperty,
  toggleWebsiteAccess,
} from "../../controllers/property/admin.property.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all admin property routes
router.use(verifyAdminToken);

// GET /api/v1/admin/properties
router.get("/", getProperties);

// GET /api/v1/admin/properties/pending
router.get("/pending", getPendingProperties);

// GET /api/v1/admin/properties/:id
router.get("/:id", getPropertyForReview);

// POST /api/v1/admin/properties/:id/verify
// Body expects keys for each section: { ownerDetails: { status: 'APPROVED' }, address: { status: 'REJECTED', message: 'Incomplete' } }
router.post("/:id/verify", verifyProperty);

// PATCH /api/v1/admin/properties/:id/website-access
router.patch("/:id/website-access", toggleWebsiteAccess);

export default router;
