import rateLimit from "express-rate-limit";

/**
 * Throttle OTP requests to 5 per 15 minutes per IP.
 * Prevents email flooding and brute-force enumeration.
 */
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    statusCode: 429,
    message: "Too many OTP requests from this IP. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
