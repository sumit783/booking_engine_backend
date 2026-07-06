import { Router } from "express";
import {
  requestOTP,
  requestOwnerOTP,
  verifyOTPAndLogin,
  verifyOwnerOTPAndLogin,
  refreshAccessToken,
  logout,
} from "../../controllers/auth/user.auth.controller.js";
import { verifyUserToken } from "../../middleware/auth.middleware.js";
import { otpRateLimiter } from "../../middleware/rateLimiter.middleware.js";

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
// POST  /api/v1/auth/user/request-otp   → send OTP email (rate limited: 5/15min)
router.post("/request-otp", otpRateLimiter, requestOTP);

// POST  /api/v1/auth/user/verify-otp    → verify OTP, issue tokens
//   body: { email, otp, role? }  role defaults to "user"
router.post("/verify-otp", verifyOTPAndLogin);

// POST  /api/v1/auth/user/owner/request-otp   → send OTP email if owner exists (rate limited: 5/15min)
router.post("/owner/request-otp", otpRateLimiter, requestOwnerOTP);

// POST  /api/v1/auth/user/owner/verify-otp    → verify OTP for owner
router.post("/owner/verify-otp", verifyOwnerOTPAndLogin);

// POST  /api/v1/auth/user/refresh-token → rotate refresh token
router.post("/refresh-token", refreshAccessToken);

// ── Protected ─────────────────────────────────────────────────────────────────
// POST  /api/v1/auth/user/logout        → revoke refresh token
router.post("/logout", verifyUserToken, logout);

export default router;
