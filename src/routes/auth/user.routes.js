import { Router } from "express";
import {
  ownerSignup,
  createStaff,
  getStaff,
  removeStaff,
} from "../../controllers/auth/user.controller.js";
import { verifyUserToken, requireRole } from "../../middleware/auth.middleware.js";
import { otpRateLimiter } from "../../middleware/rateLimiter.middleware.js";

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────

// POST /api/v1/users/signup
//   Owner self-registration. Sends a signup OTP.
//   Follow-up: POST /api/v1/auth/user/verify-otp { email, otp, purpose:"signup" }
router.post("/signup", otpRateLimiter, ownerSignup);

// ── Protected: any authenticated user ────────────────────────────────────────
// (add profile, settings routes here later)

// ── Protected: owner only ─────────────────────────────────────────────────────
const ownerOnly = [verifyUserToken, requireRole("owner")];

// POST   /api/v1/users/staff          → create a staff member + send invite
// GET    /api/v1/users/staff          → list all staff
// DELETE /api/v1/users/staff/:staffId → remove (soft-delete) a staff member
router.post("/staff", ...ownerOnly, createStaff);
router.get("/staff", ...ownerOnly, getStaff);
router.delete("/staff/:staffId", ...ownerOnly, removeStaff);

export default router;
