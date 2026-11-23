import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.activity import Activity

async def log_activity(
    db: AsyncSession,
    user_id: str,
    action: str,
    knowledge_id: Optional[str],
    knowledge_title: str,
    item_type: str,
) -> Activity:
    """Log an activity event for the authenticated user."""
    k_id = knowledge_id if knowledge_id else str(uuid.uuid4())
    activity = Activity(
        user_id=user_id,
        action=action.upper(),
        knowledge_id=k_id,
        knowledge_title=knowledge_title[:300] if knowledge_title else "Knowledge Item",
        type=item_type.upper() if item_type else "NOTE",
        timestamp=datetime.now(timezone.utc),
    )
    db.add(activity)
    return activity
