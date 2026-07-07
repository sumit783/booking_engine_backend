# Built Features and APIs

Based on the current repository structure, here is a detailed breakdown of the features and APIs that have been implemented in the Booking Engine Backend.

## Key Features

1. **Authentication & Authorization**
   - **OTP-Based Login**: Users and Property Owners can log in securely using OTP verification.
   - **Admin Login**: Admins have a standard login mechanism.
   - **Token Management**: JWT-based access and refresh tokens are implemented for secure session management.
   - **Role-Based Access Control**: Different access levels for Admins, Property Owners, and Staff.

2. **Property Management**
   - **Complete Property Lifecycle**: Create, update, and delete properties.
   - **Modular Information Updates**: Dedicated endpoints to update specific property details, including basic info, address, location, contact, and policies.
   - **Media & Document Management**: Upload and manage property gallery, documents, and bank details.
   - **Amenities**: Add or remove amenities for a property.

3. **Property Verification Workflow**
   - **Submission**: Property owners can submit their properties for admin approval.
   - **Admin Review**: Admins can fetch pending properties, review their details, and verify/approve them.
   - **Verification Status**: Owners can check the verification status and details of their properties.

4. **Website Builder & Templates**
   - **Template Management**: Admins can manage (CRUD) website templates.
   - **Property Websites**: Properties can choose a template, use a website builder to customize it, and publish their own website.
   - **Public Access**: Public endpoints to fetch the website data based on a unique slug.

5. **Staff Management**
   - **Property Staff**: Property owners can add, manage, update, and remove staff members who help manage the property.

---

## API Endpoints

### 1. User Authentication (`/api/.../auth/user`)
- `POST /request-otp`: Request OTP for user login.
- `POST /verify-otp`: Verify user OTP and login.
- `POST /owner/request-otp`: Request OTP for property owner.
- `POST /owner/verify-otp`: Verify owner OTP and login.
- `POST /refresh-token`: Refresh JWT access token.
- `POST /logout`: Logout user.

### 2. User Management (`/api/.../user`)
- `POST /signup`: Property owner signup.
- `POST /staff`: Create a new staff member.
- `GET /staff`: Get all staff members for the owner.
- `DELETE /staff/:staffId`: Remove a staff member.

### 3. Admin Authentication (`/api/.../auth/admin`)
- `POST /login`: Admin login.
- `POST /logout`: Admin logout.
- `GET /me`: Get current logged-in admin details.

### 4. Admin Property Verification (`/api/.../admin/properties`)
- `GET /pending`: Get all properties pending verification.
- `GET /:id`: Get specific property details for review.
- `POST /:id/verify`: Verify a property.

### 5. Admin Template Management (`/api/.../admin/templates`)
- `GET /` & `POST /`: Get all templates or create a new template.
- `GET /:id`, `PATCH /:id`, `DELETE /:id`: View, update, or delete a specific template.

### 6. Property Management (`/api/.../property`)
- `POST /`: Create a new property.
- `GET /`: Get all properties owned by the current user.
- `GET /:id`: Get details of a specific property.
- `DELETE /:id`: Delete a property.
- `PATCH /:id/basic`: Update basic information.
- `PATCH /:id/address`: Update address information.
- `PATCH /:id/location`: Update location/map details.
- `PATCH /:id/contact`: Update contact details.
- `PATCH /:id/policies`: Update property policies.
- `PATCH /:id/media`: Upload/update property media (e.g., main images).
- `PATCH /:id/gallery/:index`: Update specific gallery image.
- `DELETE /:id/gallery/:index`: Remove specific gallery image.
- `PATCH /:id/documents`: Upload/update legal documents.
- `PATCH /:id/bank`: Upload/update bank details.
- `POST /:id/amenities`: Add an amenity.
- `DELETE /:id/amenities/:amenityId`: Remove an amenity.

### 7. Property Website & Publishing (`/api/.../property`)
- `GET /website/templates`: Get all active templates available for properties.
- `PATCH /:id/website-template`: Select/update the website template for a property.
- `PATCH /:id/website-builder`: Update custom website builder data.
- `POST /:id/website-publish`: Publish the property website.

### 8. Property Verification (`/api/.../property`)
- `POST /:id/submit`: Submit property for admin approval.
- `GET /:id/is-verified`: Check if the property is verified.
- `GET /:id/verification-details`: Get verification status details.

### 9. Property Staff Management (`/api/.../property-staff`)
- `POST /`: Add a new property staff member.
- `GET /`: Get all staff members for a property.
- `PATCH /:id`: Update staff member details.
- `DELETE /:id`: Remove a staff member.

### 10. Public Website Routes (`/api/.../website`)
- `GET /:slug`: Fetch the published website data for a property using its unique slug.
