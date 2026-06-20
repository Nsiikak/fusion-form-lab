Platform QA & Product Feedback Report (Round 2)

Prepared for: Nsikak-Abasi, CTO
Objective: Document additional observations, feature recommendations, and workflow
improvements identified during platform testing and review.

1. Executive Summary

Following an additional round of platform testing, several observations were made regarding
user experience, booking workflows, vendor onboarding, notification systems, payout processes,
and future scalability requirements.

This report focuses on refining existing functionality while highlighting product improvements,
particularly around multi-vendor event management, communications infrastructure, and
operational automation.

2. Product & Functional Feedback

2.1 Brand Visibility & UI Enhancement

Observation

The platform logo appears relatively small within the navigation header.

Recommendation

Increase logo dimensions slightly while maintaining responsive design standards.

Expected Benefit





Stronger brand presence

Improved visual hierarchy

 More polished first impression for users

2.2 Session Persistence Validation

Observation

Authentication state now persists correctly on the landing page.

Feedback

This implementation is working as expected and significantly improves user experience by
maintaining authenticated sessions across navigation flows.

Status

✅ Confirmed Working

2.3 Vendor Pricing Structure Optimization

Observation

The current vendor registration flow may benefit from clearer pricing categorization.

Recommendation

Base Rate Definition

The vendor's base rate should represent the cost of their lowest-priced service or product.

Example:





Parfait = ₦10,000

Base Rate = ₦10,000

This allows:

 More accurate vendor discovery





Better search and filtering capabilities

Improved budget-based matching

Service Fee Handling

Service fees should be entered during vendor registration as a percentage and applied to all
bookings separately from product pricing.

This is important because:









Service fees vary by vendor

Service fees may vary by volume of order

Fees may change over time

They should not distort search pricing

Standalone Service Providers

For vendors such as:

 DJs

 MCs

 Hosts



Event Coordinators

Allow:





Base Rate entry only if possible

Service fee is base rate in this case, volume of order here doesn’t affect anything.

Logistics Costs

Instead of percentage-based logistics fees, implement:

 Average Fixed logistics amount

 Vendor-defined transportation charge

This more accurately reflects real-world delivery and transportation costs.

2.4 CAC Verification Notification

Observation

A verification email was not received following successful CAC verification.

Clarification Required

Is the verification email limited to:

 Automated verifications?

Recommendation

Regardless of verification method, vendors should receive:

 Verification confirmation email

 Approval notification

 Next-step guidance

Expected Benefit

Improves transparency and onboarding confidence.

2.5 Review Request Email Trigger

Observation

Review request emails were not received after a completed booking.

Recommendation

Automatically trigger review requests immediately after the vendor marks a booking as
completed.

Suggested workflow:

Vendor Marks Complete
↓
Customer Receives Completion Notification
↓
Customer Receives Review Request

Expected Benefit

Higher review participation rates and more accurate feedback collection.

2.6 Restrict Vendor-to-Vendor Bookings

Observation

Vendor accounts currently have the ability to book other vendors.

Risk

This introduces potential loopholes including:

 Artificial booking generation

 Manipulation of platform metrics



Potential abuse of promotional incentives

Recommendation

Restrict booking functionality to customer accounts only.

If a vendor wishes to make a booking, they should:





Create a customer account

Switch account types where applicable

Priority

High

2.7 Enhanced Quantity Selection During Booking

Observation

The current booking workflow relies primarily on increment/decrement controls.

Recommendation

Allow customers to manually enter numeric quantities in addition to the plus/minus controls.

Example:

Quantity: [ 250 ]

instead of requiring 250 button clicks.

Expected Benefit

Improved usability for large-volume orders.

2.8 Booking Details Navigation

Observation

The updated booking details workflow functions correctly.

Feedback

The current implementation provides the expected booking-specific context and resolves the
previously reported navigation issue.

Status

✅ Confirmed Working

2.9 Profile Image Handling

Observation

Vendor profile pictures currently override or replace vendor product images in certain views.

Recommendation

Separate image management logic for:







Profile images

Product/service gallery images

Cover/banner images

Expected Benefit

Preserves product visibility and improves vendor presentation.

2.10 Bank Account Verification Service

Observation

Bank account verification appears limited to three attempts.

Clarification Requested

Please confirm:

 Which verification provider/API is currently integrated?

 Whether the limitation originates from:

The provider

Internal validation logic

Fraud prevention controls

o

o

o

Recommendation

Review the current restriction and assess whether limits should be configurable.

2.11 Completed Improvements

The following implementations are functioning well and deserve recognition:

Successfully Implemented

✅ Analytics Dashboard

✅ Booking Completion Date Restrictions

✅ Forgot Password Functionality

These updates noticeably improve platform maturity and production readiness.

2.12 Customer Address Collection

Observation

Booking workflows currently do not consistently capture customer location details.

Recommendation

Require address information during booking creation.

Suggested fields:



Event Address

 Venue Name





City

State

 Delivery Instructions (Optional)

Expected Benefit

Improved vendor preparation and logistics planning.

2.13 Post-Booking Cancellation Flexibility

Observation

Cancellation functionality should remain available after bookings are created.

Recommendation

Allow cancellations at all stages while future policy rules determine:







Refund eligibility

Cancellation penalties

Timing restrictions

Expected Benefit

Provides operational flexibility while policies are being finalized.

2.14 Upcoming Events Definition

Observation

Dashboard displays:

"2 Vendor Bookings Accepted"
"0 Upcoming Events"

Clarification Required

Please confirm the logic used for Upcoming Events.

Questions:

 Does it represent accepted bookings?





Confirmed bookings?

Events occurring within a specific date range?



Events with completed payment?

Recommendation

Define and document event lifecycle statuses to avoid ambiguity.

2.15 Payout Automation

Clarification Requested

Please confirm whether vendor payouts are:





Fully automated

Semi-automated

 Manual approval based

Recommendation

If not already implemented, consider automated payout processing tied to booking completion
workflows.

3. Product Enhancements

3.1 Multi-Vendor Event Management

Observation

Many real-world events require multiple vendors under a single event plan.

Recommendation

Introduce an Event Planning model where customers can:

1. Create an event

2. Add multiple vendors

3. Manage all services under one booking structure

4. Make a consolidated payment

Example

Birthday Party
├── Caterer
├── Decorator
├── DJ
├── Photographer

Each vendor:



Receives individual notifications

 Manages their own deliverables



Tracks independent payment allocation

Strategic Value

This feature significantly increases:

 Average transaction value





Platform stickiness

Event planning convenience

Priority

High (Future Release)

3.2 In-App Messaging / Chat Functionality

Recommendation

Evaluate implementation of real-time communication between:



Customers

 Vendors



Platform Support

Potential features:







Booking-specific conversations

File/image sharing

Read receipts

 Automated notifications

Technical Considerations

Possible implementation options:

 WebSockets





Firebase Messaging

Third-party chat infrastructure

Strategic Value

Would significantly reduce communication friction and improve booking conversion rates.

Priority

Medium to High (Future Release)

4. Summary

The platform continues to show strong progress toward production readiness. The recently
completed implementations around analytics, authentication recovery, and booking completion
controls have substantially improved system maturity.

The next areas of focus should be:

1. Vendor pricing model refinement

2. Review automation

3. Vendor booking restrictions

4. Customer address capture

5. Payout workflow clarification

6. Multi-vendor event planning architecture

7. communication infrastructure

Collectively, these improvements will strengthen operational controls, improve user experience,
and provide a clearer foundation for future platform scalability.


