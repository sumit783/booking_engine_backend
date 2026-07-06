import supabase from "../../config/supabase.js";
import ApiError from "../../utils/apiError.js";
import ApiResponse from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── POST /api/v1/auth/admin/login ────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new ApiError(401, error.message);

  res.status(200).json(
    new ApiResponse(200, "Admin login successful", {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      tokenType: data.session.token_type,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        lastSignInAt: data.user.last_sign_in_at,
      },
    })
  );
});

// ── POST /api/v1/auth/admin/logout ───────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  // Invalidate the session on Supabase's side using the JWT from the header
  const token = req.headers?.authorization?.replace("Bearer ", "");
  if (token) {
    // Best-effort — do not throw if this fails
    await supabase.auth.admin.signOut(token).catch(() => {});
  }

  res.status(200).json(new ApiResponse(200, "Admin logged out successfully"));
});

// ── GET /api/v1/auth/admin/me ────────────────────────────────────────────────
// Protected — requires verifyAdminToken middleware
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, "Admin info retrieved", {
      id: req.admin.id,
      email: req.admin.email,
      role: req.admin.role,
      lastSignInAt: req.admin.last_sign_in_at,
    })
  );
});
