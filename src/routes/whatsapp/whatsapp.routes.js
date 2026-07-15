import { Router } from "express";
import { 
  connectWhatsApp, 
  getWhatsAppStatus, 
  disconnectWhatsApp, 
  sendWhatsAppNotification 
} from "../../controllers/whatsapp/whatsapp.controller.js";
import { verifyUserToken } from "../../middleware/auth.middleware.js";

const router = Router();

// Apply auth middleware to protect all WhatsApp actions
router.use(verifyUserToken);

router.post("/connect", connectWhatsApp);
router.get("/status", getWhatsAppStatus);
router.post("/disconnect", disconnectWhatsApp);
router.post("/send", sendWhatsAppNotification);

export default router;
