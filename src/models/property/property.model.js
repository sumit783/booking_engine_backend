import { DataTypes, Op } from "sequelize";
import { sequelize } from "../../config/db.js";
import User from "../authentication/user.model.js";
import Template from "../admin/template.model.js";

// ── Slug helper ───────────────────────────────────────────────────────────────
const toSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const PROPERTY_TYPES = [
  "HOTEL", "RESORT", "WATER_PARK", "VILLA",
  "HOMESTAY", "FARMHOUSE", "CAMPING", "APARTMENT",
];

export const PROPERTY_STATUSES = [
  "DRAFT", "PENDING", "APPROVED", "REJECTED", "REUPLOADED", "SUSPENDED",
];

const Property = sequelize.define(
  "Property",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    propertyName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: { msg: "Property name is required" },
        len: { args: [2, 150], msg: "Property name must be at least 2 characters" },
      },
    },
    propertySlug: {
      type: DataTypes.STRING(255),
      unique: true,
    },
    propertyType: {
      type: DataTypes.ENUM(...PROPERTY_TYPES),
      allowNull: false,
      validate: {
        isIn: {
          args: [PROPERTY_TYPES],
          msg: "Invalid property type",
        },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    establishedYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1800,
        max: new Date().getFullYear(),
      },
    },
    totalRooms: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: { min: 0 },
    },
    totalFloors: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: { min: 0 },
    },
    checkInTime: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    checkOutTime: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    logo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    coverImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    gallery: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    address: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    location: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    contact: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    amenities: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    policies: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    websiteBuilder: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    templateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Template,
        key: "id",
      },
      onDelete: "SET NULL",
    },
    bank: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    documents: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    status: {
      type: DataTypes.ENUM(...PROPERTY_STATUSES),
      defaultValue: "DRAFT",
    },
    rejectionReason: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    verification: {
      type: DataTypes.JSON,
      defaultValue: {
        ownerDetails: { status: "PENDING" },
        propertyDetails: { status: "PENDING" },
        address: { status: "PENDING" },
        location: { status: "PENDING" },
        contact: { status: "PENDING" },
        websiteBuilder: { status: "PENDING" },
      },
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isLive: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.status === "APPROVED" && !this.isDeleted;
      },
    },
  },
  {
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ["bank", "documents", "isDeleted"] },
    },
    scopes: {
      withSensitive: {
        attributes: {},
      },
    },
  }
);

// Associations
Property.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Property, { foreignKey: "userId", as: "properties" });

Property.belongsTo(User, { foreignKey: "approvedBy", as: "approver" });
Property.belongsTo(Template, { foreignKey: "templateId", as: "template" });

// ── Slug Hook ─────────────────────────────────────────────────────────────────
Property.beforeSave(async (property) => {
  if (property.changed("propertyName") || !property.propertySlug) {
    const baseSlug = toSlug(property.propertyName);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await Property.findOne({
        where: {
          propertySlug: slug,
          id: { [Op.ne]: property.id || 0 },
        },
      });
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }
    property.propertySlug = slug;
  }
  
  // Keep templateId in sync with websiteBuilder.template if updated
  if (property.websiteBuilder && property.websiteBuilder.template) {
    property.templateId = parseInt(property.websiteBuilder.template, 10) || null;
  }
});

// ── Instance methods ──────────────────────────────────────────────────────────
Property.prototype.isApproved = function () {
  return this.status === "APPROVED";
};

Property.prototype.approve = function (adminId) {
  this.status = "APPROVED";
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.rejectionReason = null;
};

Property.prototype.reject = function (reason) {
  this.status = "REJECTED";
  this.rejectionReason = reason;
};

// Alias properties for MongoDB controller compatibility
Property.prototype.toJSON = function () {
  const values = { ...this.get() };
  values._id = values.id;
  
  if (!values.websiteBuilder) values.websiteBuilder = {};
  if (this.template) {
    values.websiteBuilder.template = this.template.toJSON();
  }
  
  return values;
};

// ── Static methods ────────────────────────────────────────────────────────────
Property.findByOwner = function (userId) {
  return this.findAll({
    where: { userId, isDeleted: false },
    order: [["createdAt", "DESC"]],
  });
};

Property.findApproved = function (filter = {}) {
  return this.findAll({
    where: { ...filter, status: "APPROVED", isDeleted: false },
  });
};

Property.findBySlug = function (slug) {
  return this.findOne({
    where: { propertySlug: slug, status: "APPROVED", isDeleted: false },
    include: [{ model: Template, as: "template" }],
  });
};

export default Property;
