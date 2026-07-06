import User from "../../models/authentication/user.model.js";
import OTP, { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "../../models/authentication/otp.model.js";
import RefreshToken from "../../models/authentication/refreshToken.model.js";
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

// ── Cookie options for the refresh token ─────────────────────────────────────
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// ── Helper: sign both tokens and persist the refresh token ───────────────────
const issueTokens = async (user, req) => {
  const payload = { _id: user._id, email: user.email, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshTokenValue = generateRefreshToken(payload);

  await RefreshToken.create({
    user: user._id,
    token: refreshTokenValue,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { accessToken, refreshTokenValue };
};

// ── POST /api/v1/auth/user/request-otp ───────────────────────────────────────
export const requestOTP = asyncHandler(async (req, res) => {
  const { email, purpose = "login" } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  // Block if a live OTP already exists for this email+purpose
  const existing = await OTP.findLatestValid(email, purpose);
  if (existing) {
    const remainSecs = Math.ceil((existing.expiresAt - Date.now()) / 1000);
    throw new ApiError(
      429,
      `An OTP was already sent. Please wait ${remainSecs}s before requesting again.`
    );
  }

  const otp = generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await OTP.create({ email, otp: hashed, purpose, expiresAt });
  await sendOTPEmail(email, otp, purpose);

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

  // Use static helper — opts into select:false otp field automatically
  const otpRecord = await OTP.findLatestValid(email, purpose);
  if (!otpRecord) throw new ApiError(400, "OTP is invalid or has expired");

  otpRecord.attempts += 1;

  if (otpRecord.attempts > OTP_MAX_ATTEMPTS) {
    otpRecord.isUsed = true;
    await otpRecord.save();
    throw new ApiError(429, "Too many incorrect attempts. Please request a new OTP.");
  }

  if (!verifyOTP(otp, otpRecord.otp)) {
    await otpRecord.save();
    const remaining = OTP_MAX_ATTEMPTS - otpRecord.attempts;
    throw new ApiError(
      400,
      `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
    );
  }

  otpRecord.isUsed = true;
  await otpRecord.save();

  // Upsert user
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      fullName: email.split("@")[0],
      email,
      role,
      isEmailVerified: true,
      status: "active",
    });
  } else {
    user.isEmailVerified = true;
    user.lastLoginAt = new Date();
    if (user.status === "pending") user.status = "active";
    await user.save();
  }

  const { accessToken, refreshTokenValue } = await issueTokens(user, req);
  res.cookie("refreshToken", refreshTokenValue, refreshCookieOptions);

  res.status(200).json(
    new ApiResponse(200, "Login successful", {
      accessToken,
      user: {
        id: user._id,
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

  // Check if owner exists
  const user = await User.findOne({ email, role: "owner" });
  if (!user) {
    // 404 can be handled by frontend to redirect to signup
    throw new ApiError(404, "Owner account not found. Please sign up first.");
  }

  // Block if a live OTP already exists for this email+purpose
  const existing = await OTP.findLatestValid(email, purpose);
  if (existing) {
    const remainSecs = Math.ceil((existing.expiresAt - Date.now()) / 1000);
    throw new ApiError(
      429,
      `An OTP was already sent. Please wait ${remainSecs}s before requesting again.`
    );
  }

  const otp = generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await OTP.create({ email, otp: hashed, purpose, expiresAt });
  await sendOTPEmail(email, otp, purpose);

  res.status(200).json(new ApiResponse(200, "OTP sent successfully to your email"));
});

export const verifyOwnerOTPAndLogin = asyncHandler(async (req, res) => {
  const { email, otp, purpose = "login" } = req.body;
  if (!email || !otp) throw new ApiError(400, "Email and OTP are required");

  const role = "owner";

  // Use static helper — opts into select:false otp field automatically
  const otpRecord = await OTP.findLatestValid(email, purpose);
  if (!otpRecord) throw new ApiError(400, "OTP is invalid or has expired");

  otpRecord.attempts += 1;

  if (otpRecord.attempts > OTP_MAX_ATTEMPTS) {
    otpRecord.isUsed = true;
    await otpRecord.save();
    throw new ApiError(429, "Too many incorrect attempts. Please request a new OTP.");
  }

  if (!verifyOTP(otp, otpRecord.otp)) {
    await otpRecord.save();
    const remaining = OTP_MAX_ATTEMPTS - otpRecord.attempts;
    throw new ApiError(
      400,
      `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
    );
  }

  otpRecord.isUsed = true;
  await otpRecord.save();

  // Upsert user
  let user = await User.findOne({ email, role });
  if (!user) {
    // Check if user exists with another role
    const existingUser = await User.findOne({ email });
    if(existingUser) {
        throw new ApiError(403, "Email already registered with a different role.");
    }

    user = await User.create({
      fullName: email.split("@")[0],
      email,
      role,
      isEmailVerified: true,
      status: "active",
    });
  } else {
    user.isEmailVerified = true;
    user.lastLoginAt = new Date();
    if (user.status === "pending") user.status = "active";
    await user.save();
  }

  const { accessToken, refreshTokenValue } = await issueTokens(user, req);
  res.cookie("refreshToken", refreshTokenValue, refreshCookieOptions);

  res.status(200).json(
    new ApiResponse(200, "Owner login successful", {
      accessToken,
      user: {
        id: user._id,
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

  // Use static helper — opts into select:false token field
  const stored = await RefreshToken.findValid(incoming);
  if (!stored) throw new ApiError(401, "Refresh token has been revoked or expired");

  const user = await User.findByIdActive(decoded._id);
  if (!user) throw new ApiError(401, "User not found");

  // Rotate — revoke old, issue fresh
  stored.isRevoked = true;
  await stored.save();

  const { accessToken, refreshTokenValue } = await issueTokens(user, req);
  res.cookie("refreshToken", refreshTokenValue, refreshCookieOptions);

  res.status(200).json(new ApiResponse(200, "Token refreshed", { accessToken }));
});

// ── POST /api/v1/auth/user/logout ─────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  const incoming = req.cookies?.refreshToken || req.body?.refreshToken;

  if (incoming) {
    await RefreshToken.findOneAndUpdate(
      { token: incoming, isRevoked: false },
      { isRevoked: true }
    );
  }

  res.clearCookie("refreshToken");
  res.status(200).json(new ApiResponse(200, "Logged out successfully"));
});
