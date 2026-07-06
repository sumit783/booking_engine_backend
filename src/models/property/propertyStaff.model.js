import mongoose from "mongoose";

const { Schema } = mongoose;

const staffAddressSchema = new Schema(
  {
    addressLine1: { type: String, trim: true, maxlength: [200, "Too long"] },
    addressLine2: { type: String, trim: true, maxlength: [200, "Too long"] },
    landmark:     { type: String, trim: true, maxlength: [100, "Too long"] },
    city:         { type: String, trim: true, maxlength: [100, "Too long"] },
    district:     { type: String, trim: true, maxlength: [100, "Too long"] },
    state:        { type: String, trim: true, maxlength: [100, "Too long"] },
    country:      { type: String, trim: true, maxlength: [100, "Too long"], default: "India" },
    pincode: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^\d{6}$/.test(v),
        message: "Pincode must be a 6-digit number",
      },
    },
  },
  { _id: false }
);

const propertyStaffSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: [true, "Property reference is required"],
      index: true,
    },
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      trim: true,
     
    },
  
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [80, "First name cannot exceed 80 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [80, "Last name cannot exceed 80 characters"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      required: [true, "Email is required"],
      validate: {
        validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email address",
      },
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^\+?[1-9]\d{6,14}$/.test(v),
        message: "Invalid phone number format",
      },
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, "Department cannot exceed 100 characters"],
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [100, "Designation cannot exceed 100 characters"],
    },
    address: {
      type: staffAddressSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: {
        values: ["Active", "Inactive", "Suspended", "Terminated"],
        message: "{VALUE} is not a valid staff status",
      },
      default: "Active",
    },
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
  }
);

propertyStaffSchema.index({ propertyId: 1, employeeId: 1 }, { unique: true });
propertyStaffSchema.index({ ownerId: 1, propertyId: 1 });

export default mongoose.model("PropertyStaff", propertyStaffSchema);
