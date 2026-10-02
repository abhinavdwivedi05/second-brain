import uuid
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
from sqlalchemy import String, BigInteger, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base

if TYPE_CHECKING:
    from app.models.knowledge import Knowledge
    from app.models.collection import Collection
    from app.models.tag import Tag
    from app.models.activity import Activity

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str] = mapped_column(String(500), nullable=True, default="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80")
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="Senior Product Engineer")
    storage_used_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    storage_limit_bytes: Mapped[int] = mapped_column(BigInteger, default=10737418240, nullable=False) # 10 GB
    ai_credits_remaining: Mapped[int] = mapped_column(Integer, default=840, nullable=False)
    ai_credits_total: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    knowledge_items: Mapped[List["Knowledge"]] = relationship("Knowledge", back_populates="user", cascade="all, delete-orphan")
    collections: Mapped[List["Collection"]] = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
    tags: Mapped[List["Tag"]] = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    activities: Mapped[List["Activity"]] = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    files: Mapped[List["File"]] = relationship("File", back_populates="user", cascade="all, delete-orphan")
