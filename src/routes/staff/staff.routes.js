import { Router } from "express";
import { verifyUserToken } from "../../middleware/auth.middleware.js";
import { getStaffDashboard } from "../../controllers/staff/staff.dashboard.controller.js";
import { getTodayCheckins, getTodayCheckouts, searchBookings, updateBookingStatus } from "../../controllers/staff/staff.booking.controller.js";
import { getStaffGuests } from "../../controllers/staff/staff.guest.controller.js";

const router = Router();

// Protect all staff routes
router.use(verifyUserToken);

// Dashboard
router.get("/dashboard", getStaffDashboard);

// Bookings
router.get("/bookings/checkins", getTodayCheckins);
router.get("/bookings/checkouts", getTodayCheckouts);
router.get("/bookings/search", searchBookings);
router.post("/bookings/:id/status", updateBookingStatus);

// Guests
router.get("/guests", getStaffGuests);

export default router;
