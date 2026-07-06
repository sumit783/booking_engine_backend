import { Router } from "express";
import {
  addTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
} from "../../controllers/admin/template.controller.js";
import { verifyAdminToken } from "../../middleware/auth.middleware.js";
import { uploadTemplateMedia } from "../../middleware/upload.middleware.js";

const router = Router();

// Protect all routes with admin token
router.use(verifyAdminToken);

router.route("/")
  .post(uploadTemplateMedia, addTemplate)
  .get(getTemplates);

router.route("/:id")
  .patch(uploadTemplateMedia, updateTemplate)
  .delete(deleteTemplate);

export default router;
