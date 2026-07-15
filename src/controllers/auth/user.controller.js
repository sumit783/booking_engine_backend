import { prisma } from "../../config/db.js";
import { generateOTP, hashOTP } from "../../utils/otp.utils.js";
import { sendOTPEmail, sendStaffInviteEmail } from "../../utils/mailer.utils.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── POST /api/v1/users/signup ─────────────────────────────────────────────────
export const ownerSignup = asyncHandler(async (req, res) => {
  const { fullName, email, phone } = req.body;

  if (!fullName?.trim() || !email) {
    throw new ApiError(400, "Full name and email are required");
  }

  // Block duplicate registrations
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  // Create owner account in pending state
  const user = await prisma.user.create({
    data: {
      fullName: fullName.trim(),
      email,
      phone: phone?.trim() || null,
      role: "owner",
      status: "pending",
    },
  });

  // Invalidate any stale OTPs for this email, then issue a fresh one
  await prisma.oTP.updateMany({
    where: { email, isUsed: false },
    data: { isUsed: true },
  });

  const isDev = process.env.NODE_ENV !== "production";
  const otp = isDev ? "123456" : generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await prisma.oTP.create({
    data: { email, otp: hashed, purpose: "signup", expiresAt },
  });

  if (isDev) {
    console.log(`[DEV] Fixed Signup OTP for ${email}: ${otp}`);
  } else {
    await sendOTPEmail(email, otp, "signup");
  }

  res.status(201).json(
    new ApiResponse(
      201,
      "Account created. Check your email for the OTP to verify and activate your account.",
      { email: user.email, role: user.role }
    )
  );
});

// ── POST /api/v1/users/staff ──────────────────────────────────────────────────
export const createStaff = asyncHandler(async (req, res) => {
  const { fullName, email, phone } = req.body;

  if (!fullName?.trim() || !email) {
    throw new ApiError(400, "Full name and email are required");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const staff = await prisma.user.create({
    data: {
      fullName: fullName.trim(),
      email,
      phone: phone?.trim() || null,
      role: "staff",
      status: "active",
      isEmailVerified: true,
      ownerId: req.user.id,
    },
  });

  // Issue a 24-hour invite OTP so staff can log in for the first time
  const isDev = process.env.NODE_ENV !== "production";
  const otp = isDev ? "123456" : generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.oTP.create({
    data: { email, otp: hashed, purpose: "signup", expiresAt },
  });

  if (isDev) {
    console.log(`[DEV] Fixed Staff Invite OTP for ${email}: ${otp}`);
  } else {
    await sendStaffInviteEmail(email, otp, req.user.fullName);
  }

  res.status(201).json(
    new ApiResponse(201, "Staff member created and invite email sent", {
      id: staff.id,
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
export const getStaff = asyncHandler(async (req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: "staff", ownerId: req.user.id, isDeleted: false },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      isEmailVerified: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json(
    new ApiResponse(200, "Staff list retrieved", {
      count: staff.length,
      staff,
    })
  );
});

// ── DELETE /api/v1/users/staff/:staffId ───────────────────────────────────────
export const removeStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;

  const staff = await prisma.user.findFirst({
    where: {
      id: Number(staffId),
      role: "staff",
      ownerId: req.user.id,
      isDeleted: false,
    },
  });

  if (!staff) throw new ApiError(404, "Staff member not found");

  // Soft-delete and suspend
  await prisma.user.update({
    where: { id: staff.id },
    data: {
      isDeleted: true,
      status: "suspended",
    },
  });

  // Revoke all active refresh tokens for this staff member
  await prisma.refreshToken.updateMany({
    where: { userId: staff.id, isRevoked: false },
    data: { isRevoked: true },
  });

  res.status(200).json(
    new ApiResponse(200, "Staff member removed and sessions revoked")
  );
});
