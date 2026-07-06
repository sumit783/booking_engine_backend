import mongoose from "mongoose";

const { Schema } = mongoose;

// ── Validators ────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+?[1-9]\d{6,14}$/; // E.164-compatible

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => emailRegex.test(v),
        message: "Invalid email address",
      },
    },

    phone: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: (v) => !v || phoneRegex.test(v),
        message: "Invalid phone number format",
      },
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: {
        values: ["pending", "active", "suspended", "blocked"],
        message: "{VALUE} is not a valid status",
      },
      default: "pending",
    },

    role: {
      type: String,
      enum: {
        values: ["owner", "staff"],
        message: "{VALUE} is not a valid role",
      },
      default: "owner",
    },

    avatar: {
      type: String,
      trim: true,
    },

    lastLoginAt: {
      type: Date,
      select: true,
    },

    lastLoginIP: {
      type: String,
      select: false, // excluded from queries unless explicitly selected
    },

    // Denormalized reference for fast owner→properties lookup
    properties: [
      {
        type: Schema.Types.ObjectId,
        ref: "Property",
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, status: 1 });
userSchema.index({ status: 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────
userSchema.virtual("isActive").get(function () {
  return this.status === "active" && !this.isDeleted;
});

// ── Instance methods ──────────────────────────────────────────────────────────
userSchema.methods.isRestricted = function () {
  return this.status === "blocked" || this.status === "suspended";
};

// ── Static methods ────────────────────────────────────────────────────────────
userSchema.statics.findByIdActive = async function (id) {
  return this.findOne({ _id: id, isDeleted: false });
};

userSchema.statics.findStaff = function () {
  return this.find({ role: "staff", isDeleted: false, status: { $ne: "blocked" } })
    .select("fullName email phone status isEmailVerified lastLoginAt createdAt")
    .sort({ createdAt: -1 });
};

export default mongoose.model("User", userSchema);
