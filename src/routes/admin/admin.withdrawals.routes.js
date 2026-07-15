import { Router } from "express";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";
import { adminListWithdrawals, adminUpdateWithdrawal } from "../../controllers/property/wallet.controller.js";

const router = Router();

// GET  /api/v1/admin/withdrawals         → list all withdrawal requests (filterable by status)
// PATCH /api/v1/admin/withdrawals/:id   → approve / reject / mark transferred
router.get(  "/",    verifyAdminToken, adminListWithdrawals);
router.patch("/:id", verifyAdminToken, adminUpdateWithdrawal);

export default router;
