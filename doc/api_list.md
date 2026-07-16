# API Endpoints List

This document lists all API endpoints defined in the routes directory and explains their core functionalities.

---

## 1. Admin APIs (`/admin/*`)
These endpoints are designed exclusively for system administrators to manage the platform at a high level.
* **Bookings**: Fetches all bookings made across the entire platform, allowing admins to oversee transaction volumes and resolve high-level disputes.
* **Commission**: Manages the revenue model. Admins can set a global platform fee or define specific commission rates for individual properties, rooms, or extra packages.
* **Dashboard**: Aggregates platform-wide statistics (total users, total revenue, active properties) to power the main admin dashboard charts.
* **Owners**: Lists all registered property owners, likely used for vetting, approving, or suspending property managers on the platform.
* **Payments & Withdrawals**: Oversees all incoming payments from guests and manages payout requests from property owners who want to withdraw their earnings.
* **Reports**: Generates downloadable or viewable financial and operational reports across the platform.

## 2. Authentication APIs (`/auth/*`)
These handle security, identity verification, and access tokens.
* **Admin Auth**: Standard email/password login and session management specifically for super admins.
* **User & Owner Auth**: Handles OTP-based authentication (requesting and verifying One-Time Passwords) for both standard guests and property owners. It also handles access token refreshing and staff account creation by owners.

## 3. Property Management APIs (`/property/*`)
This is the largest module, providing property owners with the tools to manage their listings.
* **Core Property Data**: Huge suite of endpoints for creating and updating a property's basic info, location, contact details, policies, images, and connected bank accounts. It also allows owners to publish a white-labeled website using a builder/template.
* **Rooms, Amenities & Pricing**: Allows owners to define specific rooms, block out dates on the calendar for maintenance or external bookings, and set complex dynamic pricing rules (e.g., weekend rates vs. weekday rates).
* **Packages & Extras**: Enables upselling by allowing owners to create comprehensive packages or extra add-ons.
* **Owner Analytics**: Gives owners access to their own customer lists, reviews, property-specific dashboards, and wallets.

## 4. Staff APIs (`/staff/*`)
Designed for receptionists and on-the-ground employees at a specific property. Provides a dedicated dashboard for daily operations, allowing staff to view check-ins/check-outs, search bookings, and update statuses.

## 5. Website / Public APIs (`/website/*`)
These are the public-facing endpoints consumed by the booking engine frontend when a guest is browsing a property's website.
* **Browsing**: Fetches public properties, specific website data via slug, featured rooms, and available packages for guests to browse without logging in.
* **Booking Engine**: Calculates dynamic pricing for selected dates and creates the actual booking records.
* **Post-Booking**: Verifies payments, allows guests to download their booking tickets, and provides endpoints to submit and read property reviews.

## 6. Integrations (`/webhook/*`, `/whatsapp/*`)
* **Webhook**: Endpoints listen for asynchronous, real-time payment events from the payment gateway to automatically confirm bookings in the background.
* **WhatsApp**: Connects to a WhatsApp business API to send automated notifications (like booking confirmations, reminders, or OTPs) directly to users' phones.

---

## Detailed Endpoint List

## File: `admin/admin.booking.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/` | getAdminBookings |

## File: `admin/admin.commission.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/global` | getGlobalCommission |
| **POST** | `/global` | updateGlobalCommission |
| **GET** | `/properties` | getPropertiesCommissions |
| **PATCH** | `/properties/:id` | updatePropertyCommission |
| **PATCH** | `/rooms/:id` | updateRoomCommission |
| **PATCH** | `/packages/:id` | updatePackageCommission |

## File: `admin/admin.dashboard.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/` | getAdminDashboard |

## File: `admin/admin.owner.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/` | getOwners |

## File: `admin/admin.payment.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/` | getAdminPayments |

## File: `admin/admin.report.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/` | getAdminReports |

## File: `admin/admin.withdrawals.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/` | verifyAdminToken, adminListWithdrawals |
| **PATCH** | `/:id` | verifyAdminToken, adminUpdateWithdrawal |

## File: `auth/admin.auth.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/login` | login |
| **POST** | `/logout` | logout |
| **GET** | `/me` | verifyAdminToken, getMe |

## File: `auth/user.auth.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/request-otp` | otpRateLimiter, requestOTP |
| **POST** | `/verify-otp` | verifyOTPAndLogin |
| **POST** | `/owner/request-otp` | otpRateLimiter, requestOwnerOTP |
| **POST** | `/owner/verify-otp` | verifyOwnerOTPAndLogin |
| **POST** | `/refresh-token` | refreshAccessToken |
| **POST** | `/logout` | verifyUserToken, logout |

## File: `auth/user.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/signup` | otpRateLimiter, ownerSignup |
| **POST** | `/staff` | ...ownerOnly, createStaff |
| **GET** | `/staff` | ...ownerOnly, getStaff |
| **DELETE** | `/staff/:staffId` | ...ownerOnly, removeStaff |

## File: `property/admin.property.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/` | getProperties |
| **GET** | `/pending` | getPendingProperties |
| **GET** | `/:id` | getPropertyForReview |
| **POST** | `/:id/verify` | verifyProperty |
| **PATCH** | `/:id/website-access` | toggleWebsiteAccess |

## File: `property/availability.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/:id/rooms/availability` | getRoomAvailability |
| **GET** | `/:id/rooms/:roomId/blocks` | ...ownerOnly, getRoomBlocks |
| **POST** | `/:id/rooms/:roomId/blocks` | ...ownerOnly, createRoomBlock |
| **DELETE** | `/:id/rooms/:roomId/blocks/:blockId` | ...ownerOnly, deleteRoomBlock |

## File: `property/extra-package.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/:propertyId/extras` | ...ownerOnly, createExtraPackage |
| **PATCH** | `/:propertyId/extras/:extraId` | ...ownerOnly, updateExtraPackage |
| **DELETE** | `/:propertyId/extras/:extraId` | ...ownerOnly, deleteExtraPackage |
| **GET** | `/:propertyId/extras` | getPropertyExtraPackages |

## File: `property/package.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/:propertyId/packages` | ...ownerOnly, uploadPackageImages, createPackage |
| **PATCH** | `/:propertyId/packages/:packageId` | ...ownerOnly, uploadPackageImages, updatePackage |
| **DELETE** | `/:propertyId/packages/:packageId` | ...ownerOnly, deletePackage |
| **GET** | `/:propertyId/packages` | getPropertyPackages |
| **GET** | `/packages/images/:imageId` | getPackageImage |

## File: `property/pricing.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/:id/rooms/:roomId/pricing` | ...ownerOnly, getPricingRules |
| **POST** | `/:id/rooms/:roomId/pricing` | ...ownerOnly, createPricingRule |
| **PATCH** | `/:id/rooms/:roomId/pricing/:ruleId` | ...ownerOnly, updatePricingRule |
| **DELETE** | `/:id/rooms/:roomId/pricing/:ruleId` | ...ownerOnly, deletePricingRule |

## File: `property/property.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/` | ...ownerOnly, createProperty |
| **GET** | `/` | verifyUserToken, requireRole("owner", "staff"),... |
| **GET** | `/wallet` | verifyUserToken, requireRole("owner", "staff"),... |
| **PUT** | `/wallet/bank-details` | verifyUserToken, requireRole("owner"), saveBank... |
| **POST** | `/wallet/withdraw` | verifyUserToken, requireRole("owner"), requestW... |
| **GET** | `/:id` | verifyUserToken, requireRole("owner", "staff"),... |
| **DELETE** | `/:id` | ...ownerOnly, deleteProperty |
| **GET** | `/website/templates` | ...ownerOnly, getActiveTemplates |
| **GET** | `/:id/bookings` | verifyUserToken, requireRole("owner", "staff"),... |
| **GET** | `/:id/customers` | verifyUserToken, requireRole("owner", "staff"),... |
| **GET** | `/:id/reviews` | verifyUserToken, requireRole("owner", "staff"),... |
| **GET** | `/:id/reports` | verifyUserToken, requireRole("owner", "staff"),... |
| **GET** | `/:id/dashboard` | verifyUserToken, requireRole("owner", "staff"),... |
| **GET** | `/bookings/verify/:bookingRef` | verifyUserToken, verifyBookingDetails |
| **PATCH** | `/bookings/:id/status` | verifyUserToken, updateBookingStatus |
| **POST** | `/bookings/:id/payment-link` | verifyUserToken, requireRole("owner", "staff"),... |
| **PATCH** | `/:id/basic` | ...ownerOnly, updateBasicInfo |
| **PATCH** | `/:id/address` | ...ownerOnly, updateAddress |
| **PATCH** | `/:id/location` | ...ownerOnly, updateLocation |
| **PATCH** | `/:id/contact` | ...ownerOnly, updateContact |
| **PATCH** | `/:id/policies` | ...ownerOnly, updatePolicies |
| **PATCH** | `/:id/website-template` | ...ownerOnly, updateWebsiteTemplate |
| **PATCH** | `/:id/website-builder` | ...ownerOnly, updateWebsiteBuilder |
| **POST** | `/:id/website-publish` | ...ownerOnly, publishWebsite |
| **PATCH** | `/:id/media` | ...ownerOnly, uploadMedia, updateMedia |
| **DELETE** | `/:id/gallery/:index` | ...ownerOnly, removeGalleryImage |
| **PATCH** | `/:id/gallery/:index` | ...ownerOnly, updateGalleryImage |
| **PATCH** | `/:id/documents` | ...ownerOnly, uploadDocuments, updateDocuments |
| **PATCH** | `/:id/bank` | ...ownerOnly, uploadBankDocs, updateBank |
| **POST** | `/:id/rooms` | ...ownerOnly, uploadRoomImages, createRoom |
| **GET** | `/:id/rooms` | ...ownerOnly, getRooms |
| **PATCH** | `/:id/rooms/:roomId` | ...ownerOnly, uploadRoomImages, updateRoom |
| **DELETE** | `/:id/rooms/:roomId` | ...ownerOnly, deleteRoom |
| **POST** | `/:id/amenities` | ...ownerOnly, addAmenity |
| **DELETE** | `/:id/amenities/:amenityId` | ...ownerOnly, removeAmenity |
| **POST** | `/:id/submit` | ...ownerOnly, submitForApproval |
| **GET** | `/:id/is-verified` | ...ownerOnly, checkPropertyVerified |
| **GET** | `/:id/verification-details` | ...ownerOnly, getVerificationDetails |
| **GET** | `/:id/logo` | getPropertyLogo |
| **GET** | `/:id/cover` | getPropertyCover |
| **GET** | `/gallery/:id` | getGalleryImage |
| **GET** | `/rooms/images/:id` | getRoomImage |

## File: `staff/staff.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/dashboard` | getStaffDashboard |
| **GET** | `/bookings/checkins` | getTodayCheckins |
| **GET** | `/bookings/checkouts` | getTodayCheckouts |
| **GET** | `/bookings/search` | searchBookings |
| **POST** | `/bookings/:id/status` | updateBookingStatus |
| **GET** | `/guests` | getStaffGuests |

## File: `webhook/webhook.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/razorpay` | handleRazorpayWebhook |

## File: `website/website.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **GET** | `/properties/all` | getAllPublicProperties |
| **GET** | `/:slug` | getWebsiteData |
| **GET** | `/:slug/rooms/featured` | getFeaturedRooms |
| **GET** | `/:slug/packages/featured` | getFeaturedPackages |
| **GET** | `/:slug/rooms` | getPublicRooms |
| **GET** | `/:slug/packages` | getPublicPackages |
| **GET** | `/:slug/extras` | getPublicExtraPackages |
| **POST** | `/:slug/bookings/calculate` | calculatePrice |
| **POST** | `/:slug/bookings` | createBooking |
| **POST** | `/:slug/bookings/verify-payment` | verifyPayment |
| **GET** | `/:slug/bookings/:bookingRef/ticket` | downloadTicket |
| **GET** | `/:slug/bookings/:bookingRef/review` | getReviewFormData |
| **POST** | `/:slug/bookings/:bookingRef/review` | submitReview |
| **GET** | `/:slug/reviews` | getPropertyReviews |

## File: `whatsapp/whatsapp.routes.js`

| Method | Endpoint | Controller/Handler |
|--------|----------|--------------------|
| **POST** | `/connect` | connectWhatsApp |
| **GET** | `/status` | getWhatsAppStatus |
| **POST** | `/disconnect` | disconnectWhatsApp |
| **POST** | `/send` | sendWhatsAppNotification |

