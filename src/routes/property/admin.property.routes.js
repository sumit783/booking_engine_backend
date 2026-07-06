import { Router } from "express";
import {
  getPendingProperties,
  getPropertyForReview,
  verifyProperty,
} from "../../controllers/property/admin.property.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all admin property routes
router.use(verifyAdminToken);

// GET /api/v1/admin/properties/pending
router.get("/pending", getPendingProperties);

// GET /api/v1/admin/properties/:id
router.get("/:id", getPropertyForReview);

// POST /api/v1/admin/properties/:id/verify
// Body expects keys for each section: { ownerDetails: { status: 'APPROVED' }, address: { status: 'REJECTED', message: 'Incomplete' } }
router.post("/:id/verify", verifyProperty);

export default router;
