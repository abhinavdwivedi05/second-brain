import re
from urllib.parse import urlparse
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, desc, asc
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.models.tag import Tag
from app.models.knowledge import Knowledge, knowledge_tags
from app.schemas.knowledge import (
    KnowledgeCreate,
    KnowledgeUpdate,
    KnowledgeOut,
    KnowledgeListResponse,
    UrlExtractRequest,
    UrlExtractResponse,
    UrlImportRequest,
)
from app.services.web_extractor import (
    web_extractor,
    validate_target_url,
    SSRFSecurityError,
    WebDownloadError,
    WebExtractionError,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

VALID_KNOWLEDGE_TYPES = {"NOTE", "LINK", "PDF", "IMAGE", "AUDIO", "DOCUMENT"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_knowledge_out(item: Knowledge) -> KnowledgeOut:
    tag_names = [t.name for t in item.tags] if item.tags else []
    col_name = item.collection.name if item.collection else None
    return KnowledgeOut(
        id=item.id,
        title=item.title,
        type=item.type,
        summary=item.summary or "",
        content=item.content or "",
        original_url=item.original_url,
        file_name=item.file_name,
        file_size=item.file_size,
        file_type=item.file_type,
        tags=tag_names,
        collection_id=item.collection_id,
        collection_name=col_name,
        is_favorite=item.is_favorite,
        is_archived=item.is_archived,
        created_at=item.created_at,
        updated_at=item.updated_at,
        last_accessed_at=item.last_accessed_at,
        processing_status=item.processing_status or "COMPLETED",
        processing_progress=item.processing_progress if item.processing_progress is not None else 100,
        processing_step=item.processing_step,
        key_concepts=item.key_concepts or [],
        related_knowledge_ids=item.related_knowledge_ids or [],
        ai_insights=item.ai_insights or [],
        audio_duration=item.audio_duration,
    )


async def _resolve_tags_for_user(
    db: AsyncSession, user_id: str, tag_names: List[str]
) -> List[Tag]:
    """Resolve tag names to Tag entities owned strictly by user_id, auto-creating missing tags."""
    if not tag_names:
        return []

    resolved_tags: List[Tag] = []
    seen = set()

    for raw_name in tag_names:
        clean = raw_name.strip().lstrip("#")
        if not clean or clean.lower() in seen:
            continue
        seen.add(clean.lower())

        # Check existing tag owned by this user
        tag_query = select(Tag).where(
            Tag.user_id == user_id,
            func.lower(Tag.name) == clean.lower(),
        )
        tag_res = await db.execute(tag_query)
        existing_tag = tag_res.scalars().first()

        if existing_tag:
            resolved_tags.append(existing_tag)
        else:
            # Auto-create tag assigned to current user
            new_tag = Tag(
                user_id=user_id,
                name=clean,
                color="#3B82F6",
            )
            db.add(new_tag)
            await db.flush()
            resolved_tags.append(new_tag)

    return resolved_tags


@router.get("", response_model=List[KnowledgeOut])
async def list_knowledge(
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    type: Optional[str] = Query(None, description="Filter by type (NOTE, LINK, etc.)"),
    collection_id: Optional[str] = Query(None, description="Filter by collection UUID"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    favorites_only: Optional[bool] = Query(None, description="Filter favorite items"),
    is_archived: Optional[bool] = Query(False, description="Filter archived items"),
    q: Optional[str] = Query(None, description="Text search across title, content, summary"),
    sort_by: Optional[str] = Query("newest", description="newest, oldest, title, recently_accessed"),
):
    """Retrieve all knowledge items owned by the authenticated user with filters and pagination."""
    query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.user_id == current_user.id)
    )

    # Filter: type
    if type and type.upper() != "ALL":
        query = query.where(Knowledge.type == type.upper())

    # Filter: collection
    if collection_id:
        query = query.where(Knowledge.collection_id == collection_id)

    # Filter: favorites
    if favorites_only is not None and favorites_only:
        query = query.where(Knowledge.is_favorite.is_(True))

    # Filter: archived
    if is_archived is not None:
        query = query.where(Knowledge.is_archived.is_(is_archived))

    # Filter: tag
    if tag:
        clean_tag = tag.strip().lstrip("#").lower()
        query = query.join(Knowledge.tags).where(func.lower(Tag.name) == clean_tag)

    # Filter: text search
    if q and q.strip():
        search_term = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Knowledge.title).like(search_term),
                func.lower(Knowledge.summary).like(search_term),
                func.lower(Knowledge.content).like(search_term),
            )
        )

    # Sorting
    if sort_by == "oldest":
        query = query.order_by(asc(Knowledge.created_at))
    elif sort_by == "title":
        query = query.order_by(asc(func.lower(Knowledge.title)))
    elif sort_by == "recently_accessed":
        query = query.order_by(desc(func.coalesce(Knowledge.last_accessed_at, Knowledge.created_at)))
    else:
        # Default: newest
        query = query.order_by(desc(Knowledge.created_at))

    # Total count calculation
    count_query = select(func.count(Knowledge.id)).where(Knowledge.user_id == current_user.id)
    if is_archived is not None:
        count_query = count_query.where(Knowledge.is_archived.is_(is_archived))
    total_res = await db.execute(count_query)
    total_count = total_res.scalar() or 0
    response.headers["X-Total-Count"] = str(total_count)

    # Execute paginated fetch
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().unique().all()

    return [_to_knowledge_out(item) for item in items]


@router.post("", response_model=KnowledgeOut, status_code=status.HTTP_201_CREATED)
async def create_knowledge(
    item_in: KnowledgeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new knowledge item owned strictly by the authenticated user."""
    clean_title = item_in.title.strip()
    if not clean_title:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Knowledge title cannot be empty",
        )

    clean_type = item_in.type.upper() if item_in.type else "NOTE"
    if clean_type not in VALID_KNOWLEDGE_TYPES:
        clean_type = "NOTE"

    # Validate collection ownership if collection_id provided
    collection_id = item_in.collection_id
    if collection_id:
        col_query = select(Collection).where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
        col_res = await db.execute(col_query)
        collection = col_res.scalars().first()
        if not collection:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Collection not found or access denied",
            )

    # Resolve and validate user tags
    tags = await _resolve_tags_for_user(db, current_user.id, item_in.tags)

    now = _utc_now()
    new_item = Knowledge(
        user_id=current_user.id,
        title=clean_title,
        type=clean_type,
        summary=item_in.summary or "",
        content=item_in.content or "",
        original_url=item_in.original_url,
        file_name=item_in.file_name,
        file_size=item_in.file_size,
        file_type=item_in.file_type,
        collection_id=collection_id,
        is_favorite=item_in.is_favorite,
        is_archived=item_in.is_archived,
        processing_status="COMPLETED",
        processing_progress=100,
        processing_step="Ready",
        key_concepts=item_in.key_concepts or [],
        related_knowledge_ids=item_in.related_knowledge_ids or [],
        ai_insights=item_in.ai_insights or [],
        audio_duration=item_in.audio_duration,
        created_at=now,
        updated_at=now,
        last_accessed_at=now,
        tags=tags,
    )

    db.add(new_item)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="CREATED",
        knowledge_id=new_item.id,
        knowledge_title=clean_title,
        item_type=clean_type,
    )
    await db.commit()

    # Re-fetch with loaded relationships
    reload_query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.id == new_item.id)
    )
    reloaded = (await db.execute(reload_query)).scalars().first()
    return _to_knowledge_out(reloaded or new_item)


@router.post("/batch", response_model=List[KnowledgeOut], status_code=status.HTTP_201_CREATED)
async def batch_create_knowledge(
    items_in: List[KnowledgeCreate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch create multiple knowledge items (used for safe migration and bulk import)."""
    created_items: List[KnowledgeOut] = []

    for item_in in items_in:
        clean_title = item_in.title.strip()
        if not clean_title:
            continue

        # Check if item with exact same title already exists to guarantee idempotency
        existing_query = select(Knowledge).where(
            Knowledge.user_id == current_user.id,
            func.lower(Knowledge.title) == clean_title.lower(),
        )
        existing_res = await db.execute(existing_query)
        if existing_res.scalars().first():
            continue

        # Collection validation
        collection_id = item_in.collection_id
        if collection_id:
            col_res = await db.execute(
                select(Collection).where(
                    Collection.id == collection_id, Collection.user_id == current_user.id
                )
            )
            if not col_res.scalars().first():
                collection_id = None

        tags = await _resolve_tags_for_user(db, current_user.id, item_in.tags)

        now = _utc_now()
        new_k = Knowledge(
            user_id=current_user.id,
            title=clean_title,
            type=item_in.type.upper() if item_in.type in VALID_KNOWLEDGE_TYPES else "NOTE",
            summary=item_in.summary or "",
            content=item_in.content or "",
            original_url=item_in.original_url,
            file_name=item_in.file_name,
            file_size=item_in.file_size,
            file_type=item_in.file_type,
            collection_id=collection_id,
            is_favorite=item_in.is_favorite,
            is_archived=item_in.is_archived,
            processing_status="COMPLETED",
            processing_progress=100,
            key_concepts=item_in.key_concepts or [],
            related_knowledge_ids=item_in.related_knowledge_ids or [],
            ai_insights=item_in.ai_insights or [],
            audio_duration=item_in.audio_duration,
            created_at=now,
            updated_at=now,
            last_accessed_at=now,
            tags=tags,
        )
        db.add(new_k)

    await db.commit()

    # Retrieve all created items
    query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.user_id == current_user.id)
        .order_by(desc(Knowledge.created_at))
    )
    all_res = await db.execute(query)
    return [_to_knowledge_out(k) for k in all_res.scalars().unique().all()]


@router.post("/extract-url", response_model=UrlExtractResponse)
async def extract_url_content(
    payload: UrlExtractRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch and extract readable content, summary, and suggested tags from a public webpage.
    
    Validates URL against SSRF and private network attacks. Does not persist to DB.
    """
    url = (payload.url or "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL cannot be empty.",
        )

    # Fetch user's existing tags for reconciliation
    tags_res = await db.execute(select(Tag.name).where(Tag.user_id == current_user.id))
    existing_tags = tags_res.scalars().all()

    try:
        enriched = await web_extractor.analyze_and_enrich(url, existing_tags)
        return UrlExtractResponse(**enriched)
    except SSRFSecurityError as ssrf_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security rejection: {str(ssrf_err)}",
        )
    except WebDownloadError as dl_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to fetch webpage: {str(dl_err)}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Webpage extraction failed: {str(exc)}",
        )


@router.post("/import-url", response_model=KnowledgeOut, status_code=status.HTTP_201_CREATED)
async def import_url_knowledge(
    payload: UrlImportRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract and permanently store a public webpage as a searchable knowledge item in PostgreSQL."""
    url = (payload.url or "").strip()
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL cannot be empty.",
        )

    # Validate collection assignment if provided
    collection_id = None
    if payload.collection_id:
        col_query = select(Collection).where(
            Collection.id == payload.collection_id,
            Collection.user_id == current_user.id,
        )
        col_res = await db.execute(col_query)
        col = col_res.scalars().first()
        if not col:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assigned collection not found or access denied.",
            )
        collection_id = col.id

    # Check if user provided edited fields or if we need to fetch & analyze
    has_custom_content = bool(payload.content and payload.content.strip())
    has_custom_title = bool(payload.title and payload.title.strip())

    tags_res = await db.execute(select(Tag.name).where(Tag.user_id == current_user.id))
    existing_tags = tags_res.scalars().all()

    try:
        clean_url = validate_target_url(url)
    except SSRFSecurityError as ssrf_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security rejection: {str(ssrf_err)}",
        )

    canonical_url = clean_url
    domain = urlparse(clean_url).netloc

    if has_custom_content and has_custom_title:
        final_title = payload.title.strip()
        final_content = payload.content.strip()
        final_summary = (payload.summary or "").strip() or f"Web link bookmark for {final_title} ({clean_url})."
        raw_tags = payload.tags or []
        words = re.findall(r"\b[A-Za-z]{4,}\b", f"{final_title} {final_content[:300]}")
        final_concepts = [w.capitalize() for w in words]
        final_concepts = list(dict.fromkeys(final_concepts))[:6]
    else:
        try:
            enriched = await web_extractor.analyze_and_enrich(clean_url, existing_tags)
            final_title = (payload.title or "").strip() or enriched["title"]
            final_content = (payload.content or "").strip() or enriched["content"]
            final_summary = (payload.summary or "").strip() or enriched["summary"]
            raw_tags = payload.tags if payload.tags is not None else enriched["tags"]
            final_concepts = enriched["key_concepts"]
            canonical_url = enriched.get("canonical_url") or clean_url
            domain = enriched.get("domain") or domain
        except SSRFSecurityError as ssrf_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Security rejection: {str(ssrf_err)}",
            )
        except WebDownloadError as dl_err:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to fetch webpage: {str(dl_err)}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Webpage extraction failed: {str(exc)}",
            )

    # Duplicate check: check if user already imported this URL
    dup_query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(
            Knowledge.user_id == current_user.id,
            Knowledge.type == "LINK",
            or_(
                Knowledge.original_url == clean_url,
                Knowledge.original_url == canonical_url,
                Knowledge.original_url == url,
            ),
        )
    )
    dup_res = await db.execute(dup_query)
    existing_item = dup_res.scalars().first()

    now = _utc_now()
    resolved_tags = await _resolve_tags_for_user(db, current_user.id, raw_tags)

    if existing_item:
        # Update existing record and return HTTP 200
        existing_item.title = final_title
        existing_item.summary = final_summary
        existing_item.content = final_content
        existing_item.collection_id = collection_id or existing_item.collection_id
        existing_item.tags = resolved_tags
        existing_item.key_concepts = final_concepts
        existing_item.updated_at = now
        await db.commit()
        response.status_code = status.HTTP_200_OK
        reload_q = (
            select(Knowledge)
            .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
            .where(Knowledge.id == existing_item.id)
        )
        reloaded = (await db.execute(reload_q)).scalars().first()
        return _to_knowledge_out(reloaded or existing_item)

    # Create new Knowledge item
    new_knowledge = Knowledge(
        user_id=current_user.id,
        title=final_title,
        type="LINK",
        summary=final_summary,
        content=final_content,
        original_url=clean_url,
        file_name=domain,
        file_type="text/html",
        collection_id=collection_id,
        is_favorite=False,
        is_archived=False,
        processing_status="COMPLETED",
        processing_progress=100,
        processing_step="Webpage content extracted and indexed",
        key_concepts=final_concepts,
        related_knowledge_ids=[],
        ai_insights=[f"Extracted from {domain}"],
        created_at=now,
        updated_at=now,
        last_accessed_at=now,
        tags=resolved_tags,
    )
    db.add(new_knowledge)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="CREATED",
        knowledge_id=new_knowledge.id,
        knowledge_title=final_title,
        item_type="LINK",
    )
    await db.commit()

    reload_q = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.id == new_knowledge.id)
    )
    reloaded = (await db.execute(reload_q)).scalars().first()
    return _to_knowledge_out(reloaded or new_knowledge)


@router.get("/{knowledge_id}", response_model=KnowledgeOut)
async def get_knowledge(
    knowledge_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single knowledge item owned by the authenticated user."""
    query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.id == knowledge_id, Knowledge.user_id == current_user.id)
    )
    result = await db.execute(query)
    item = result.scalars().first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge item not found",
        )

    # Update last_accessed_at timestamp
    item.last_accessed_at = _utc_now()
    await db.commit()

    return _to_knowledge_out(item)


@router.patch("/{knowledge_id}", response_model=KnowledgeOut)
async def update_knowledge(
    knowledge_id: str,
    item_in: KnowledgeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing knowledge item owned by the authenticated user."""
    query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.id == knowledge_id, Knowledge.user_id == current_user.id)
    )
    result = await db.execute(query)
    item = result.scalars().first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge item not found",
        )

    # Update title
    if item_in.title is not None:
        clean_title = item_in.title.strip()
        if not clean_title:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Title cannot be empty",
            )
        item.title = clean_title

    # Update content & summary
    if item_in.content is not None:
        item.content = item_in.content
    if item_in.summary is not None:
        item.summary = item_in.summary
    if item_in.type is not None and item_in.type.upper() in VALID_KNOWLEDGE_TYPES:
        item.type = item_in.type.upper()

    # Update collection assignment
    if item_in.collection_id is not None:
        if item_in.collection_id == "":
            item.collection_id = None
        else:
            col_query = select(Collection).where(
                Collection.id == item_in.collection_id,
                Collection.user_id == current_user.id,
            )
            col_res = await db.execute(col_query)
            col = col_res.scalars().first()
            if not col:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Collection not found or access denied",
                )
            item.collection_id = item_in.collection_id

    # Update tags
    if item_in.tags is not None:
        resolved_tags = await _resolve_tags_for_user(db, current_user.id, item_in.tags)
        item.tags = resolved_tags

    # Update boolean flags
    if item_in.is_favorite is not None:
        item.is_favorite = item_in.is_favorite
    if item_in.is_archived is not None:
        item.is_archived = item_in.is_archived

    # Update optional metadata
    if item_in.original_url is not None:
        item.original_url = item_in.original_url
    if item_in.key_concepts is not None:
        item.key_concepts = item_in.key_concepts
    if item_in.related_knowledge_ids is not None:
        item.related_knowledge_ids = item_in.related_knowledge_ids
    if item_in.ai_insights is not None:
        item.ai_insights = item_in.ai_insights

    item.updated_at = _utc_now()
    await log_activity(
        db,
        user_id=current_user.id,
        action="UPDATED",
        knowledge_id=item.id,
        knowledge_title=item.title,
        item_type=item.type,
    )
    await db.commit()

    # Refresh
    reload_query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.id == item.id)
    )
    reloaded = (await db.execute(reload_query)).scalars().first()
    return _to_knowledge_out(reloaded or item)


@router.delete("/{knowledge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge(
    knowledge_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a knowledge item owned by the authenticated user."""
    query = select(Knowledge).where(
        Knowledge.id == knowledge_id, Knowledge.user_id == current_user.id
    )
    result = await db.execute(query)
    item = result.scalars().first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge item not found",
        )

    await log_activity(
        db,
        user_id=current_user.id,
        action="DELETED",
        knowledge_id=item.id,
        knowledge_title=item.title,
        item_type=item.type,
    )
    await db.delete(item)
    await db.commit()
    return None


@router.post("/{knowledge_id}/favorite", response_model=KnowledgeOut)
async def toggle_favorite(
    knowledge_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle the favorite status of a knowledge item."""
    query = (
        select(Knowledge)
        .options(selectinload(Knowledge.tags), selectinload(Knowledge.collection))
        .where(Knowledge.id == knowledge_id, Knowledge.user_id == current_user.id)
    )
    result = await db.execute(query)
    item = result.scalars().first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge item not found",
        )

    item.is_favorite = not item.is_favorite
    item.updated_at = _utc_now()
    await log_activity(
        db,
        user_id=current_user.id,
        action="FAVORITED" if item.is_favorite else "UNFAVORITED",
        knowledge_id=item.id,
        knowledge_title=item.title,
        item_type=item.type,
    )
    await db.commit()

    return _to_knowledge_out(item)

