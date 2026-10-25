"""Business KPIs for the admin dashboard and the downloadable report.

One function computes everything for a period, so the dashboard, the PDF and the CSV always agree.
Bookings count in the period they were PAID (checkout started counts by creation date)."""
import csv
import io
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.entities.booking.model import Booking, BookingStatus
from app.entities.user.model import User, UserRole
from app.entities.vendor.incident import VendorIncident
from app.entities.vendor.model import Vendor, VerificationStatus

D0 = Decimal("0")


def _d(v) -> Decimal:
    return Decimal(str(v or 0))


def _aware(dt):
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def compute(db: Session, start: datetime, end: datetime) -> dict:
    paid = (db.query(Booking).filter(Booking.paid_at.isnot(None), Booking.paid_at >= start, Booking.paid_at < end).all())
    started = db.query(func.count(Booking.id)).filter(Booking.created_at >= start, Booking.created_at < end).scalar() or 0

    n = len(paid)
    gmv = sum((_d(b.price) for b in paid), D0)
    customer_paid = sum((_d(b.customer_total) for b in paid), D0)
    # Declined/expired bookings and full refunds earn nothing, whether or not the refund has landed yet
    fully_refunded = [b for b in paid if b.status == BookingStatus.DECLINED
                      or _d(b.refund_amount) >= _d(b.customer_total) * Decimal("0.99")]
    revenue = sum((_d(b.commission_amount) + _d(b.platform_fee) for b in paid if b not in fully_refunded), D0)
    refunded_total = sum((_d(b.refund_amount) for b in paid if b.refund_status in ("refunded", "processing")), D0)

    customers = {b.customer_id for b in paid}
    # repeat: customers in the period with 2+ paid bookings up to the period end
    repeat = 0
    if customers:
        counts = dict(db.query(Booking.customer_id, func.count(Booking.id)).filter(
            Booking.customer_id.in_(customers), Booking.paid_at.isnot(None), Booking.paid_at < end
        ).group_by(Booking.customer_id).all())
        repeat = sum(1 for c in customers if counts.get(c, 0) >= 2)

    accepted = [b for b in paid if b.status in (BookingStatus.CONFIRMED, BookingStatus.AWAITING_CONFIRMATION,
                                                 BookingStatus.COMPLETED, BookingStatus.DISPUTED)
                or (b.status == BookingStatus.CANCELLED and b.cancelled_by in ("customer", "vendor") and b.reconfirmed_at)]
    declined = [b for b in paid if b.status == BookingStatus.DECLINED]
    cancelled = [b for b in paid if b.status == BookingStatus.CANCELLED]
    completed = [b for b in paid if b.status == BookingStatus.COMPLETED]
    disputed = [b for b in paid if b.disputed_at is not None]
    decided = len(accepted) + len(declined)

    no_shows = db.query(func.count(VendorIncident.id)).filter(
        VendorIncident.kind == "no_show", VendorIncident.created_at >= start, VendorIncident.created_at < end).scalar() or 0
    payouts = db.query(func.coalesce(func.sum(Booking.payout_amount), 0)).filter(
        Booking.payout_paid_at >= start, Booking.payout_paid_at < end).scalar() or 0

    active_vendors = db.query(func.count(Vendor.id)).filter(
        Vendor.is_active == True, Vendor.verification_status == VerificationStatus.APPROVED).scalar() or 0  # noqa: E712
    new_vendors = db.query(func.count(Vendor.id)).filter(Vendor.created_at >= start, Vendor.created_at < end).scalar() or 0
    pending_vendors = db.query(func.count(Vendor.id)).filter(Vendor.verification_status == VerificationStatus.PENDING).scalar() or 0
    new_customers = db.query(func.count(User.id)).filter(
        User.role == UserRole.CUSTOMER, User.created_at >= start, User.created_at < end).scalar() or 0
    vendors_with_booking = len({b.vendor_id for b in paid})

    # by category and top vendors
    vendors = {v.id: v for v in db.query(Vendor).filter(Vendor.id.in_({b.vendor_id for b in paid})).all()} if paid else {}
    cat = defaultdict(lambda: {"bookings": 0, "gmv": D0})
    top = defaultdict(lambda: {"bookings": 0, "gmv": D0})
    for b in paid:
        v = vendors.get(b.vendor_id)
        key = v.category.value if v else "other"
        cat[key]["bookings"] += 1
        cat[key]["gmv"] += _d(b.price)
        top[b.vendor_id]["bookings"] += 1
        top[b.vendor_id]["gmv"] += _d(b.price)
    by_category = sorted(({"category": k, "bookings": x["bookings"], "gmv": float(x["gmv"])} for k, x in cat.items()),
                         key=lambda r: -r["gmv"])
    top_vendors = sorted(({"vendor": vendors[k].business_name if k in vendors else str(k), "bookings": x["bookings"],
                           "gmv": float(x["gmv"])} for k, x in top.items()), key=lambda r: -r["gmv"])[:5]

    # time series: daily up to 31 days, weekly up to 120, else monthly
    span = (end - start).days
    unit = "day" if span <= 31 else "week" if span <= 120 else "month"

    def bucket(dt):
        dt = _aware(dt)
        if unit == "day":
            return dt.strftime("%Y-%m-%d")
        if unit == "week":
            monday = dt - timedelta(days=dt.weekday())
            return monday.strftime("%Y-%m-%d")
        return dt.strftime("%Y-%m")

    series = defaultdict(lambda: {"bookings": 0, "gmv": D0, "revenue": D0})
    for b in paid:
        k = bucket(b.paid_at)
        series[k]["bookings"] += 1
        series[k]["gmv"] += _d(b.price)
        if b not in fully_refunded:
            series[k]["revenue"] += _d(b.commission_amount) + _d(b.platform_fee)
    # fill gaps so charts show quiet periods
    keys, cur = [], _aware(start)
    while cur < end:
        k = bucket(cur)
        if k not in keys:
            keys.append(k)
        cur += timedelta(days=1)
    series_out = [{"period": k, "bookings": series[k]["bookings"], "gmv": float(series[k]["gmv"]),
                   "revenue": float(series[k]["revenue"])} for k in keys]

    pct = lambda a, b: round(100 * a / b, 1) if b else None  # noqa: E731
    return {
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": span, "unit": unit},
        "kpis": {
            "paid_bookings": n,
            "gmv": float(gmv),
            "customer_paid": float(customer_paid),
            "revenue": float(revenue),
            "take_rate_pct": pct(revenue, gmv),
            "average_booking_value": float(gmv / n) if n else 0,
            "unique_customers": len(customers),
            "average_customer_value": float(gmv / len(customers)) if customers else 0,
            "repeat_customer_pct": pct(repeat, len(customers)),
            "checkouts_started": started,
            "checkout_conversion_pct": pct(n, started),
            "acceptance_rate_pct": pct(len(accepted), decided),
            "completed_bookings": len(completed),
            "cancellation_rate_pct": pct(len(cancelled), n),
            "cancelled_by_vendor": sum(1 for b in cancelled if b.cancelled_by == "vendor"),
            "cancelled_by_customer": sum(1 for b in cancelled if b.cancelled_by == "customer"),
            "refunded_total": float(refunded_total),
            "dispute_rate_pct": pct(len(disputed), n),
            "no_shows": no_shows,
            "payouts_paid": float(payouts),
            "active_vendors": active_vendors,
            "vendors_with_bookings": vendors_with_booking,
            "new_vendors": new_vendors,
            "pending_vendors": pending_vendors,
            "new_customers": new_customers,
        },
        "series": series_out,
        "by_category": by_category,
        "top_vendors": top_vendors,
    }


LABELS = [
    ("paid_bookings", "Paid bookings", "n"), ("gmv", "Booking value (GMV)", "ngn"), ("revenue", "Plagohive revenue", "ngn"),
    ("take_rate_pct", "Take rate", "pct"), ("average_booking_value", "Average booking value", "ngn"),
    ("unique_customers", "Customers who booked", "n"), ("average_customer_value", "Average value per customer", "ngn"),
    ("repeat_customer_pct", "Repeat customers", "pct"), ("checkouts_started", "Checkouts started", "n"),
    ("checkout_conversion_pct", "Checkout conversion", "pct"), ("acceptance_rate_pct", "Vendor acceptance rate", "pct"),
    ("completed_bookings", "Completed bookings", "n"), ("cancellation_rate_pct", "Cancellation rate", "pct"),
    ("cancelled_by_vendor", "Cancelled by vendors", "n"), ("cancelled_by_customer", "Cancelled by customers", "n"),
    ("refunded_total", "Refunded to customers", "ngn"), ("dispute_rate_pct", "Dispute rate", "pct"),
    ("no_shows", "Vendor no-shows", "n"), ("payouts_paid", "Paid out to vendors", "ngn"),
    ("active_vendors", "Active verified vendors", "n"), ("vendors_with_bookings", "Vendors with a booking", "n"),
    ("new_vendors", "New vendor sign-ups", "n"), ("pending_vendors", "Vendors awaiting review", "n"),
    ("new_customers", "New customer sign-ups", "n"),
]


def fmt(value, kind):
    if value is None:
        return "—"
    if kind == "ngn":
        return f"NGN {Decimal(str(value)):,.2f}"
    if kind == "pct":
        return f"{value}%"
    return f"{value:,}"


def report_csv(m: dict) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Plagohive KPI report", m["period"]["start"][:10], "to", m["period"]["end"][:10]])
    w.writerow([])
    w.writerow(["KPI", "Value"])
    for key, label, kind in LABELS:
        w.writerow([label, m["kpis"][key]])
    w.writerow([])
    w.writerow([f"By {m['period']['unit']}", "Paid bookings", "Booking value (NGN)", "Revenue (NGN)"])
    for r in m["series"]:
        w.writerow([r["period"], r["bookings"], r["gmv"], r["revenue"]])
    w.writerow([])
    w.writerow(["Category", "Paid bookings", "Booking value (NGN)"])
    for r in m["by_category"]:
        w.writerow([r["category"], r["bookings"], r["gmv"]])
    w.writerow([])
    w.writerow(["Top vendors", "Paid bookings", "Booking value (NGN)"])
    for r in m["top_vendors"]:
        w.writerow([r["vendor"], r["bookings"], r["gmv"]])
    return buf.getvalue().encode("utf-8-sig")   # BOM so Excel opens it cleanly


def report_pdf(m: dict) -> bytes:
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

    from app.services import documents as doc

    start, end = m["period"]["start"][:10], (datetime.fromisoformat(m["period"]["end"]) - timedelta(days=1)).date().isoformat()
    story = doc._header("KPI REPORT", f"{start} to {end}", f"Generated {datetime.now(timezone.utc):%d %b %Y}")
    k = m["kpis"]
    headline = [("Paid bookings", fmt(k["paid_bookings"], "n")), ("Booking value", fmt(k["gmv"], "ngn")),
                ("Revenue", fmt(k["revenue"], "ngn")), ("Avg booking", fmt(k["average_booking_value"], "ngn"))]
    t = Table([[Paragraph(f"<font size=8 color='#6B7280'>{a.upper()}</font><br/><b>{b}</b>", doc.S["body"]) for a, b in headline]],
              colWidths=[doc.PAGE_W / 4] * 4)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), doc.SOFT), ("BOX", (0, 0), (-1, -1), 0.5, doc.LINE),
                           ("INNERGRID", (0, 0), (-1, -1), 0.5, doc.LINE), ("TOPPADDING", (0, 0), (-1, -1), 8),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story += [t, Spacer(1, 14), Paragraph("<b>All KPIs</b>", doc.S["body"]), Spacer(1, 6)]
    rows = [(label, fmt(k[key], kind)) for key, label, kind in LABELS]
    story.append(doc._lines_table([(a, b) for a, b in rows[:-1]], rows[-1][0], rows[-1][1], show_qty=False))
    story += [Spacer(1, 14), Paragraph(f"<b>By {m['period']['unit']}</b>", doc.S["body"]), Spacer(1, 6)]
    series = [r for r in m["series"] if r["bookings"]] or m["series"][-1:]
    st = Table([["Period", "Paid bookings", "Booking value", "Revenue"]] +
               [[r["period"], str(r["bookings"]), fmt(r["gmv"], "ngn"), fmt(r["revenue"], "ngn")] for r in series],
               colWidths=[doc.PAGE_W * 0.25] * 4, repeatRows=1)
    st.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                            ("LINEBELOW", (0, 0), (-1, 0), 0.8, doc.INK), ("LINEBELOW", (0, 1), (-1, -1), 0.3, doc.LINE),
                            ("ALIGN", (1, 0), (-1, -1), "RIGHT")]))
    story.append(st)
    if m["by_category"]:
        story += [Spacer(1, 14), Paragraph("<b>By category</b>", doc.S["body"]), Spacer(1, 6)]
        ct = Table([["Category", "Paid bookings", "Booking value"]] +
                   [[r["category"].title(), str(r["bookings"]), fmt(r["gmv"], "ngn")] for r in m["by_category"]],
                   colWidths=[doc.PAGE_W / 3] * 3)
        ct.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                                ("LINEBELOW", (0, 0), (-1, 0), 0.8, doc.INK), ("ALIGN", (1, 0), (-1, -1), "RIGHT")]))
        story.append(ct)
    story += doc._footer_note("Bookings are counted in the period they were paid. Revenue is commission plus customer "
                              "platform fees, excluding fully refunded bookings.")
    return doc._build(story, f"Plagohive KPI report {start} to {end}")
