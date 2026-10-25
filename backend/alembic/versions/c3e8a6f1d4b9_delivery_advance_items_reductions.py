"""more vendor categories; delivery by state; mobilisation advance; flexible service items; reductions;
fold vendor service fees into prices

Revision ID: c3e8a6f1d4b9
Revises: b7d2f4a9c1e6
Create Date: 2026-10-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3e8a6f1d4b9"
down_revision: Union[str, Sequence[str], None] = "b7d2f4a9c1e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_CATEGORIES = ["CAKES", "DRINKS", "BEAUTY", "FASHION", "PLANNING", "RENTALS", "SOUND_LIGHTING", "SOUVENIRS", "USHERS_SECURITY"]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for c in NEW_CATEGORIES:
            op.execute(f"ALTER TYPE vendorcategory ADD VALUE IF NOT EXISTS '{c}'")

    op.add_column("vendors", sa.Column("base_state", sa.String(40), nullable=True))
    op.add_column("vendors", sa.Column("interstate_mode", sa.String(10), nullable=False, server_default="none"))
    op.add_column("vendors", sa.Column("interstate_fee", sa.Numeric(10, 2), nullable=True))
    op.add_column("vendors", sa.Column("state_fees", sa.JSON(), nullable=True))
    op.add_column("vendors", sa.Column("advance_mode", sa.String(20), nullable=False, server_default="none"))
    op.add_column("vendors", sa.Column("advance_percent", sa.Integer(), nullable=False, server_default="0"))

    op.add_column("service_items", sa.Column("pricing_type", sa.String(10), nullable=False, server_default="unit"))
    op.add_column("service_items", sa.Column("min_quantity", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("service_items", sa.Column("max_quantity", sa.Integer(), nullable=True))
    op.add_column("service_items", sa.Column("included", sa.JSON(), nullable=True))

    op.add_column("bookings", sa.Column("advance_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("bookings", sa.Column("advance_status", sa.String(20), nullable=True))
    op.add_column("bookings", sa.Column("advance_paid_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("advance_error", sa.Text(), nullable=True))

    op.create_table(
        "booking_reductions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("initiated_by", sa.String(10), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("amount_removed", sa.Numeric(12, 2), nullable=False),
        sa.Column("refund_pct", sa.Integer(), nullable=False),
        sa.Column("refund_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("refund_ids", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Fold each vendor's separate service-fee % into their prices, so customers pay exactly the same
    op.execute("""
        UPDATE service_items si SET unit_price = ROUND(si.unit_price * (1 + v.service_fee_percentage / 100.0), 2)
        FROM vendors v WHERE si.vendor_id = v.id AND COALESCE(v.service_fee_percentage, 0) > 0
    """)
    op.execute("""
        UPDATE vendors SET starting_price = ROUND(starting_price * (1 + service_fee_percentage / 100.0), 2),
                           service_fee_percentage = 0
        WHERE COALESCE(service_fee_percentage, 0) > 0
    """)
    # Best guess at each vendor's home state from their location text (vendors can correct it)
    op.execute("""
        UPDATE vendors SET base_state = CASE
            WHEN location ILIKE '%abuja%' OR location ILIKE '%fct%' THEN 'FCT'
            WHEN location ILIKE '%port harcourt%' OR location ILIKE '%rivers%' THEN 'Rivers'
            WHEN location ILIKE '%ibadan%' OR location ILIKE '%oyo%' THEN 'Oyo'
            WHEN location ILIKE '%lagos%' OR location ILIKE '%lekki%' OR location ILIKE '%ikeja%' OR location ILIKE '%surulere%'
                 OR location ILIKE '%victoria island%' OR location ILIKE '%yaba%' OR location ILIKE '%ikoyi%' THEN 'Lagos'
            ELSE NULL END
        WHERE base_state IS NULL
    """)


def downgrade() -> None:
    op.drop_table("booking_reductions")
    for c in ("advance_error", "advance_paid_at", "advance_status", "advance_amount"):
        op.drop_column("bookings", c)
    for c in ("included", "max_quantity", "min_quantity", "pricing_type"):
        op.drop_column("service_items", c)
    for c in ("advance_percent", "advance_mode", "state_fees", "interstate_fee", "interstate_mode", "base_state"):
        op.drop_column("vendors", c)
    # Enum values cannot be removed in PostgreSQL; the folded prices are kept.
