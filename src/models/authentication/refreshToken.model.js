import { DataTypes, Op } from "sequelize";
import { sequelize } from "../../config/db.js";
import User from "./user.model.js";

const RefreshToken = sequelize.define(
  "RefreshToken",
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
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    device: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    defaultScope: {
      attributes: { exclude: ["token"] },
    },
    scopes: {
      withToken: {
        attributes: {},
      },
    },
    indexes: [
      {
        fields: ["userId", "isRevoked"],
      },
    ],
  }
);

// Associations
RefreshToken.belongsTo(User, { foreignKey: "userId", as: "userAssociation" });
User.hasMany(RefreshToken, { foreignKey: "userId", as: "refreshTokens" });

// Alias properties for MongoDB controller compatibility
RefreshToken.prototype.toJSON = function () {
  const values = { ...this.get() };
  values.id = values.id;
  values._id = values.id;
  values.user = values.userId; // alias user for controller compatibility
  delete values.token;
  return values;
};

// ── Static methods ────────────────────────────────────────────────────────────
RefreshToken.findValid = function (rawToken) {
  return this.scope("withToken").findOne({
    where: {
      token: rawToken,
      isRevoked: false,
      expiresAt: { [Op.gt]: new Date() },
    },
    include: [{ model: User, as: "userAssociation" }],
  });
};

RefreshToken.revokeAllForUser = function (userId) {
  return this.update(
    { isRevoked: true },
    {
      where: {
        userId,
        isRevoked: false,
      },
    }
  );
};

RefreshToken.countActiveSessions = function (userId) {
  return this.count({
    where: {
      userId,
      isRevoked: false,
      expiresAt: { [Op.gt]: new Date() },
    },
  });
};

export default RefreshToken;
