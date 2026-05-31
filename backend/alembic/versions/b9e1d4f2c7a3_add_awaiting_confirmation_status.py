"""add awaiting_confirmation booking status and vendor_confirmed_at column

Revision ID: b9e1d4f2c7a3
Revises: a3f7c2d1e8b4
Create Date: 2026-05-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b9e1d4f2c7a3'
down_revision: Union[str, Sequence[str], None] = 'a3f7c2d1e8b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the new enum value — must be outside a transaction on PG < 12
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'AWAITING_CONFIRMATION' BEFORE 'COMPLETED'")

    op.add_column(
        'bookings',
        sa.Column('vendor_confirmed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('bookings', 'vendor_confirmed_at')
    # PostgreSQL does not support removing enum values — downgrade leaves the type as-is
