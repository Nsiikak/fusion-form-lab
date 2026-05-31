"""initial baseline

Revision ID: fc6d9e61394b
Revises: 
Create Date: 2026-05-31 11:17:16.987142

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc6d9e61394b'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline — DB already at this state, nothing to do."""
    pass


def downgrade() -> None:
    pass
