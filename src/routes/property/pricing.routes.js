import { Router } from "express";
import {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
} from "../../controllers/property/pricing.controller.js";
import { verifyUserToken, requireRole } from "../../middleware/auth.middleware.js";

const router = Router();
const ownerOnly = [verifyUserToken, requireRole("owner")];

// GET    /api/v1/properties/:id/rooms/:roomId/pricing            – owner only
router.get("/:id/rooms/:roomId/pricing", ...ownerOnly, getPricingRules);

// POST   /api/v1/properties/:id/rooms/:roomId/pricing            – owner only
router.post("/:id/rooms/:roomId/pricing", ...ownerOnly, createPricingRule);

// PATCH  /api/v1/properties/:id/rooms/:roomId/pricing/:ruleId   – owner only
router.patch("/:id/rooms/:roomId/pricing/:ruleId", ...ownerOnly, updatePricingRule);

// DELETE /api/v1/properties/:id/rooms/:roomId/pricing/:ruleId   – owner only
router.delete("/:id/rooms/:roomId/pricing/:ruleId", ...ownerOnly, deletePricingRule);

export default router;
