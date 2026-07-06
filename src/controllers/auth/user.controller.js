import User from "../../models/authentication/user.model.js";
import OTP from "../../models/authentication/otp.model.js";
import RefreshToken from "../../models/authentication/refreshToken.model.js";
import { generateOTP, hashOTP } from "../../utils/otp.utils.js";
import { sendOTPEmail, sendStaffInviteEmail } from "../../utils/mailer.utils.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── POST /api/v1/users/signup ─────────────────────────────────────────────────
// Public — owner self-registration. Sends an OTP for email verification.
// After this, call POST /api/v1/auth/user/verify-otp { email, otp, purpose:"signup" }
export const ownerSignup = asyncHandler(async (req, res) => {
  const { fullName, email, phone } = req.body;

  if (!fullName?.trim() || !email) {
    throw new ApiError(400, "Full name and email are required");
  }

  // Block duplicate registrations
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  // Create owner account in pending state
  const user = await User.create({
    fullName: fullName.trim(),
    email,
    phone: phone?.trim() || undefined,
    role: "owner",
    status: "pending",
  });

  // Invalidate any stale OTPs for this email, then issue a fresh one
  await OTP.updateMany({ email, isUsed: false }, { isUsed: true });

  const otp = generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await OTP.create({ email, otp: hashed, purpose: "signup", expiresAt });
  await sendOTPEmail(email, otp, "signup");

  res.status(201).json(
    new ApiResponse(
      201,
      "Account created. Check your email for the OTP to verify and activate your account.",
      { email: user.email, role: user.role }
    )
  );
});

// ── POST /api/v1/users/staff ──────────────────────────────────────────────────
// Protected — owner only. Creates a staff member and sends them a 24-hour invite OTP.
export const createStaff = asyncHandler(async (req, res) => {
  const { fullName, email, phone } = req.body;

  if (!fullName?.trim() || !email) {
    throw new ApiError(400, "Full name and email are required");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const staff = await User.create({
    fullName: fullName.trim(),
    email,
    phone: phone?.trim() || undefined,
    role: "staff",
    status: "active",
    isEmailVerified: true,
  });

  // Issue a 24-hour invite OTP so staff can log in for the first time
  const otp = generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await OTP.create({ email, otp: hashed, purpose: "signup", expiresAt });
  await sendStaffInviteEmail(email, otp, req.user.fullName);

  res.status(201).json(
    new ApiResponse(201, "Staff member created and invite email sent", {
      _id: staff._id,
      fullName: staff.fullName,
      email: staff.email,
      phone: staff.phone || null,
      role: staff.role,
      status: staff.status,
      createdAt: staff.createdAt,
    })
  );
});

// ── GET /api/v1/users/staff ───────────────────────────────────────────────────
// Protected — owner only. Returns all active staff.
export const getStaff = asyncHandler(async (req, res) => {
  const staff = await User.find({ role: "staff", isDeleted: false })
    .select("_id fullName email phone status isEmailVerified lastLoginAt createdAt")
    .sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(200, "Staff list retrieved", {
      count: staff.length,
      staff,
    })
  );
});

// ── DELETE /api/v1/users/staff/:staffId ───────────────────────────────────────
// Protected — owner only. Soft-deletes the staff member and revokes their sessions.
export const removeStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;

  const staff = await User.findOne({
    _id: staffId,
    role: "staff",
    isDeleted: false,
  });

  if (!staff) throw new ApiError(404, "Staff member not found");

  // Soft-delete and suspend
  staff.isDeleted = true;
  staff.status = "suspended";
  await staff.save();

  // Revoke all active refresh tokens for this staff member
  await RefreshToken.updateMany(
    { user: staffId, isRevoked: false },
    { isRevoked: true }
  );

  res.status(200).json(
    new ApiResponse(200, "Staff member removed and sessions revoked")
  );
});
