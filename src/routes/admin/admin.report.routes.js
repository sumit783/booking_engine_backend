import { Router } from "express";
import { getAdminReports } from "../../controllers/admin/admin.report.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all report admin routes with admin token
router.use(verifyAdminToken);

router.get("/", getAdminReports);

export default router;
