import { Router } from "express";
import { getAdminDashboard } from "../../controllers/admin/admin.dashboard.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all dashboard admin routes with admin token
router.use(verifyAdminToken);

router.get("/", getAdminDashboard);

export default router;
