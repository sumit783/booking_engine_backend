import mongoose from "mongoose";

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },

    token: {
      type: String,
      required: [true, "Token is required"],
      select: false, // never leaks in aggregate pipelines
    },

    device: {
      type: String,
      trim: true,
      maxlength: [200, "Device string too long"],
    },

    ipAddress: {
      type: String,
      trim: true,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, "User-agent string too long"],
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
    },

    isRevoked: {
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
        delete ret.token; // raw JWT never in API responses
        return ret;
      },
    },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
refreshTokenSchema.index({ token: 1 }, { sparse: true });
refreshTokenSchema.index({ user: 1, isRevoked: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Static methods ────────────────────────────────────────────────────────────
refreshTokenSchema.statics.findValid = function (rawToken) {
  return this.findOne({
    token: rawToken,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).select("+token");
};

refreshTokenSchema.statics.revokeAllForUser = function (userId) {
  return this.updateMany(
    { user: userId, isRevoked: false },
    { $set: { isRevoked: true } }
  );
};

refreshTokenSchema.statics.countActiveSessions = function (userId) {
  return this.countDocuments({
    user: userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });
};

export default mongoose.model("RefreshToken", refreshTokenSchema);
