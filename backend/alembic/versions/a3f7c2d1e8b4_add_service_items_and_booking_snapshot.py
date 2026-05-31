"""add service_items table and booking snapshot column

Revision ID: a3f7c2d1e8b4
Revises: fc6d9e61394b
Create Date: 2026-05-31

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f7c2d1e8b4'
down_revision: Union[str, Sequence[str], None] = 'fc6d9e61394b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'service_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vendor_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_label', sa.String(length=50), nullable=False, server_default='each'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['vendor_id'], ['vendors.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_service_items_id', 'service_items', ['id'], unique=False)
    op.create_index('ix_service_items_vendor_id', 'service_items', ['vendor_id'], unique=False)

    op.add_column(
        'bookings',
        sa.Column('service_items_snapshot', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('bookings', 'service_items_snapshot')
    op.drop_index('ix_service_items_vendor_id', table_name='service_items')
    op.drop_index('ix_service_items_id', table_name='service_items')
    op.drop_table('service_items')
