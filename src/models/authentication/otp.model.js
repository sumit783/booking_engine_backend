import mongoose from "mongoose";

const { Schema } = mongoose;

/** Maximum allowed verification attempts before an OTP is permanently locked. */
export const OTP_MAX_ATTEMPTS = 3;

/** OTP validity window in milliseconds (5 minutes). */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Staff invite OTP validity window (24 hours). */
export const OTP_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },

    otp: {
      type: String,
      required: [true, "OTP hash is required"],
      select: false, // never expose the hash in query results
    },

    purpose: {
      type: String,
      enum: {
        values: ["login", "signup", "email_verification"],
        message: "{VALUE} is not a valid OTP purpose",
      },
      required: [true, "Purpose is required"],
      default: "login",
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },

    attempts: {
      type: Number,
      default: 0,
      min: [0, "Attempts cannot be negative"],
      max: [OTP_MAX_ATTEMPTS, `Attempts cannot exceed ${OTP_MAX_ATTEMPTS}`],
    },

    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.otp; // never leak the hash
        return ret;
      },
    },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1, isUsed: 1, expiresAt: 1 });

// ── Static methods ────────────────────────────────────────────────────────────
otpSchema.statics.findLatestValid = function (email, purpose = "login") {
  return this.findOne({
    email,
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  })
    .select("+otp")
    .sort({ createdAt: -1 });
};

otpSchema.statics.invalidateAll = function (email) {
  return this.updateMany(
    { email, isUsed: false, expiresAt: { $gt: new Date() } },
    { $set: { isUsed: true } }
  );
};

export default mongoose.model("OTP", otpSchema);
