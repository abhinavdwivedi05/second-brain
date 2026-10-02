from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.tag import Tag
from app.models.knowledge import knowledge_tags
from app.schemas.tag import TagCreate, TagUpdate, TagOut

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=List[TagOut])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all tags belonging to the authenticated user with item counts."""
    query = (
        select(Tag, func.count(knowledge_tags.c.knowledge_id).label("item_count"))
        .outerjoin(knowledge_tags, knowledge_tags.c.tag_id == Tag.id)
        .where(Tag.user_id == current_user.id)
        .group_by(Tag.id)
        .order_by(Tag.name.asc())
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        TagOut(
            id=tag.id,
            name=tag.name,
            color=tag.color,
            item_count=count,
        )
        for tag, count in rows
    ]


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag_in: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new tag assigned strictly to the authenticated user with uniqueness validation."""
    clean_name = tag_in.name.strip().lstrip("#")
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tag name cannot be empty",
        )

    # Check for duplicate tag under this user
    dup_query = select(Tag).where(
        Tag.user_id == current_user.id,
        func.lower(Tag.name) == clean_name.lower(),
    )
    dup_result = await db.execute(dup_query)
    if dup_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tag with this name already exists",
        )

    new_tag = Tag(
        user_id=current_user.id,
        name=clean_name,
        color=tag_in.color or "#3B82F6",
    )
    db.add(new_tag)
    try:
        await db.commit()
        await db.refresh(new_tag)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tag with this name already exists",
        )

    return TagOut(
        id=new_tag.id,
        name=new_tag.name,
        color=new_tag.color,
        item_count=0,
    )


@router.get("/{tag_id}", response_model=TagOut)
async def get_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single tag owned by the authenticated user."""
    query = (
        select(Tag, func.count(knowledge_tags.c.knowledge_id).label("item_count"))
        .outerjoin(knowledge_tags, knowledge_tags.c.tag_id == Tag.id)
        .where(
            Tag.id == tag_id,
            Tag.user_id == current_user.id,
        )
        .group_by(Tag.id)
    )
    result = await db.execute(query)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    tag, count = row
    return TagOut(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        item_count=count,
    )


@router.patch("/{tag_id}", response_model=TagOut)
async def update_tag(
    tag_id: str,
    tag_in: TagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing tag owned by the authenticated user."""
    query = select(Tag).where(
        Tag.id == tag_id,
        Tag.user_id == current_user.id,
    )
    result = await db.execute(query)
    tag = result.scalars().first()

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    if tag_in.name is not None:
        clean_name = tag_in.name.strip().lstrip("#")
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tag name cannot be empty",
            )

        # Check duplicate
        dup_query = select(Tag).where(
            Tag.user_id == current_user.id,
            Tag.id != tag_id,
            func.lower(Tag.name) == clean_name.lower(),
        )
        dup_result = await db.execute(dup_query)
        if dup_result.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A tag with this name already exists",
            )
        tag.name = clean_name

    if tag_in.color is not None:
        tag.color = tag_in.color

    try:
        await db.commit()
        await db.refresh(tag)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tag with this name already exists",
        )

    count_res = await db.execute(
        select(func.count(knowledge_tags.c.knowledge_id)).where(
            knowledge_tags.c.tag_id == tag.id
        )
    )
    item_count = count_res.scalar() or 0

    return TagOut(
        id=tag.id,
        name=tag.name,
        color=tag.color,
        item_count=item_count,
    )


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an existing tag owned by the authenticated user."""
    query = select(Tag).where(
        Tag.id == tag_id,
        Tag.user_id == current_user.id,
    )
    result = await db.execute(query)
    tag = result.scalars().first()

    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found",
        )

    try:
        await db.delete(tag)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete tag because it is referenced by other resources",
        )

    return None
