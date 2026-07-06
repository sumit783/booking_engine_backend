import { Router } from "express";
import { getWebsiteData } from "../../controllers/website/website.controller.js";

const router = Router();

// GET /api/v1/website/:slug
router.get("/:slug", getWebsiteData);

export default router;
