import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import userAuthRouter from "./routes/auth/user.auth.routes.js";
import adminAuthRouter from "./routes/auth/admin.auth.routes.js";
import userRouter from "./routes/auth/user.routes.js";
import propertyRouter from "./routes/property/property.routes.js";
import adminPropertyRouter from "./routes/property/admin.property.routes.js";

import adminTemplateRouter from "./routes/admin/admin.template.routes.js";
import adminCommissionRouter from "./routes/admin/admin.commission.routes.js";
import adminWithdrawalsRouter from "./routes/admin/admin.withdrawals.routes.js";
import adminOwnerRouter from "./routes/admin/admin.owner.routes.js";
import adminBookingRouter from "./routes/admin/admin.booking.routes.js";
import adminPaymentRouter from "./routes/admin/admin.payment.routes.js";
import adminReportRouter from "./routes/admin/admin.report.routes.js";
import adminDashboardRouter from "./routes/admin/admin.dashboard.routes.js";
import staffRouter from "./routes/staff/staff.routes.js";
import websiteRouter from "./routes/website/website.routes.js";
import packageRouter from "./routes/property/package.routes.js";
import extraPackageRouter from "./routes/property/extra-package.routes.js";
import availabilityRouter from "./routes/property/availability.routes.js";
import pricingRouter from "./routes/property/pricing.routes.js";
import whatsappRouter from "./routes/whatsapp/whatsapp.routes.js";
import webhookRouter from "./routes/webhook/webhook.routes.js";
import ApiError from "./utils/apiError.js";
import connectDB from "./config/db.js";

const app = express();

// ── Request logger ───────────────────────────────────────────────────────────
// "dev" format in development (coloured), "combined" (Apache) in production
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["*"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ── Body parsers & cookies ────────────────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Ensure DB Connection for Serverless ──────────────────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/auth/user", userAuthRouter);   // OTP login / refresh / logout
app.use("/api/v1/auth/admin", adminAuthRouter); // Supabase admin auth
app.use("/api/v1/users", userRouter);           // Owner signup, staff management
app.use("/api/v1/properties", propertyRouter);      // Property CRUD + uploads
app.use("/api/v1/properties", packageRouter);       // Package management + images
app.use("/api/v1/properties", extraPackageRouter);  // Extra packages (Breakfast, etc)
app.use("/api/v1/properties", availabilityRouter);  // Room availability blocks
app.use("/api/v1/properties", pricingRouter);       // Pricing rules

app.use("/api/v1/admin/properties", adminPropertyRouter); // Admin property verification
app.use("/api/v1/admin/templates", adminTemplateRouter);  // Admin templates
app.use("/api/v1/admin/commissions", adminCommissionRouter); // Admin commissions
app.use("/api/v1/admin/withdrawals", adminWithdrawalsRouter); // Admin withdrawal requests
app.use("/api/v1/admin/owners", adminOwnerRouter); // Admin owners management
app.use("/api/v1/admin/bookings", adminBookingRouter); // Admin bookings management
app.use("/api/v1/admin/payments", adminPaymentRouter); // Admin payments management
app.use("/api/v1/admin/reports", adminReportRouter); // Admin reports management
app.use("/api/v1/admin/dashboard", adminDashboardRouter); // Admin dashboard summary
app.use("/api/v1/staff", staffRouter);                    // Staff portal API
app.use("/api/v1/website", websiteRouter);                // Public website builder API
app.use("/api/v1/whatsapp", whatsappRouter);              // WhatsApp integration API
app.use("/api/v1/webhooks", webhookRouter);               // Webhooks (e.g. Razorpay)

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res
    .status(404)
    .json({ success: false, statusCode: 404, message: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";
  const errors = err.errors || [];

  if (process.env.NODE_ENV !== "production") {
    console.error(`[Error] ${statusCode} — ${message}`, errors);
  }

  res.status(statusCode).json({ success: false, statusCode, message, errors });
});

export default app;
