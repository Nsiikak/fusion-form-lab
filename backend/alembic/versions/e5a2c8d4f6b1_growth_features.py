"""token versions, quality ranking, response times, availability, favourites

Revision ID: e5a2c8d4f6b1
Revises: d9f1b2c7e3a5
Create Date: 2026-10-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5a2c8d4f6b1"
down_revision: Union[str, Sequence[str], None] = "d9f1b2c7e3a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("vendors", sa.Column("quality_score", sa.Float(), nullable=False, server_default="0"))
    op.add_column("vendors", sa.Column("response_hours", sa.Float(), nullable=True))
    op.add_column("vendors", sa.Column("daily_capacity", sa.Integer(), nullable=True))
    op.add_column("bookings", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_vendors_quality", "vendors", ["quality_score"])
    op.create_table(
        "vendor_blocked_dates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.UniqueConstraint("vendor_id", "day", name="uq_vendor_blocked_day"),
    )
    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "vendor_id", name="uq_favorite"),
    )


def downgrade() -> None:
    op.drop_table("favorites")
    op.drop_table("vendor_blocked_dates")
    op.drop_index("ix_vendors_quality", table_name="vendors")
    op.drop_column("bookings", "accepted_at")
    for c in ("daily_capacity", "response_hours", "quality_score"):
        op.drop_column("vendors", c)
    op.drop_column("users", "token_version")
