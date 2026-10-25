"""customer refund accounts, refund tracking, receipt and payout statement numbers

Revision ID: e9b4c1d7a2f3
Revises: d7a3b9c2e5f1
Create Date: 2026-10-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e9b4c1d7a2f3"
down_revision: Union[str, Sequence[str], None] = "d7a3b9c2e5f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("refund_bank_code", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("refund_bank_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("refund_account_number", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("refund_account_name", sa.String(200), nullable=True))
    op.add_column("users", sa.Column("refund_account_updated_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("bookings", sa.Column("refund_id", sa.String(50), nullable=True))
    op.add_column("bookings", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("receipt_number", sa.String(30), nullable=True))
    op.add_column("bookings", sa.Column("payout_statement_number", sa.String(30), nullable=True))
    op.add_column("bookings", sa.Column("payout_paid_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_bookings_receipt_number", "bookings", ["receipt_number"])
    op.create_unique_constraint("uq_bookings_payout_statement_number", "bookings", ["payout_statement_number"])

    op.execute("CREATE SEQUENCE IF NOT EXISTS receipt_number_seq")
    op.execute("CREATE SEQUENCE IF NOT EXISTS payout_statement_seq")

    # Number the documents for bookings that were already paid / paid out, oldest first
    op.execute("""
        UPDATE bookings b SET receipt_number =
            'PLG-RCT-' || to_char(b.paid_at, 'YYYY') || '-' || lpad(nextval('receipt_number_seq')::text, 6, '0')
        FROM (SELECT id FROM bookings WHERE paid_at IS NOT NULL ORDER BY paid_at, id) o
        WHERE b.id = o.id
    """)
    op.execute("""
        UPDATE bookings SET payout_paid_at = COALESCE(updated_at, created_at) WHERE payout_status = 'paid'
    """)
    op.execute("""
        UPDATE bookings b SET payout_statement_number =
            'PLG-PAY-' || to_char(b.payout_paid_at, 'YYYY') || '-' || lpad(nextval('payout_statement_seq')::text, 6, '0')
        FROM (SELECT id FROM bookings WHERE payout_status = 'paid' ORDER BY payout_paid_at, id) o
        WHERE b.id = o.id
    """)


def downgrade() -> None:
    op.drop_constraint("uq_bookings_payout_statement_number", "bookings", type_="unique")
    op.drop_constraint("uq_bookings_receipt_number", "bookings", type_="unique")
    for col in ("payout_paid_at", "payout_statement_number", "receipt_number", "refunded_at", "refund_id"):
        op.drop_column("bookings", col)
    for col in ("refund_account_updated_at", "refund_account_name", "refund_account_number",
                "refund_bank_name", "refund_bank_code"):
        op.drop_column("users", col)
    op.execute("DROP SEQUENCE IF EXISTS payout_statement_seq")
    op.execute("DROP SEQUENCE IF EXISTS receipt_number_seq")
