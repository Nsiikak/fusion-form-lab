"""support role, escalations and notes; encrypted bank account numbers; resendable emails;
booking logistics; drop the legacy vendor service fee

Revision ID: a8b4e2c9d1f3
Revises: f7c3d1e9a2b8
Create Date: 2026-10-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8b4e2c9d1f3"
down_revision: Union[str, Sequence[str], None] = "f7c3d1e9a2b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUPPORT'")

    op.create_table(
        "escalations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("raised_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("priority", sa.String(10), nullable=False, server_default="normal"),
        sa.Column("category", sa.String(30), nullable=False, server_default="other"),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="open"),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "support_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column("notification_log", sa.Column("body", sa.Text(), nullable=True))
    op.add_column("notification_log", sa.Column("resent_from", sa.String(24), nullable=True))
    op.add_column("bookings", sa.Column("logistics_fee", sa.Numeric(12, 2), nullable=True))

    # Encrypt bank account numbers already stored (columns widened to hold the ciphertext)
    op.alter_column("users", "refund_account_number", type_=sa.String(255), existing_nullable=True)
    op.alter_column("vendors", "account_number", type_=sa.String(255), existing_nullable=True)
    from app.core.crypto import encrypt, is_encrypted
    bind = op.get_bind()
    for table, column in (("users", "refund_account_number"), ("vendors", "account_number")):
        rows = bind.execute(sa.text(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")).fetchall()
        for rid, value in rows:
            if value and not is_encrypted(value):
                bind.execute(sa.text(f"UPDATE {table} SET {column} = :v WHERE id = :i"), {"v": encrypt(value), "i": rid})

    op.drop_column("vendors", "service_fee_percentage")


def downgrade() -> None:
    op.add_column("vendors", sa.Column("service_fee_percentage", sa.Numeric(5, 2), nullable=True))
    from app.core.crypto import decrypt
    bind = op.get_bind()
    for table, column in (("users", "refund_account_number"), ("vendors", "account_number")):
        for rid, value in bind.execute(sa.text(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")).fetchall():
            bind.execute(sa.text(f"UPDATE {table} SET {column} = :v WHERE id = :i"), {"v": decrypt(value), "i": rid})
    op.drop_column("bookings", "logistics_fee")
    op.drop_column("notification_log", "resent_from")
    op.drop_column("notification_log", "body")
    op.drop_table("support_notes")
    op.drop_table("escalations")
    # The SUPPORT role value can't be removed from the PostgreSQL enum.
