"""booking add-ons; event occasion type and checklist

Revision ID: b7d2f4a9c1e6
Revises: a1c5e7f9b3d2
Create Date: 2026-10-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7d2f4a9c1e6"
down_revision: Union[str, Sequence[str], None] = "a1c5e7f9b3d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "booking_addons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("platform_fee", sa.Numeric(12, 2), nullable=False),
        sa.Column("customer_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="proposed"),
        sa.Column("payment_reference", sa.String(64), nullable=True, unique=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("refund_id", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_booking_addons_booking", "booking_addons", ["booking_id"])
    op.add_column("events", sa.Column("event_type", sa.String(30), nullable=True))
    op.add_column("events", sa.Column("checklist", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "checklist")
    op.drop_column("events", "event_type")
    op.drop_index("ix_booking_addons_booking", table_name="booking_addons")
    op.drop_table("booking_addons")
