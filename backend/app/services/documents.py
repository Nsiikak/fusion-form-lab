"""Financial documents as PDFs: the customer's payment receipt and the vendor's payout statement.

Generated on demand from the booking (nothing stored on disk), so a document always reflects the
booking's current state — e.g. a refunded booking's receipt carries a REFUNDED mark.

Amounts are printed as "NGN 61,500.00": the built-in PDF fonts have no naira glyph, and NGN is
the standard on formal financial documents.
"""
import os
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core import config

BLUE = colors.HexColor("#1565C0")
ORANGE = colors.HexColor("#F57C00")
INK = colors.HexColor("#0D1B2A")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")
SOFT = colors.HexColor("#F5F8FC")
GREEN = colors.HexColor("#15803D")

BANK_NAMES = {
    "044": "Access Bank", "063": "Access Bank (Diamond)", "023": "Citibank Nigeria", "050": "Ecobank Nigeria",
    "070": "Fidelity Bank", "011": "First Bank of Nigeria", "214": "First City Monument Bank", "058": "Guaranty Trust Bank",
    "030": "Heritage Bank", "301": "Jaiz Bank", "082": "Keystone Bank", "076": "Polaris Bank", "101": "Providus Bank",
    "221": "Stanbic IBTC Bank", "068": "Standard Chartered Bank", "232": "Sterling Bank", "100": "SunTrust Bank",
    "032": "Union Bank of Nigeria", "033": "United Bank for Africa", "215": "Unity Bank", "035": "Wema Bank",
    "057": "Zenith Bank", "100004": "Kuda Bank", "999992": "OPay", "999991": "PalmPay",
    "090110": "VFD Microfinance Bank", "090267": "Moniepoint MFB", "565": "Carbon",
}


def ngn(value) -> str:
    return f"NGN {Decimal(str(value or 0)):,.2f}"


def _date(dt: Optional[datetime], with_time: bool = False) -> str:
    if not dt:
        return "—"
    return dt.strftime("%d %b %Y, %H:%M") if with_time else dt.strftime("%d %b %Y")


def _mask(account_number: Optional[str]) -> str:
    return f"******{account_number[-4:]}" if account_number and len(account_number) >= 4 else "—"


def _esc(text) -> str:
    return (str(text or "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ── Styles ───────────────────────────────────────────────────────────────────
S = {
    "brand": ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=22, textColor=BLUE, leading=26),
    "doc": ParagraphStyle("doc", fontName="Helvetica-Bold", fontSize=13, textColor=INK, alignment=TA_RIGHT, leading=16),
    "meta": ParagraphStyle("meta", fontName="Helvetica", fontSize=9, textColor=MUTED, alignment=TA_RIGHT, leading=13),
    "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=7.5, textColor=MUTED, leading=10, spaceAfter=3),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=13.5),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, textColor=MUTED, leading=11.5),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=12.5),
    "cellr": ParagraphStyle("cellr", fontName="Helvetica", fontSize=9.5, textColor=INK, leading=12.5, alignment=TA_RIGHT),
    "head": ParagraphStyle("head", fontName="Helvetica-Bold", fontSize=8, textColor=MUTED, leading=10),
    "headr": ParagraphStyle("headr", fontName="Helvetica-Bold", fontSize=8, textColor=MUTED, leading=10, alignment=TA_RIGHT),
    "total": ParagraphStyle("total", fontName="Helvetica-Bold", fontSize=11, textColor=INK, leading=14),
    "totalr": ParagraphStyle("totalr", fontName="Helvetica-Bold", fontSize=11, textColor=BLUE, leading=14, alignment=TA_RIGHT),
}

PAGE_W = A4[0] - 36 * mm  # usable width with 18mm margins


LOGO = os.path.join(os.path.dirname(__file__), "..", "templates", "assets", "logo.png")


def _header(title: str, number: str, date_line: str, stamp: Optional[tuple] = None) -> list:
    if os.path.exists(LOGO):
        from reportlab.platypus import Image as RLImage
        from reportlab.lib.utils import ImageReader
        iw, ih = ImageReader(LOGO).getSize()
        brand = RLImage(LOGO, width=46 * mm, height=46 * mm * ih / iw)
        brand.hAlign = "LEFT"
    else:
        brand = Paragraph('Plago<font color="#E8770E">hive</font>', S["brand"])
    right = [Paragraph(title, S["doc"]), Paragraph(f"No. {_esc(number)}", S["meta"]), Paragraph(date_line, S["meta"])]
    if stamp:
        text, colour = stamp
        right.append(Spacer(1, 4))
        right.append(Paragraph(f'<font color="{colour}"><b>{text}</b></font>', ParagraphStyle(
            "stamp", fontName="Helvetica-Bold", fontSize=10, alignment=TA_RIGHT, leading=12)))
    t = Table([[brand, right]], colWidths=[PAGE_W * 0.5, PAGE_W * 0.5])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    rule = Table([[""]], colWidths=[PAGE_W], rowHeights=[2])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ORANGE)]))
    return [t, Spacer(1, 10), rule, Spacer(1, 14)]


def _company_block() -> Paragraph:
    lines = [f"<b>{_esc(config.COMPANY_NAME)}</b>"] + [_esc(x) for x in (config.COMPANY_ADDRESS, config.COMPANY_EMAIL) if x]
    if config.COMPANY_RC_NUMBER:
        lines.append(f"RC {_esc(config.COMPANY_RC_NUMBER)}")
    return Paragraph("<br/>".join(lines), S["body"])


def _two_col(left_label: str, left, right_label: str, right) -> Table:
    t = Table(
        [[Paragraph(left_label, S["label"]), Paragraph(right_label, S["label"])], [left, right]],
        colWidths=[PAGE_W * 0.5, PAGE_W * 0.5],
    )
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return t


def _facts(rows: list[tuple[str, str]]) -> Table:
    data = [[Paragraph(k, S["small"]), Paragraph(_esc(v), S["body"])] for k, v in rows]
    t = Table(data, colWidths=[PAGE_W * 0.28, PAGE_W * 0.72])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT), ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _lines_table(rows: list[tuple], total_label: str, total_value: str, show_qty: bool = True) -> Table:
    if show_qty:
        widths = [PAGE_W * 0.42, PAGE_W * 0.08, PAGE_W * 0.26, PAGE_W * 0.24]
        data = [[Paragraph("DESCRIPTION", S["head"]), Paragraph("QTY", S["headr"]),
                 Paragraph("UNIT PRICE", S["headr"]), Paragraph("AMOUNT", S["headr"])]]
        for desc, qty, unit, amount in rows:
            data.append([Paragraph(_esc(desc), S["cell"]), Paragraph(str(qty) if qty else "", S["cellr"]),
                         Paragraph(unit or "", S["cellr"]), Paragraph(amount, S["cellr"])])
        data.append([Paragraph(total_label, S["total"]), "", "", Paragraph(total_value, S["totalr"])])
    else:
        widths = [PAGE_W * 0.7, PAGE_W * 0.3]
        data = [[Paragraph("DESCRIPTION", S["head"]), Paragraph("AMOUNT", S["headr"])]]
        for desc, amount in rows:
            data.append([Paragraph(desc, S["cell"]), Paragraph(amount, S["cellr"])])
        data.append([Paragraph(total_label, S["total"]), Paragraph(total_value, S["totalr"])])

    t = Table(data, colWidths=widths, repeatRows=1)
    last = len(data) - 1
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ("LINEBELOW", (0, 1), (-1, last - 1), 0.4, LINE),
        ("LINEABOVE", (0, last), (-1, last), 1, INK),
        ("BACKGROUND", (0, last), (-1, last), SOFT),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def _footer_note(text: str) -> list:
    return [Spacer(1, 16), Paragraph(text, S["small"]), Spacer(1, 6),
            Paragraph("This document was generated electronically and is valid without a signature.", S["small"])]


def _build(story: list, title: str) -> bytes:
    buf = BytesIO()
    generated = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M UTC")

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(18 * mm, 12 * mm, " · ".join(x for x in [config.COMPANY_NAME, config.COMPANY_EMAIL] if x))
        canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Generated {generated} · Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm,
                            bottomMargin=20 * mm, title=title, author=config.COMPANY_NAME)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()


# ── Customer payment receipt ─────────────────────────────────────────────────

def payment_receipt_pdf(booking) -> bytes:
    customer, vendor = booking.customer, booking.vendor
    address = booking.event_address or {}
    venue = ", ".join(x for x in [address.get("venue_name"), address.get("city"), address.get("state")] if x)

    stamp = ("PAID", "#15803D")
    if booking.refund_status == "refunded":
        stamp = (f"REFUNDED {_date(booking.refunded_at)}".strip(), "#B91C1C")
    elif booking.refund_status in ("processing", "needs_details"):
        stamp = ("REFUND IN PROGRESS", "#B45309")

    customer_lines = [f"<b>{_esc(customer.full_name or customer.email)}</b>", _esc(customer.email)]
    if customer.phone_number:
        customer_lines.append(_esc(customer.phone_number))

    story = _header("PAYMENT RECEIPT", booking.receipt_number or f"BKG-{booking.id}",
                    f"Paid {_date(booking.paid_at, with_time=True)}", stamp)
    story += [_two_col("ISSUED BY", _company_block(), "BILLED TO", Paragraph("<br/>".join(customer_lines), S["body"])),
              Spacer(1, 14)]
    story += [_facts([
        ("Booking", f"#{booking.id}"),
        ("Vendor", f"{vendor.business_name} ({vendor.category.value.title()})" if vendor else "—"),
        ("Event date", _date(booking.event_date) + (f", {booking.event_time.strftime('%H:%M')}" if booking.event_time else "")),
        ("Venue", venue or "—"),
    ]), Spacer(1, 16)]

    rows = []
    items = booking.service_items_snapshot or []
    if items:
        for it in items:
            unit = f"{ngn(it.get('unit_price'))}" + (f" / {it.get('unit_label')}" if it.get("unit_label") else "")
            rows.append((it.get("name"), it.get("quantity"), unit, ngn(it.get("subtotal"))))
    goods = sum(Decimal(str(i.get("subtotal") or 0)) for i in items) if items else None
    vendor_total = Decimal(str(booking.price))
    # Logistics actually charged on this booking (older bookings: what's left after the items)
    if booking.logistics_fee is not None:
        logistics = Decimal(str(booking.logistics_fee))
    elif items:
        logistics = max(Decimal(0), vendor_total - (goods or 0))
    else:
        logistics = Decimal(str(vendor.logistics_fee or 0)) if vendor else Decimal(0)

    if not items:
        # Fixed-rate vendor: one service line (vendor total minus logistics)
        base = vendor_total - logistics
        rows.append((f"{vendor.business_name if vendor else 'Vendor'} — service", 1, ngn(base), ngn(base)))
        goods = base
    other = vendor_total - goods - logistics
    if other > Decimal("0.004"):
        rows.append(("Other vendor charges", None, None, ngn(other)))   # older bookings with a legacy service fee
    if logistics > 0:
        rows.append(("Logistics", None, None, ngn(logistics)))
    if booking.platform_fee:
        rows.append(("Plagohive platform fee", None, None, ngn(booking.platform_fee)))

    total = booking.customer_total if booking.customer_total is not None else booking.price
    story.append(_lines_table(rows, "Total paid", ngn(total)))
    story.append(Spacer(1, 14))
    story.append(_facts([
        ("Payment method", "Paystack"),
        ("Payment reference", booking.payment_reference or "—"),
        ("Amount received", ngn(total)),
    ]))
    story += _footer_note(
        "Your payment is held by Plagohive and released to the vendor only after you confirm the service "
        "(or 24 hours after the vendor marks it complete, if you take no action). If the vendor declines, "
        "you are refunded in full to your original payment method."
    )
    return _build(story, f"Receipt {booking.receipt_number or booking.id}")


# ── Vendor payout statement ──────────────────────────────────────────────────

def payout_statement_pdf(booking) -> bytes:
    vendor, customer = booking.vendor, booking.customer
    owner = vendor.user if vendor else None

    vendor_lines = [f"<b>{_esc(vendor.business_name)}</b>", _esc(vendor.contact_name)]
    if owner:
        vendor_lines.append(_esc(owner.email))
    bank = BANK_NAMES.get(str(vendor.bank_code or ""), "Bank account")
    vendor_lines.append(f"{_esc(bank)} {_mask(vendor.account_number)}")

    status = {"paid": ("PAID", "#15803D")}.get(booking.payout_status, ("PROCESSING", "#B45309"))
    story = _header("PAYOUT STATEMENT", booking.payout_statement_number or f"BKG-{booking.id}",
                    f"Paid {_date(booking.payout_paid_at, with_time=True)}" if booking.payout_paid_at else "Payout in progress",
                    status)
    story += [_two_col("ISSUED BY", _company_block(), "PAID TO", Paragraph("<br/>".join(vendor_lines), S["body"])),
              Spacer(1, 14)]
    story += [_facts([
        ("Booking", f"#{booking.id}"),
        ("Customer", (customer.full_name or customer.email) if customer else "—"),
        ("Event date", _date(booking.event_date)),
        ("Service confirmed", _date(booking.resolved_at or booking.updated_at)),
    ]), Spacer(1, 16)]

    commission = Decimal(str(booking.commission_amount or 0))
    price = Decimal(str(booking.price or 0))
    refunded = Decimal(str(booking.refund_amount or 0)) if booking.cancelled_by == "customer" else Decimal(0)
    if refunded >= price:
        refunded = Decimal(0)
    base = price - refunded
    rate = (commission / base * 100).quantize(Decimal("0.1")) if base else Decimal(0)
    rows = [("Booking amount (your price incl. your fees)", ngn(price))]
    if refunded:
        rows.append(("Refunded to customer under your cancellation policy", f"- {ngn(refunded)}"))
    rows.append((f"Plagohive commission ({rate.normalize():f}%)", f"- {ngn(commission)}"))
    if booking.penalty_deducted:
        rows.append(("Late-cancellation fees recovered from earlier bookings", f"- {ngn(booking.penalty_deducted)}"))
    story.append(_lines_table(rows, "Net payout", ngn(booking.payout_amount), show_qty=False))
    story.append(Spacer(1, 14))
    story.append(_facts([
        ("Paid to", f"{bank} {_mask(vendor.account_number)}"),
        ("Transfer reference", booking.payout_reference or "—"),
        ("Amount transferred", ngn(booking.payout_amount)),
    ]))
    story += _footer_note(
        "Keep this statement for your records. The commission is deducted from each completed booking; "
        "the customer-side platform fee is charged to the customer separately and does not affect your payout."
    )
    return _build(story, f"Payout statement {booking.payout_statement_number or booking.id}")
