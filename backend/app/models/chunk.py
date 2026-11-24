import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, UniqueConstraint, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.database.session import Base
from app.core.config import settings

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.knowledge import Knowledge

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    knowledge_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("knowledge.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(getattr(settings, "EMBEDDING_DIMENSION", 768)), nullable=True)
    embedding_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_metadata: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("knowledge_id", "chunk_index", name="uq_knowledge_chunks_knowledge_index"),
        Index("ix_knowledge_chunks_user_knowledge", "user_id", "knowledge_id"),
    )

    # Relationships
    knowledge: Mapped["Knowledge"] = relationship("Knowledge", back_populates="chunks")
    user: Mapped["User"] = relationship("User", back_populates="chunks")

