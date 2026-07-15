import { DataTypes, Op } from "sequelize";
import { sequelize } from "../../config/db.js";

export const OTP_MAX_ATTEMPTS = 3;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

const OTP = sequelize.define(
  "OTP",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    otp: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    purpose: {
      type: DataTypes.ENUM("login", "signup", "email_verification"),
      allowNull: false,
      defaultValue: "login",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ["otp"] },
    },
    scopes: {
      withOtp: {
        attributes: {},
      },
    },
    indexes: [
      {
        fields: ["email", "purpose", "isUsed", "expiresAt"],
      },
    ],
  }
);

// Alias _id for MongoDB compatibility in JSON
OTP.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  delete values.otp;
  return values;
};

// ── Static methods ────────────────────────────────────────────────────────────
OTP.findLatestValid = function (email, purpose = "login") {
  return this.scope("withOtp").findOne({
    where: {
      email,
      purpose,
      isUsed: false,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [["createdAt", "DESC"]],
  });
};

OTP.invalidateAll = function (email) {
  return this.update(
    { isUsed: true },
    {
      where: {
        email,
        isUsed: false,
        expiresAt: { [Op.gt]: new Date() },
      },
    }
  );
};

export default OTP;
