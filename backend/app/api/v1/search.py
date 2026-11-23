import math
import re
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, case, and_
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.knowledge import Knowledge
from app.models.tag import Tag
from app.models.collection import Collection
from app.schemas.search import SearchResponse, SearchResultItem

router = APIRouter(prefix="/search", tags=["search"])

def _generate_snippet(query: Optional[str], title: str, summary: str, content: str) -> str:
    """Extract a concise readable contextual snippet matching search terms."""
    full_text = f"{summary}\n\n{content}".strip()
    if not query or not query.strip():
        # Fallback snippet
        clean = full_text.replace("\n", " ").strip()
        return clean[:160] + ("..." if len(clean) > 160 else "")

    q_lower = query.lower().strip()
    idx = full_text.lower().find(q_lower)
    if idx == -1:
        # Match was in title or tags
        clean = full_text.replace("\n", " ").strip()
        return clean[:160] + ("..." if len(clean) > 160 else "")

    start = max(0, idx - 60)
    end = min(len(full_text), idx + len(query) + 80)
    snippet = full_text[start:end].replace("\n", " ").strip()
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(full_text) else ""
    return f"{prefix}{snippet}{suffix}"

@router.get("", response_model=SearchResponse)
async def search_knowledge(
    response: Response,
    q: Optional[str] = Query(None, description="Search term for title, content, summary, or tags"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    collection_id: Optional[str] = Query(None, description="Filter by collection UUID"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    tag_id: Optional[str] = Query(None, description="Filter by tag UUID"),
    type: Optional[str] = Query(None, description="Filter by KnowledgeType (NOTE, LINK, PDF, DOCUMENT, AUDIO)"),
    is_favorite: Optional[bool] = Query(None, description="Filter by favorite flag"),
    date_from: Optional[datetime] = Query(None, description="Filter by created_at >= date_from"),
    date_to: Optional[datetime] = Query(None, description="Filter by created_at <= date_to"),
    sort_by: Optional[str] = Query("relevance", description="Sort: relevance, newest, oldest, title_asc, title_desc"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Intelligent database search across personal knowledge base with relevance weighting and filters."""
    # Base query: enforce strict user-level data isolation
    base_filter = [Knowledge.user_id == current_user.id]

    clean_q = (q or "").strip()
    relevance_col = None

    if clean_q:
        term = f"%{clean_q}%"
        # Match across title, summary, content, and associated tags
        base_filter.append(
            or_(
                Knowledge.title.ilike(term),
                Knowledge.summary.ilike(term),
                Knowledge.content.ilike(term),
                Knowledge.tags.any(Tag.name.ilike(term)),
            )
        )
        # Prioritize title matches over summary and content
        relevance_col = (
            case((Knowledge.title.ilike(term), 10.0), else_=0.0) +
            case((Knowledge.summary.ilike(term), 5.0), else_=0.0) +
            case((Knowledge.content.ilike(term), 2.0), else_=0.0)
        )

    # Collection filter
    if collection_id:
        base_filter.append(Knowledge.collection_id == collection_id)

    # Tag filter
    if tag:
        clean_tag = tag.strip().lstrip("#").lower()
        base_filter.append(Knowledge.tags.any(Tag.name.ilike(clean_tag)))
    elif tag_id:
        base_filter.append(Knowledge.tags.any(Tag.id == tag_id))

    # Knowledge Type filter
    if type and type.upper() != "ALL":
        base_filter.append(Knowledge.type == type.upper())

    # Favorite filter
    if is_favorite is not None:
        base_filter.append(Knowledge.is_favorite == is_favorite)

    # Date range filters
    if date_from:
        base_filter.append(Knowledge.created_at >= date_from)
    if date_to:
        base_filter.append(Knowledge.created_at <= date_to)

    # Build count query
    count_stmt = select(func.count(Knowledge.id)).where(and_(*base_filter))
    count_res = await db.execute(count_stmt)
    total_count = count_res.scalar() or 0

    # Build selection query with eager loading of tags and collection
    query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(and_(*base_filter))
    )

    # Sorting
    sort = (sort_by or "relevance").lower().strip()
    if sort == "relevance" and relevance_col is not None:
        query = query.order_by(relevance_col.desc(), Knowledge.created_at.desc())
    elif sort in ("newest", "recently_accessed"):
        query = query.order_by(Knowledge.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Knowledge.created_at.asc())
    elif sort in ("title_asc", "title"):
        query = query.order_by(Knowledge.title.asc())
    elif sort == "title_desc":
        query = query.order_by(Knowledge.title.desc())
    else:
        query = query.order_by(Knowledge.created_at.desc())

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    response.headers["X-Total-Count"] = str(total_count)

    # Transform into SearchResultItem
    result_items: List[SearchResultItem] = []
    for item in items:
        snippet = _generate_snippet(clean_q, item.title, item.summary, item.content)
        
        # Calculate individual item score for frontend display if search query active
        score = None
        if clean_q:
            t_score = 10.0 if clean_q.lower() in item.title.lower() else 0.0
            s_score = 5.0 if clean_q.lower() in (item.summary or "").lower() else 0.0
            c_score = 2.0 if clean_q.lower() in (item.content or "").lower() else 0.0
            score = t_score + s_score + c_score

        result_items.append(
            SearchResultItem(
                id=item.id,
                title=item.title,
                snippet=snippet,
                type=item.type,
                summary=item.summary,
                tags=[t.name for t in item.tags],
                collection_id=item.collection_id,
                collection_name=item.collection.name if item.collection else None,
                is_favorite=item.is_favorite,
                is_archived=item.is_archived,
                created_at=item.created_at,
                updated_at=item.updated_at,
                relevance_score=score,
                score=score,
            )
        )

    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0

    return SearchResponse(
        items=result_items,
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
