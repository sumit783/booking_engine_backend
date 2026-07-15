import { prisma } from "../../config/db.js";
import { generateOTP, hashOTP, verifyOTP } from "../../utils/otp.utils.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../../utils/jwt.utils.js";
import { sendOTPEmail } from "../../utils/mailer.utils.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// OTP TTL Constants
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_TTL_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// ── Helper: sign both tokens and persist the refresh token ───────────────────
const issueTokens = async (user, req) => {
  const payload = { _id: user.id, id: user.id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshTokenValue = generateRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: refreshTokenValue,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshTokenValue };
};

// ── Helper: Find latest valid OTP ────────────────────────────────────────────
const findLatestValidOTP = async (email, purpose = "login") => {
  return prisma.oTP.findFirst({
    where: {
      email,
      purpose,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ── POST /api/v1/auth/user/request-otp ───────────────────────────────────────
export const requestOTP = asyncHandler(async (req, res) => {
  const { email, purpose = "login" } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPurpose = purpose.trim().toLowerCase();

  // If logging in, check if user exists and is active
  if (normalizedPurpose === "login") {
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, isDeleted: false },
    });
    if (!user) {
      throw new ApiError(404, "User account not found. Please sign up first.");
    }
    if (user.status === "blocked" || user.status === "suspended") {
      throw new ApiError(403, `Your account is ${user.status}.`);
    }
  }

  const isDev = process.env.NODE_ENV !== "production";

  // Block if a live OTP already exists for this email+purpose (only in production)
  if (!isDev) {
    const existing = await findLatestValidOTP(normalizedEmail, normalizedPurpose);
    if (existing) {
      const remainSecs = Math.ceil((new Date(existing.expiresAt) - Date.now()) / 1000);
      throw new ApiError(
        429,
        `An OTP was already sent. Please wait ${remainSecs}s before requesting again.`
      );
    }
  }

  const otp = isDev ? "123456" : generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.oTP.create({
    data: { email: normalizedEmail, otp: hashed, purpose: normalizedPurpose, expiresAt },
  });

  if (isDev) {
    console.log(`[DEV] Fixed OTP for ${normalizedEmail}: ${otp}`);
  } else {
    await sendOTPEmail(normalizedEmail, otp, normalizedPurpose);
  }

  res.status(200).json(new ApiResponse(200, "OTP sent successfully to your email"));
});

// ── POST /api/v1/auth/user/verify-otp ────────────────────────────────────────
export const verifyOTPAndLogin = asyncHandler(async (req, res) => {
  const { email, otp, role = "user", purpose = "login" } = req.body;
  if (!email || !otp) throw new ApiError(400, "Email and OTP are required");

  const VALID_ROLES = ["user", "owner", "staff"];
  if (!VALID_ROLES.includes(role)) {
    throw new ApiError(400, `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
  }

  const otpRecord = await findLatestValidOTP(email, purpose);
  if (!otpRecord) throw new ApiError(400, "OTP is invalid or has expired");

  const updatedAttempts = otpRecord.attempts + 1;

  if (updatedAttempts > OTP_MAX_ATTEMPTS) {
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true, attempts: updatedAttempts },
    });
    throw new ApiError(429, "Too many incorrect attempts. Please request a new OTP.");
  }

  if (!verifyOTP(otp, otpRecord.otp)) {
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { attempts: updatedAttempts },
    });
    const remaining = OTP_MAX_ATTEMPTS - updatedAttempts;
    throw new ApiError(
      400,
      `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
    );
  }

  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { isUsed: true, attempts: updatedAttempts },
  });

  // Upsert user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        fullName: email.split("@")[0],
        email,
        role,
        isEmailVerified: true,
        status: "active",
      },
    });
  } else {
    user = await prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        lastLoginAt: new Date(),
        status: user.status === "pending" ? "active" : user.status,
      },
    });
  }

  const { accessToken, refreshTokenValue } = await issueTokens(user, req);
  res.cookie("refreshToken", refreshTokenValue, refreshCookieOptions);

  res.status(200).json(
    new ApiResponse(200, "Login successful", {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar || null,
      },
    })
  );
});

export const requestOwnerOTP = asyncHandler(async (req, res) => {
  const { email, purpose = "login" } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPurpose = purpose.trim().toLowerCase();

  // Check if owner exists and is active
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      role: "owner",
      isDeleted: false,
    },
  });
  if (!user) {
    throw new ApiError(404, "Owner account not found. Please sign up first.");
  }
  if (user.status === "blocked" || user.status === "suspended") {
    throw new ApiError(403, `Your account is ${user.status}.`);
  }

  const isDev = process.env.NODE_ENV !== "production";

  // Block if a live OTP already exists for this email+purpose (only in production)
  if (!isDev) {
    const existing = await findLatestValidOTP(normalizedEmail, normalizedPurpose);
    if (existing) {
      const remainSecs = Math.ceil((new Date(existing.expiresAt) - Date.now()) / 1000);
      throw new ApiError(
        429,
        `An OTP was already sent. Please wait ${remainSecs}s before requesting again.`
      );
    }
  }

  const otp = isDev ? "123456" : generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.oTP.create({
    data: { email: normalizedEmail, otp: hashed, purpose: normalizedPurpose, expiresAt },
  });

  if (isDev) {
    console.log(`[DEV] Fixed OTP for ${normalizedEmail}: ${otp}`);
  } else {
    await sendOTPEmail(normalizedEmail, otp, normalizedPurpose);
  }

  res.status(200).json(new ApiResponse(200, "OTP sent successfully to your email"));
});

export const verifyOwnerOTPAndLogin = asyncHandler(async (req, res) => {
  const { email, otp, purpose = "login" } = req.body;
  if (!email || !otp) throw new ApiError(400, "Email and OTP are required");

  const role = "owner";

  const otpRecord = await findLatestValidOTP(email, purpose);
  if (!otpRecord) throw new ApiError(400, "OTP is invalid or has expired");

  const updatedAttempts = otpRecord.attempts + 1;

  if (updatedAttempts > OTP_MAX_ATTEMPTS) {
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true, attempts: updatedAttempts },
    });
    throw new ApiError(429, "Too many incorrect attempts. Please request a new OTP.");
  }

  if (!verifyOTP(otp, otpRecord.otp)) {
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { attempts: updatedAttempts },
    });
    const remaining = OTP_MAX_ATTEMPTS - updatedAttempts;
    throw new ApiError(
      400,
      `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
    );
  }

  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { isUsed: true, attempts: updatedAttempts },
  });

  // Upsert user
  let user = await prisma.user.findFirst({ where: { email, role } });
  if (!user) {
    // Check if user exists with another role
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(403, "Email already registered with a different role.");
    }

    user = await prisma.user.create({
      data: {
        fullName: email.split("@")[0],
        email,
        role,
        isEmailVerified: true,
        status: "active",
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        lastLoginAt: new Date(),
        status: user.status === "pending" ? "active" : user.status,
      },
    });
  }

  const { accessToken, refreshTokenValue } = await issueTokens(user, req);
  res.cookie("refreshToken", refreshTokenValue, refreshCookieOptions);

  res.status(200).json(
    new ApiResponse(200, "Owner login successful", {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        avatar: user.avatar || null,
      },
    })
  );
});

// ── POST /api/v1/auth/user/refresh-token ─────────────────────────────────────
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incoming) throw new ApiError(401, "Refresh token not provided");

  let decoded;
  try {
    decoded = verifyToken(incoming, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const stored = await prisma.refreshToken.findFirst({
    where: {
      token: incoming,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
  if (!stored) throw new ApiError(401, "Refresh token has been revoked or expired");

  const user = stored.user;
  if (!user || user.isDeleted) throw new ApiError(401, "User not found");

  // Rotate — revoke old, issue fresh
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { isRevoked: true },
  });

  const { accessToken, refreshTokenValue } = await issueTokens(user, req);
  res.cookie("refreshToken", refreshTokenValue, refreshCookieOptions);

  res.status(200).json(new ApiResponse(200, "Token refreshed", { accessToken }));
});

// ── POST /api/v1/auth/user/logout ─────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.refreshToken || req.body?.refreshToken;

  if (incoming) {
    await prisma.refreshToken.updateMany({
      where: { token: incoming, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  res.clearCookie("refreshToken");
  res.status(200).json(new ApiResponse(200, "Logged out successfully"));
});
