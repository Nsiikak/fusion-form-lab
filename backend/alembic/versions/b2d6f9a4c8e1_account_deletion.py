"""account deletion: grace period and anonymisation markers

Revision ID: b2d6f9a4c8e1
Revises: a8b4e2c9d1f3
Create Date: 2026-10-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2d6f9a4c8e1"
down_revision: Union[str, Sequence[str], None] = "a8b4e2c9d1f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("deletion_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("vendors", sa.Column("hidden_for_deletion", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("vendors", "hidden_for_deletion")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "deletion_requested_at")
