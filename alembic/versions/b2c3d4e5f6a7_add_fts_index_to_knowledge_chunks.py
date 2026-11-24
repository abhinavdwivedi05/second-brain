"""add_fts_index_to_knowledge_chunks

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-24 01:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create GIN index on to_tsvector('english', content) for fast PostgreSQL full-text search
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_fts "
        "ON knowledge_chunks USING gin (to_tsvector('english', content));"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_knowledge_chunks_fts;")

