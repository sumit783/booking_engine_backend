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
import websiteRouter from "./routes/website/website.routes.js";
import ApiError from "./utils/apiError.js";

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

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1/auth/user", userAuthRouter);   // OTP login / refresh / logout
app.use("/api/v1/auth/admin", adminAuthRouter); // Supabase admin auth
app.use("/api/v1/users", userRouter);           // Owner signup, staff management
app.use("/api/v1/properties", propertyRouter);  // Property CRUD + uploads
app.use("/api/v1/admin/properties", adminPropertyRouter); // Admin property verification
app.use("/api/v1/admin/templates", adminTemplateRouter);  // Admin templates
app.use("/api/v1/website", websiteRouter);                // Public website builder API

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
