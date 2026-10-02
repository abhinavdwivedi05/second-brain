from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.exc import IntegrityError

from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.models.knowledge import Knowledge
from app.schemas.collection import CollectionCreate, CollectionUpdate, CollectionOut

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("", response_model=List[CollectionOut])
async def list_collections(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all collections belonging to the authenticated user with item counts."""
    query = (
        select(Collection, func.count(Knowledge.id).label("item_count"))
        .outerjoin(
            Knowledge,
            and_(
                Knowledge.collection_id == Collection.id,
                Knowledge.user_id == current_user.id,
            ),
        )
        .where(Collection.user_id == current_user.id)
        .group_by(Collection.id)
        .order_by(Collection.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        CollectionOut(
            id=col.id,
            name=col.name,
            description=col.description or "",
            icon=col.icon,
            color=col.color,
            item_count=count,
            created_at=col.created_at,
        )
        for col, count in rows
    ]


@router.post("", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
async def create_collection(
    collection_in: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new collection assigned strictly to the authenticated user."""
    clean_name = collection_in.name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Collection name cannot be empty",
        )

    new_collection = Collection(
        user_id=current_user.id,
        name=clean_name,
        description=collection_in.description or "",
        icon=collection_in.icon or "Folder",
        color=collection_in.color or "#3B82F6",
    )
    db.add(new_collection)
    try:
        await db.commit()
        await db.refresh(new_collection)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A database conflict occurred while creating the collection",
        )

    return CollectionOut(
        id=new_collection.id,
        name=new_collection.name,
        description=new_collection.description or "",
        icon=new_collection.icon,
        color=new_collection.color,
        item_count=0,
        created_at=new_collection.created_at,
    )


@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single collection owned by the authenticated user."""
    query = (
        select(Collection, func.count(Knowledge.id).label("item_count"))
        .outerjoin(
            Knowledge,
            and_(
                Knowledge.collection_id == Collection.id,
                Knowledge.user_id == current_user.id,
            ),
        )
        .where(
            Collection.id == collection_id,
            Collection.user_id == current_user.id,
        )
        .group_by(Collection.id)
    )
    result = await db.execute(query)
    row = result.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    col, count = row
    return CollectionOut(
        id=col.id,
        name=col.name,
        description=col.description or "",
        icon=col.icon,
        color=col.color,
        item_count=count,
        created_at=col.created_at,
    )


@router.patch("/{collection_id}", response_model=CollectionOut)
async def update_collection(
    collection_id: str,
    collection_in: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing collection owned by the authenticated user."""
    query = select(Collection).where(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    )
    result = await db.execute(query)
    col = result.scalars().first()

    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    if collection_in.name is not None:
        clean_name = collection_in.name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Collection name cannot be empty",
            )
        col.name = clean_name

    if collection_in.description is not None:
        col.description = collection_in.description
    if collection_in.icon is not None:
        col.icon = collection_in.icon
    if collection_in.color is not None:
        col.color = collection_in.color

    try:
        await db.commit()
        await db.refresh(col)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A database conflict occurred while updating the collection",
        )

    count_res = await db.execute(
        select(func.count(Knowledge.id)).where(
            Knowledge.collection_id == col.id,
            Knowledge.user_id == current_user.id,
        )
    )
    item_count = count_res.scalar() or 0

    return CollectionOut(
        id=col.id,
        name=col.name,
        description=col.description or "",
        icon=col.icon,
        color=col.color,
        item_count=item_count,
        created_at=col.created_at,
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an existing collection owned by the authenticated user."""
    query = select(Collection).where(
        Collection.id == collection_id,
        Collection.user_id == current_user.id,
    )
    result = await db.execute(query)
    col = result.scalars().first()

    if not col:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )

    try:
        await db.delete(col)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete collection because it is referenced by other resources",
        )

    return None
