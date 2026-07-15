import { Router } from "express";
import { getOwners } from "../../controllers/admin/admin.owner.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all owner admin routes with admin token
router.use(verifyAdminToken);

router.get("/", getOwners);

export default router;
