from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.knowledge import Knowledge
from app.models.collection import Collection
from app.models.tag import Tag
from app.models.activity import Activity
from app.schemas.dashboard import DashboardStatsOut
from app.api.v1.knowledge import _to_knowledge_out

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=DashboardStatsOut)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve real-time user-scoped dashboard metrics, recent items, and activities directly from PostgreSQL."""
    uid = current_user.id

    # 1. Counts query
    k_total_q = select(func.count(Knowledge.id)).where(Knowledge.user_id == uid, Knowledge.is_archived == False)
    notes_q = select(func.count(Knowledge.id)).where(Knowledge.user_id == uid, Knowledge.type == "NOTE", Knowledge.is_archived == False)
    links_q = select(func.count(Knowledge.id)).where(Knowledge.user_id == uid, Knowledge.type == "LINK", Knowledge.is_archived == False)
    docs_q = select(func.count(Knowledge.id)).where(Knowledge.user_id == uid, Knowledge.type.in_(["PDF", "DOCUMENT"]), Knowledge.is_archived == False)
    col_q = select(func.count(Collection.id)).where(Collection.user_id == uid)
    tag_q = select(func.count(Tag.id)).where(Tag.user_id == uid)
    fav_q = select(func.count(Knowledge.id)).where(Knowledge.user_id == uid, Knowledge.is_favorite == True, Knowledge.is_archived == False)

    total_k = (await db.execute(k_total_q)).scalar() or 0
    total_notes = (await db.execute(notes_q)).scalar() or 0
    total_links = (await db.execute(links_q)).scalar() or 0
    total_docs = (await db.execute(docs_q)).scalar() or 0
    total_cols = (await db.execute(col_q)).scalar() or 0
    total_tags = (await db.execute(tag_q)).scalar() or 0
    total_favs = (await db.execute(fav_q)).scalar() or 0

    # 2. Recent knowledge items (newest 6)
    recent_k_q = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.user_id == uid, Knowledge.is_archived == False)
        .order_by(Knowledge.created_at.desc())
        .limit(6)
    )
    recent_k_rows = (await db.execute(recent_k_q)).scalars().all()
    recent_items = [_to_knowledge_out(item) for item in recent_k_rows]

    # 3. Recently accessed items (5 most recently accessed)
    accessed_q = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.user_id == uid, Knowledge.last_accessed_at.isnot(None), Knowledge.is_archived == False)
        .order_by(Knowledge.last_accessed_at.desc())
        .limit(5)
    )
    accessed_rows = (await db.execute(accessed_q)).scalars().all()
    recent_accessed = [_to_knowledge_out(item) for item in accessed_rows]

    # 4. Recent activities (10 most recent)
    act_q = (
        select(Activity)
        .where(Activity.user_id == uid)
        .order_by(Activity.timestamp.desc())
        .limit(10)
    )
    act_rows = (await db.execute(act_q)).scalars().all()

    return DashboardStatsOut(
        total_knowledge=total_k,
        total_notes=total_notes,
        total_links=total_links,
        total_documents=total_docs,
        total_collections=total_cols,
        total_tags=total_tags,
        total_favorites=total_favs,
        recent_items=recent_items,
        recent_accessed=recent_accessed,
        recent_activities=act_rows,
    )

