import { Router } from "express";
import { getAdminBookings } from "../../controllers/admin/admin.booking.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all booking admin routes with admin token
router.use(verifyAdminToken);

router.get("/", getAdminBookings);

export default router;
