"""add_pgvector_and_knowledge_chunks

Revision ID: a1b2c3d4e5f6
Revises: fe023cb18129
Create Date: 2026-11-24 01:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'fe023cb18129'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Add indexing fields to knowledge
    op.add_column('knowledge', sa.Column('indexing_status', sa.String(length=30), nullable=False, server_default='UNINDEXED'))
    op.add_column('knowledge', sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('knowledge', sa.Column('indexed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_knowledge_indexing_status'), 'knowledge', ['indexing_status'], unique=False)

    # 3. Create knowledge_chunks table
    op.create_table(
        'knowledge_chunks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('knowledge_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(768), nullable=True),
        sa.Column('embedding_model', sa.String(length=100), nullable=True),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('source_metadata', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('token_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['knowledge_id'], ['knowledge.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('knowledge_id', 'chunk_index', name='uq_knowledge_chunks_knowledge_index')
    )
    op.create_index(op.f('ix_knowledge_chunks_knowledge_id'), 'knowledge_chunks', ['knowledge_id'], unique=False)
    op.create_index(op.f('ix_knowledge_chunks_user_id'), 'knowledge_chunks', ['user_id'], unique=False)
    op.create_index(op.f('ix_knowledge_chunks_content_hash'), 'knowledge_chunks', ['content_hash'], unique=False)
    op.create_index('ix_knowledge_chunks_user_knowledge', 'knowledge_chunks', ['user_id', 'knowledge_id'], unique=False)


def downgrade() -> None:
    # 1. Drop indexes and knowledge_chunks table
    op.drop_index('ix_knowledge_chunks_user_knowledge', table_name='knowledge_chunks')
    op.drop_index(op.f('ix_knowledge_chunks_content_hash'), table_name='knowledge_chunks')
    op.drop_index(op.f('ix_knowledge_chunks_user_id'), table_name='knowledge_chunks')
    op.drop_index(op.f('ix_knowledge_chunks_knowledge_id'), table_name='knowledge_chunks')
    op.drop_table('knowledge_chunks')

    # 2. Drop indexing fields from knowledge
    op.drop_index(op.f('ix_knowledge_indexing_status'), table_name='knowledge')
    op.drop_column('knowledge', 'indexed_at')
    op.drop_column('knowledge', 'chunk_count')
    op.drop_column('knowledge', 'indexing_status')

    # 3. Drop pgvector extension
    op.execute("DROP EXTENSION IF EXISTS vector;")

