"""disputes on bookings, admin verification fields on vendors

Revision ID: d7a3b9c2e5f1
Revises: c4d8e2a1f6b7
Create Date: 2026-10-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d7a3b9c2e5f1"
down_revision: Union[str, Sequence[str], None] = "c4d8e2a1f6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'DISPUTED' AFTER 'AWAITING_CONFIRMATION'")

    op.add_column("bookings", sa.Column("dispute_reason", sa.Text(), nullable=True))
    op.add_column("bookings", sa.Column("disputed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("resolution", sa.String(20), nullable=True))
    op.add_column("bookings", sa.Column("resolution_note", sa.Text(), nullable=True))
    op.add_column("bookings", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))

    op.add_column("vendors", sa.Column("verification_note", sa.Text(), nullable=True))
    op.add_column("vendors", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("vendors", sa.Column("verified_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.execute("UPDATE vendors SET verified_at = COALESCE(updated_at, created_at) WHERE verification_status = 'APPROVED'")


def downgrade() -> None:
    for col in ("verified_by", "verified_at", "verification_note"):
        op.drop_column("vendors", col)
    for col in ("resolved_by", "resolved_at", "resolution_note", "resolution", "disputed_at", "dispute_reason"):
        op.drop_column("bookings", col)
    # PostgreSQL cannot drop enum values; DISPUTED stays on the type.