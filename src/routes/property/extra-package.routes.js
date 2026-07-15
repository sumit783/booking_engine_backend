import { Router } from "express";
import {
  createExtraPackage,
  updateExtraPackage,
  deleteExtraPackage,
  getPropertyExtraPackages
} from "../../controllers/property/extra-package.controller.js";
import { verifyUserToken, requireRole } from "../../middleware/auth.middleware.js";

const router = Router();
const ownerOnly = [verifyUserToken, requireRole("owner")];

// POST   /api/v1/properties/:propertyId/extras
router.post("/:propertyId/extras", ...ownerOnly, createExtraPackage);

// PATCH  /api/v1/properties/:propertyId/extras/:extraId
router.patch("/:propertyId/extras/:extraId", ...ownerOnly, updateExtraPackage);

// DELETE /api/v1/properties/:propertyId/extras/:extraId
router.delete("/:propertyId/extras/:extraId", ...ownerOnly, deleteExtraPackage);

// GET    /api/v1/properties/:propertyId/extras
router.get("/:propertyId/extras", getPropertyExtraPackages);

export default router;
