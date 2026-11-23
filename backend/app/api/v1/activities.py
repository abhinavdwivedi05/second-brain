from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.activity import Activity
from app.schemas.activity import ActivityOut

router = APIRouter(prefix="/activities", tags=["activities"])

@router.get("", response_model=List[ActivityOut])
async def list_activities(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the authenticated user's activity log sorted newest first."""
    query = (
        select(Activity)
        .where(Activity.user_id == current_user.id)
        .order_by(Activity.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    activities = result.scalars().all()
    return activities

