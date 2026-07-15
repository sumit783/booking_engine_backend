import { Router } from "express";
import {
  createPackage,
  updatePackage,
  deletePackage,
  getPropertyPackages,
  getPackageImage,
} from "../../controllers/property/package.controller.js";
import { verifyUserToken, requireRole } from "../../middleware/auth.middleware.js";
import { uploadPackageImages } from "../../middleware/upload.middleware.js";

const router = Router();
const ownerOnly = [verifyUserToken, requireRole("owner")];

// POST   /api/v1/properties/:propertyId/packages           → Create new package
router.post("/:propertyId/packages", ...ownerOnly, uploadPackageImages, createPackage);

// PATCH  /api/v1/properties/:propertyId/packages/:packageId → Update package details
router.patch("/:propertyId/packages/:packageId", ...ownerOnly, uploadPackageImages, updatePackage);

// DELETE /api/v1/properties/:propertyId/packages/:packageId → Soft delete package
router.delete("/:propertyId/packages/:packageId", ...ownerOnly, deletePackage);

// GET    /api/v1/properties/:propertyId/packages           → Get packages list
router.get("/:propertyId/packages", getPropertyPackages);

// GET    /api/v1/properties/packages/images/:imageId       → Public image stream
router.get("/packages/images/:imageId", getPackageImage);

export default router;
