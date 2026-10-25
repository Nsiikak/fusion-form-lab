"""cancellation policies, vendor incidents, reconfirmation, check-in, countdown reminders

Revision ID: a1c5e7f9b3d2
Revises: f3a8d2c6b9e4
Create Date: 2026-10-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1c5e7f9b3d2"
down_revision: Union[str, Sequence[str], None] = "f3a8d2c6b9e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BOOKING_COLS = [
    ("policy_snapshot", sa.JSON()), ("cancelled_by", sa.String(10)), ("cancelled_at", sa.DateTime(timezone=True)),
    ("cancellation_reason", sa.Text()), ("refund_amount", sa.Numeric(12, 2)), ("penalty_deducted", sa.Numeric(12, 2)),
    ("reconfirmed_at", sa.DateTime(timezone=True)), ("checked_in_at", sa.DateTime(timezone=True)),
    ("reminders", sa.JSON()), ("dispute_kind", sa.String(20)), ("response_due_at", sa.DateTime(timezone=True)),
    ("vendor_responded_at", sa.DateTime(timezone=True)),
]


def upgrade() -> None:
    op.add_column("vendors", sa.Column("cancellation_policy", sa.String(20), nullable=False, server_default="standard"))
    for name, type_ in BOOKING_COLS:
        op.add_column("bookings", sa.Column(name, type_, nullable=True))
    # Existing bookings follow the Standard policy
    op.execute("""UPDATE bookings SET policy_snapshot = '{"key": "standard", "label": "Standard",
        "summary": "Full refund up to 14 days before, 50% up to 7 days, 25% up to 48 hours.",
        "tiers": [[14, 100], [7, 50], [2, 25]]}'::json WHERE policy_snapshot IS NULL""")
    op.create_table(
        "vendor_incidents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("fee", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("fee_remaining", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vendor_incidents_vendor", "vendor_incidents", ["vendor_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_vendor_incidents_vendor", table_name="vendor_incidents")
    op.drop_table("vendor_incidents")
    for name, _ in reversed(BOOKING_COLS):
        op.drop_column("bookings", name)
    op.drop_column("vendors", "cancellation_policy")
