import { DataTypes, Op } from "sequelize";
import { sequelize } from "../../config/db.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Full name is required" },
        len: {
          args: [2, 100],
          msg: "Full name must be between 2 and 100 characters",
        },
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: { msg: "Invalid email address" },
        notEmpty: { msg: "Email is required" },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "active", "suspended", "blocked"),
      defaultValue: "pending",
    },
    role: {
      type: DataTypes.ENUM("owner", "staff"),
      defaultValue: "owner",
    },
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLoginIP: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Virtual getter
    isActive: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.status === "active" && !this.isDeleted;
      },
    },
  },
  {
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ["lastLoginIP", "isDeleted"] },
    },
    scopes: {
      withDeleted: {
        attributes: {},
      },
    },
  }
);

// ── Instance methods ──────────────────────────────────────────────────────────
User.prototype.isRestricted = function () {
  return this.status === "blocked" || this.status === "suspended";
};

// For backward compatibility with Mongoose's _id to id mapping in JSON
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id; // Alias _id for MongoDB compatibility in controller
  return values;
};

// ── Static methods ────────────────────────────────────────────────────────────
User.findByIdActive = async function (id) {
  return this.findOne({ where: { id, isDeleted: false } });
};

User.findStaff = function () {
  return this.findAll({
    where: {
      role: "staff",
      isDeleted: false,
      status: { [Op.ne]: "blocked" },
    },
    attributes: ["id", "fullName", "email", "phone", "status", "isEmailVerified", "lastLoginAt", "createdAt"],
    order: [["createdAt", "DESC"]],
  });
};

export default User;
