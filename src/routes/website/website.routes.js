import { Router } from "express";
import {
  getWebsiteData,
  getPublicRooms,
  getPublicPackages,
  getPublicExtraPackages,
  getAllPublicProperties,
  getFeaturedRooms,
  getFeaturedPackages,
} from "../../controllers/website/website.controller.js";
import {
  calculatePrice,
  createBooking,
} from "../../controllers/website/booking.controller.js";
import { verifyPayment } from "../../controllers/website/payment.controller.js";
import { downloadTicket } from "../../controllers/website/ticket.controller.js";
import {
  getReviewFormData,
  submitReview,
  getPropertyReviews,
} from "../../controllers/website/review.controller.js";

const router = Router();

// GET /api/v1/website/properties/all - list all public properties for homepage
router.get("/properties/all", getAllPublicProperties);

// GET /api/v1/website/:slug            – full property data for homepage
router.get("/:slug", getWebsiteData);

// GET /api/v1/website/:slug/rooms/featured      – top 3 public rooms listing
router.get("/:slug/rooms/featured", getFeaturedRooms);

// GET /api/v1/website/:slug/packages/featured   – top 3 public packages listing
router.get("/:slug/packages/featured", getFeaturedPackages);

// GET /api/v1/website/:slug/rooms      – public rooms listing
router.get("/:slug/rooms", getPublicRooms);

// GET /api/v1/website/:slug/packages   – public packages listing
router.get("/:slug/packages", getPublicPackages);

// GET /api/v1/website/:slug/extras     – public extra packages listing
router.get("/:slug/extras", getPublicExtraPackages);

// POST /api/v1/website/:slug/bookings/calculate
router.post("/:slug/bookings/calculate", calculatePrice);

// POST /api/v1/website/:slug/bookings
router.post("/:slug/bookings", createBooking);

// POST /api/v1/website/:slug/bookings/verify-payment
router.post("/:slug/bookings/verify-payment", verifyPayment);

// GET /api/v1/website/:slug/bookings/:bookingRef/ticket
router.get("/:slug/bookings/:bookingRef/ticket", downloadTicket);

// GET  /api/v1/website/:slug/bookings/:bookingRef/review  – get review form data
router.get("/:slug/bookings/:bookingRef/review", getReviewFormData);

// POST /api/v1/website/:slug/bookings/:bookingRef/review  – submit a review
router.post("/:slug/bookings/:bookingRef/review", submitReview);

// GET /api/v1/website/:slug/reviews   – public: approved reviews for property
router.get("/:slug/reviews", getPropertyReviews);

export default router;

