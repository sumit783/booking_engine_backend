import rateLimit from "express-rate-limit";

/**
 * Throttle OTP requests to 5 per 15 minutes per IP in production.
 * Prevents email flooding and brute-force enumeration.
 */
const actualLimiter = rateLimit({
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

export const otpRateLimiter = (req, res, next) => {
  console.log(`[RateLimiter Check] NODE_ENV: "${process.env.NODE_ENV}"`);
  if (process.env.NODE_ENV !== "production") {
    return next();
  }
  return actualLimiter(req, res, next);
};
