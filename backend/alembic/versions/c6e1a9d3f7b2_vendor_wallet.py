"""vendor wallet and on-request withdrawals; move unsent legacy payouts into wallets

Revision ID: c6e1a9d3f7b2
Revises: b2d6f9a4c8e1
Create Date: 2026-10-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c6e1a9d3f7b2"
down_revision: Union[str, Sequence[str], None] = "b2d6f9a4c8e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "withdrawals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id"), nullable=False, index=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, index=True),
        sa.Column("reference", sa.String(100), nullable=False, unique=True),
        sa.Column("recipient_code", sa.String(100), nullable=True),
        sa.Column("transfer_code", sa.String(100), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "wallet_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id"), nullable=False, index=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("withdrawal_id", sa.Integer(), sa.ForeignKey("withdrawals.id"), nullable=True),
        sa.Column("note", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    op.create_index("uq_wallet_booking_kind", "wallet_entries", ["booking_id", "kind"], unique=True,
                    postgresql_where=sa.text("booking_id IS NOT NULL"))
    op.create_index("uq_wallet_withdrawal_kind", "wallet_entries", ["withdrawal_id", "kind"], unique=True,
                    postgresql_where=sa.text("withdrawal_id IS NOT NULL"))

    # Settled bookings whose direct transfer never went out (failed, or held for approval) now
    # belong in the vendor's wallet, from where the vendor withdraws them.
    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT id, vendor_id, payout_amount FROM bookings "
        "WHERE paid_out = true AND payout_status IN ('failed', 'awaiting_approval') AND payout_amount > 0"
    )).fetchall()
    for booking_id, vendor_id, amount in rows:
        bind.execute(sa.text(
            "INSERT INTO wallet_entries (vendor_id, amount, kind, booking_id, note) "
            "VALUES (:v, :a, 'earning', :b, :n)"
        ), {"v": vendor_id, "a": amount, "b": booking_id, "n": f"Booking #{booking_id}"})
        bind.execute(sa.text(
            "UPDATE bookings SET payout_status = 'credited', payout_error = NULL, payout_reference = NULL, "
            "payout_paid_at = now(), payout_statement_number = COALESCE(payout_statement_number, "
            "'PLG-PAY-' || extract(year from now())::int || '-' || lpad(nextval('payout_statement_seq')::text, 6, '0')) "
            "WHERE id = :b"
        ), {"b": booking_id})


def downgrade() -> None:
    op.drop_index("uq_wallet_withdrawal_kind", table_name="wallet_entries")
    op.drop_index("uq_wallet_booking_kind", table_name="wallet_entries")
    op.drop_table("wallet_entries")
    op.drop_table("withdrawals")
