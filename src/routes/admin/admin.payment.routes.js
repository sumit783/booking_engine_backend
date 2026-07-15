import { Router } from "express";
import { getAdminPayments } from "../../controllers/admin/admin.payment.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all payment admin routes with admin token
router.use(verifyAdminToken);

router.get("/", getAdminPayments);

export default router;
