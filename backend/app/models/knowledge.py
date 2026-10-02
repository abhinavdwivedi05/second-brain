import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Integer, DateTime, ForeignKey, Table, Column, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.collection import Collection
    from app.models.tag import Tag
    from app.models.processing_job import ProcessingJob

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# Many-to-many junction table for knowledge and tags
knowledge_tags = Table(
    "knowledge_tags",
    Base.metadata,
    Column("knowledge_id", String(36), ForeignKey("knowledge.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

class Knowledge(Base):
    __tablename__ = "knowledge"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False, default="NOTE", index=True) # NOTE, LINK, PDF, IMAGE, AUDIO, DOCUMENT
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    original_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    file_size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    file_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    storage_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    collection_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("collections.id", ondelete="SET NULL"), nullable=True, index=True)
    
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    
    processing_status: Mapped[str] = mapped_column(String(30), default="COMPLETED", nullable=False, index=True) # PENDING, PROCESSING, COMPLETED, FAILED
    processing_progress: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    processing_step: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    key_concepts: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    related_knowledge_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    ai_insights: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    audio_duration: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="knowledge_items")
    collection: Mapped[Optional["Collection"]] = relationship("Collection", back_populates="knowledge_items")
    tags: Mapped[List["Tag"]] = relationship("Tag", secondary=knowledge_tags, back_populates="knowledge_items")
    processing_jobs: Mapped[List["ProcessingJob"]] = relationship("ProcessingJob", back_populates="knowledge", cascade="all, delete-orphan")
