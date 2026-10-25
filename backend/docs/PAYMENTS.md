# Payments, escrow and payouts

## Fee model

| | Formula | Visible to |
|---|---|---|
| Vendor total (`price`) | base rate + service items + vendor service fee % + logistics fee | Customer, vendor |
| Platform fee | vendor total × 2.5% | Customer only |
| Customer total | vendor total + platform fee — the amount charged | Customer only |
| Commission | vendor total × 10% | Vendor only |
| Payout | vendor total − commission | Vendor only |

All prices are calculated on the server in `app/services/pricing.py`. The checkout UI shows the
`POST /api/bookings/quote` response and never computes totals itself. Rates are set by
`PLATFORM_CUSTOMER_FEE_RATE` and `VENDOR_COMMISSION_RATE`. Changing them affects new bookings
only; existing bookings keep the figures stored when they were created.

## Booking lifecycle

```
awaiting_payment ──(Paystack confirms)──▶ pending ──vendor accepts──▶ confirmed
      │                                     │  └─vendor declines──▶ declined  (auto full refund)
      │ (60 min, unpaid)                    └─customer cancels──▶ cancelled (auto full refund)
      ▼                                                    confirmed ─customer cancels─▶ cancelled (refund → admin review)
  cancelled                                                confirmed ─vendor marks done (on/after event date)─▶ awaiting_confirmation
                                                           awaiting_confirmation ─customer confirms, or 24h passes─▶ completed (payout)
```

Vendors never see, and are never emailed about, a booking until it has been paid.

## How a payment is confirmed

1. `POST /api/bookings` creates an `awaiting_payment` booking and returns a server-generated
   reference and the amount in kobo.
2. The browser opens the Paystack popup with that reference and amount.
3. `POST /api/bookings/{id}/verify-payment` asks Paystack to verify the transaction. It checks the
   status, the reference, the exact amount in kobo and the currency.
4. **Backstop:** the `charge.success` webhook performs the same check. This covers customers who
   close the tab before step 3 runs.

Confirmation is idempotent, so emails are sent exactly once. If a payment arrives after the
checkout has expired, it is refunded automatically.

## Paystack dashboard setup (do this before going live)

- **Webhook URL:** `https://<api-domain>/api/payments/webhook/paystack`. Set it for both the test
  and live modes.
- **Transfers:** disable the OTP requirement for transfers (Settings → Preferences). If OTP is
  left on, API payouts stall waiting for a code.
- **Balance:** keep enough in the Paystack balance to cover payouts. A failed transfer shows up in
  the admin attention list and can be retried.
- **Going live:** swap `sk_test_`/`pk_test_` for `sk_live_`/`pk_live_` on the backend and in
  `VITE_PAYSTACK_PUBLIC_KEY`, then rebuild the frontend.

## Admin operations

| Endpoint | Purpose |
|---|---|
| `GET /api/bookings/admin/attention` | Failed payouts, failed refunds, and cancellations awaiting a refund decision |
| `POST /api/bookings/{id}/refund` | Full refund. Blocked once the vendor has been paid out. |
| `POST /api/bookings/{id}/retry-payout` | Retry a failed payout. It reuses the same Paystack reference, so it can't double-pay. |

Refunds are full refunds. Paystack keeps its processing fee on the original charge, so every
refund costs the platform that fee.

## Tests

`pytest -q` from `backend/` runs the payment suite against a throwaway Postgres database
(`DATABASE_URL`, default `postgresql://plago:plago@localhost:5432/plago_test`). Paystack is
faked, so the suite needs no network access.
