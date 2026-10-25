"""in-app chat: conversations and messages

Revision ID: f3a8d2c6b9e4
Revises: e9b4c1d7a2f3
Create Date: 2026-10-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a8d2c6b9e4"
down_revision: Union[str, Sequence[str], None] = "e9b4c1d7a2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_preview", sa.String(160), nullable=True),
        sa.Column("customer_last_read_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("vendor_last_read_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("customer_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("vendor_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("customer_id", "vendor_id", name="uq_conversation_pair"),
    )
    op.create_index("ix_conversations_customer", "conversations", ["customer_id", "last_message_at"])
    op.create_index("ix_conversations_vendor", "conversations", ["vendor_id", "last_message_at"])
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("sender_role", sa.String(10), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("attachments", sa.JSON(), nullable=True),
        sa.Column("contains_contact", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id", "id"])


def downgrade() -> None:
    op.drop_index("ix_messages_conversation_id", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_conversations_vendor", table_name="conversations")
    op.drop_index("ix_conversations_customer", table_name="conversations")
    op.drop_table("conversations")
