import { Router } from "express";
import {
  getGlobalCommission,
  updateGlobalCommission,
  getPropertiesCommissions,
  updatePropertyCommission,
  updateRoomCommission,
  updatePackageCommission,
} from "../../controllers/admin/admin.commission.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Protect all routes with admin token
router.use(verifyAdminToken);

router.get("/global", getGlobalCommission);
router.post("/global", updateGlobalCommission);

router.get("/properties", getPropertiesCommissions);
router.patch("/properties/:id", updatePropertyCommission);
router.patch("/rooms/:id", updateRoomCommission);
router.patch("/packages/:id", updatePackageCommission);

export default router;
