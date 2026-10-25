"""payment and payout tracking on bookings

Adds the AWAITING_PAYMENT status, fee/total columns, payment reference
(unique), refund status and payout status/reference/error.

Existing rows are backfilled as already paid (they were created under the old
pay-first flow), with commission and payout derived from the current rates.

Revision ID: c4d8e2a1f6b7
Revises: b9e1d4f2c7a3
Create Date: 2026-10-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d8e2a1f6b7"
down_revision: Union[str, Sequence[str], None] = "b9e1d4f2c7a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enum values are stored by member NAME (see earlier migrations).
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT' BEFORE 'PENDING'")

    op.alter_column("bookings", "price", type_=sa.Numeric(12, 2), existing_nullable=False)

    op.add_column("bookings", sa.Column("platform_fee", sa.Numeric(12, 2), nullable=True))
    op.add_column("bookings", sa.Column("customer_total", sa.Numeric(12, 2), nullable=True))
    op.add_column("bookings", sa.Column("payment_reference", sa.String(100), nullable=True))
    op.add_column("bookings", sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "bookings",
        sa.Column("refund_status", sa.String(20), nullable=False, server_default="none"),
    )
    op.add_column("bookings", sa.Column("commission_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("bookings", sa.Column("payout_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column(
        "bookings",
        sa.Column("payout_status", sa.String(20), nullable=False, server_default="not_due"),
    )
    op.add_column("bookings", sa.Column("payout_reference", sa.String(100), nullable=True))
    op.add_column("bookings", sa.Column("payout_error", sa.Text(), nullable=True))
    op.create_index("ix_bookings_payment_reference", "bookings", ["payment_reference"], unique=True)

    # Backfill legacy bookings
    op.execute(
        """
        UPDATE bookings SET
            paid_at = COALESCE(paid_at, created_at),
            platform_fee = ROUND(price * 0.025, 2),
            customer_total = price + ROUND(price * 0.025, 2),
            commission_amount = ROUND(price * 0.10, 2),
            payout_amount = price - ROUND(price * 0.10, 2),
            payout_status = CASE WHEN paid_out THEN 'paid' ELSE 'not_due' END,
            payout_reference = CASE WHEN paid_out THEN 'TRF_BKG_' || id ELSE NULL END
        """
    )


def downgrade() -> None:
    op.drop_index("ix_bookings_payment_reference", table_name="bookings")
    for col in (
        "payout_error", "payout_reference", "payout_status", "payout_amount", "commission_amount",
        "refund_status", "paid_at", "payment_reference", "customer_total", "platform_fee",
    ):
        op.drop_column("bookings", col)
    op.alter_column("bookings", "price", type_=sa.Numeric(10, 2), existing_nullable=False)
    # PostgreSQL cannot drop enum values; AWAITING_PAYMENT stays on the type.
