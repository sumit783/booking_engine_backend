import crypto from "crypto";

/**
 * Generate a 6-digit numeric OTP using cryptographically secure randomness.
 */
export const generateOTP = () => {
  return String(crypto.randomInt(100000, 999999));
};

/**
 * Hash the OTP with SHA-256 before storing it in the DB.
 * Deterministic — no salt needed for short-lived tokens.
 */
export const hashOTP = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

/**
 * Compare a plain OTP against the stored SHA-256 hash.
 */
export const verifyOTP = (plain, hashed) => {
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  return hash === hashed;
};
