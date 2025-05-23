"""add league_id to events

Revision ID: 7c5a9377fdd4
Revises: 0d1bed3193cdX
Create Date: 2025-05-22 20:59:52.585056

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c5a9377fdd4'
down_revision: Union[str, None] = '0d1bed3193cdX'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("league_id", sa.String(), nullable=True)
    )
    op.create_foreign_key(None, "events", "leagues", ["league_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint(None, "events", type_="foreignkey")
    op.drop_column("events", "league_id")
