import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";
import { prisma } from "../config/db.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// ── User: verify JWT access token ────────────────────────────────────────────
export const verifyUserToken = asyncHandler(async (req, _res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.headers?.authorization?.replace("Bearer ", "");

  if (!token) throw new ApiError(401, "Unauthorized: no token provided");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new ApiError(401, "Unauthorized: invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(decoded.id || decoded._id) },
  });
  if (!user || user.isDeleted) {
    throw new ApiError(401, "Unauthorized: user not found");
  }
  if (user.status === "blocked" || user.status === "suspended") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  req.user = user;
  next();
});

// ── Role guard factory ────────────────────────────────────────────────────────
/**
 * Usage:
 *   router.get("/owner-only", verifyUserToken, requireRole("owner"), handler)
 *   router.get("/both",       verifyUserToken, requireRole("owner","staff"), handler)
 */
export const requireRole = (...roles) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw new ApiError(401, "Unauthorized: authenticate first");
    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Forbidden: requires role ${roles.join(" or ")}`
      );
    }
    next();
  });

// ── Backward-compat alias (used in old owner routes) ─────────────────────────
export const verifyOwnerToken = verifyUserToken;

// ── Require Verified Property (Owner only) ────────────────────────────────────
export const requireVerifiedProperty = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw new ApiError(401, "Unauthorized: authenticate first");
  
  if (req.user.role !== "owner") {
    return next();
  }

  const property = await prisma.property.findFirst({
    where: {
      userId: req.user.id,
      status: "APPROVED",
      isDeleted: false,
    },
  });

  if (!property) {
    throw new ApiError(403, "Forbidden: Property verification required");
  }

  req.property = property;
  next();
});

// ── Admin: verify Supabase session access token ───────────────────────────────
export const verifyAdminToken = asyncHandler(async (req, _res, next) => {
  const token = req.headers?.authorization?.replace("Bearer ", "");
  if (!token) throw new ApiError(401, "Unauthorized: no token provided");

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ApiError(401, "Unauthorized: invalid or expired Supabase token");
  }

  req.admin = data.user;
  next();
});

