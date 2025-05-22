"""Add league_id to Event

Revision ID: 0d1bed3193cdX
Revises: c9496434813f
Create Date: 2025-05-22 11:47:34.307814

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d1bed3193cdX'
down_revision: Union[str, None] = 'c9496434813f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('events', sa.Column('league_id', sa.String(), nullable=True))
    # If you want to enforce NOT NULL, you can update existing rows and then alter to nullable=False


def downgrade() -> None:
    op.drop_column('events', 'league_id')
