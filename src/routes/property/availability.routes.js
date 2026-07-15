import { Router } from "express";
import {
  createRoomBlock,
  deleteRoomBlock,
  getRoomBlocks,
  getRoomAvailability,
} from "../../controllers/property/availability.controller.js";
import { verifyUserToken, requireRole } from "../../middleware/auth.middleware.js";

const router = Router();
const ownerOnly = [verifyUserToken, requireRole("owner")];

// GET    /api/v1/properties/:id/rooms/availability?year=&month=    – owner + public
router.get("/:id/rooms/availability", getRoomAvailability);

// GET    /api/v1/properties/:id/rooms/:roomId/blocks               – owner only
router.get("/:id/rooms/:roomId/blocks", ...ownerOnly, getRoomBlocks);

// POST   /api/v1/properties/:id/rooms/:roomId/blocks               – owner only
router.post("/:id/rooms/:roomId/blocks", ...ownerOnly, createRoomBlock);

// DELETE /api/v1/properties/:id/rooms/:roomId/blocks/:blockId      – owner only
router.delete("/:id/rooms/:roomId/blocks/:blockId", ...ownerOnly, deleteRoomBlock);

export default router;
