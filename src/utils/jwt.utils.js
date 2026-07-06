import jwt from "jsonwebtoken";

/**
 * Sign a short-lived access token (default 15 min).
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m",
  });
};

/**
 * Sign a long-lived refresh token (default 7 days).
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
  });
};

/**
 * Verify and decode any JWT. Pass the matching secret.
 * Throws if invalid or expired.
 */
export const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};
