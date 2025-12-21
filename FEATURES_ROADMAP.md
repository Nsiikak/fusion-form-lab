# Plagohive Features Integration Roadmap

This document outlines the next features to be integrated into the platform, following the modular backend architecture and frontend integration patterns established with authentication.

## Completed Features ✅

1. **Authentication System**
   - User registration and login
   - JWT token management
   - Role-based access control (customer, vendor, admin)
   - Protected routes
   - User profile display

## Next Features to Integrate

### 1. Vendor Registration (Priority: High)

**Backend:**

- Create `backend/app/entities/vendor/` structure:
  - `model.py` - Vendor model (business_name, category, location, description, pricing, etc.)
  - `schema.py` - Vendor schemas (VendorCreate, VendorResponse, VendorUpdate)
  - `service.py` - Vendor business logic (create_vendor, get_vendor, update_vendor)
- Create `backend/app/routers/vendor.py`:
  - `POST /api/vendors/register` - Register new vendor (requires auth)
  - `GET /api/vendors/me` - Get current vendor's profile
  - `PUT /api/vendors/me` - Update vendor profile
  - `POST /api/vendors/me/documents` - Upload business documents
  - `POST /api/vendors/me/photos` - Upload service photos

**Frontend:**

- Connect `VendorRegistration.tsx` form to API
- Add file upload functionality for documents and photos
- Add form validation and error handling
- Show registration status and verification status

**Database Models:**

- Vendor table with fields: business_name, category, location, description, starting_price, business_size, registration_number, user_id (FK), verification_status, etc.
- VendorDocument table for uploaded documents
- VendorPhoto table for service photos

---

### 2. Vendor Search & Listing (Priority: High)

**Backend:**

- Create `backend/app/entities/vendor/` search functionality:
  - `GET /api/vendors` - List vendors with filters (category, location, price range, rating)
  - `GET /api/vendors/{id}` - Get vendor details
  - `GET /api/vendors/search` - Search vendors by name/description
- Add filtering, pagination, and sorting

**Frontend:**

- Connect `VendorSearch.tsx` to real API
- Implement search functionality
- Add filters (category, location, price range)
- Display vendor cards with real data
- Add vendor detail page/modal

**Database:**

- Add indexes for search performance
- Add vendor availability/status fields

---

### 3. Bookings Management (Priority: High)

**Backend:**

- Create `backend/app/entities/booking/` structure:
  - `model.py` - Booking model (customer_id, vendor_id, event_id, status, price, date, etc.)
  - `schema.py` - Booking schemas
  - `service.py` - Booking logic (create_booking, update_booking_status, get_bookings)
- Create `backend/app/routers/booking.py`:
  - `POST /api/bookings` - Create new booking (customer)
  - `GET /api/bookings` - Get user's bookings (customer or vendor)
  - `GET /api/bookings/{id}` - Get booking details
  - `PUT /api/bookings/{id}/status` - Update booking status (vendor: accept/decline)
  - `DELETE /api/bookings/{id}` - Cancel booking

**Frontend:**

- Create booking form/modal in VendorSearch
- Connect CustomerDashboard bookings to API
- Connect VendorDashboard bookings to API
- Add booking status management (accept/decline for vendors)
- Add booking cancellation

**Database:**

- Booking table: id, customer_id, vendor_id, event_id, status, price, booking_date, event_date, created_at, updated_at
- BookingStatus enum: pending, confirmed, declined, cancelled, completed

---

### 4. Events Management (Priority: Medium)

**Backend:**

- Create `backend/app/entities/event/` structure:
  - `model.py` - Event model (name, date, location, customer_id, total_budget, etc.)
  - `schema.py` - Event schemas
  - `service.py` - Event logic
- Create `backend/app/routers/event.py`:
  - `POST /api/events` - Create new event
  - `GET /api/events` - Get user's events
  - `GET /api/events/{id}` - Get event details
  - `PUT /api/events/{id}` - Update event
  - `DELETE /api/events/{id}` - Delete event

**Frontend:**

- Connect CustomerDashboard events to API
- Create event creation form
- Display events with associated bookings
- Event management (edit, delete)

**Database:**

- Event table: id, customer_id, name, date, location, description, total_budget, status, created_at

---

### 5. Reviews & Ratings (Priority: Medium)

**Backend:**

- Create `backend/app/entities/review/` structure:
  - `model.py` - Review model (customer_id, vendor_id, booking_id, rating, comment)
  - `schema.py` - Review schemas
  - `service.py` - Review logic
- Create `backend/app/routers/review.py`:
  - `POST /api/reviews` - Create review (customer, after booking completion)
  - `GET /api/vendors/{id}/reviews` - Get vendor reviews
  - `PUT /api/reviews/{id}` - Update review
  - `DELETE /api/reviews/{id}` - Delete review

**Frontend:**

- Add review form after booking completion
- Display reviews on vendor profiles
- Show average ratings
- Review management in dashboards

**Database:**

- Review table: id, customer_id, vendor_id, booking_id, rating (1-5), comment, created_at
- Calculate average rating for vendors

---

### 6. Additional Features (Priority: Low)

**Messaging System:**

- Real-time messaging between customers and vendors
- WebSocket integration or polling-based chat

**Payment Integration:**

- Payment processing for bookings
- Booking deposits and full payments
- Payment history

**Notifications:**

- Email notifications for booking status changes
- In-app notifications
- SMS notifications (optional)

**Analytics & Reporting:**

- Vendor analytics (bookings, earnings, reviews)
- Customer analytics (events, spending)
- Admin dashboard

**File Storage:**

- Cloud storage integration (AWS S3, Cloudinary) for vendor photos and documents
- Image optimization and resizing

---

## Implementation Order

1. **Vendor Registration** - Complete the vendor onboarding flow
2. **Vendor Search & Listing** - Enable customers to find vendors
3. **Bookings Management** - Core functionality for the platform
4. **Events Management** - Organize bookings by events
5. **Reviews & Ratings** - Build trust and quality assurance

## Technical Considerations

- Follow the same modular structure established with authentication
- Use entity-based architecture: `entities/{entity_name}/` with model, schema, service
- Keep routers thin, delegate to services
- Use consistent error handling and response formats
- Implement proper validation on both backend and frontend
- Add pagination for list endpoints
- Consider caching for frequently accessed data (vendor listings)
- Add database indexes for performance
- Implement proper file upload handling
- Add rate limiting for API endpoints
- Consider adding API versioning (`/api/v1/`)

## Database Schema Overview

```
Users (existing)
├── Vendors
│   ├── VendorDocuments
│   └── VendorPhotos
├── Events
├── Bookings
└── Reviews
```
