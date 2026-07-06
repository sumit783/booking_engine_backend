import { Router } from "express";
import {
  addPropertyStaff,
  getPropertyStaff,
  updatePropertyStaff,
  removePropertyStaff,
} from "../../controllers/property/propertyStaff.controller.js";
import { verifyUserToken, requireRole } from "../../middleware/auth.middleware.js";

const router = Router();
const ownerOnly = [verifyUserToken, requireRole("owner")];

// POST   /api/v1/properties/staff      → add property staff
// GET    /api/v1/properties/staff      → list property staff by propertyId
// PATCH  /api/v1/properties/staff/:id  → update property staff
// DELETE /api/v1/properties/staff/:id  → remove property staff
router.post("/", ...ownerOnly, addPropertyStaff);
router.get("/", ...ownerOnly, getPropertyStaff);
router.patch("/:id", ...ownerOnly, updatePropertyStaff);
router.delete("/:id", ...ownerOnly, removePropertyStaff);

export default router;
