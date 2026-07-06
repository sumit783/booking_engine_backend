import { Router } from "express";
import { login, logout, getMe } from "../../controllers/auth/admin.auth.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.post("/login", login);
router.post("/logout", logout);

// Protected routes (require valid Supabase token)
router.get("/me", verifyAdminToken, getMe);

export default router;
