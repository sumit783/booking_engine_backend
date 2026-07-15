import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/v1/website/:slug/bookings/:bookingRef/review
// Returns booking info needed to pre-fill the review form
export const getReviewFormData = async (req, res) => {
  try {
    const { slug, bookingRef } = req.params;

    const booking = await prisma.booking.findFirst({
      where: {
        bookingRef,
        property: { propertySlug: slug },
      },
      include: {
        property: {
          select: { propertyName: true, propertySlug: true },
        },
        room: { select: { name: true } },
        package: { select: { name: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Check if review already submitted
    const existingReview = await prisma.review.findUnique({
      where: { bookingId: booking.id },
    });

    return res.status(200).json({
      success: true,
      data: {
        guestName: booking.guestName,
        propertyName: booking.property.propertyName,
        roomName: booking.room?.name || null,
        packageName: booking.package?.name || null,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        alreadyReviewed: !!existingReview,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/v1/website/:slug/bookings/:bookingRef/review
// Submits a review for a booking
export const submitReview = async (req, res) => {
  try {
    const { slug, bookingRef } = req.params;
    const { rating, title, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({ success: false, message: "Please write at least 10 characters in your review" });
    }

    const booking = await prisma.booking.findFirst({
      where: {
        bookingRef,
        property: { propertySlug: slug },
      },
      include: {
        property: { select: { id: true, propertyName: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Prevent duplicate reviews
    const existing = await prisma.review.findUnique({
      where: { bookingId: booking.id },
    });

    if (existing) {
      return res.status(409).json({ success: false, message: "You have already submitted a review for this booking" });
    }

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        propertyId: booking.property.id,
        guestName: booking.guestName,
        rating: Number(rating),
        title: title?.trim() || null,
        comment: comment.trim(),
        isApproved: false, // owner can approve before it shows publicly
      },
    });

    return res.status(201).json({
      success: true,
      message: "Thank you for your review!",
      data: { id: review.id },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/v1/website/:slug/reviews
// Public: returns approved reviews for a property
export const getPropertyReviews = async (req, res) => {
  try {
    const { slug } = req.params;

    const property = await prisma.property.findUnique({
      where: { propertySlug: slug },
      select: { id: true },
    });

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    const reviews = await prisma.review.findMany({
      where: { propertyId: property.id, isApproved: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
