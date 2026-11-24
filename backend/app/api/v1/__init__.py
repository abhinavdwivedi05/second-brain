from fastapi import APIRouter
from app.api.v1.system import router as system_router
from app.api.v1.auth import router as auth_router
from app.api.v1.collections import router as collections_router
from app.api.v1.tags import router as tags_router
from app.api.v1.knowledge import router as knowledge_router
from app.api.v1.files import router as files_router
from app.api.v1.ai import router as ai_router
from app.api.v1.search import router as search_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.activities import router as activities_router
from app.api.v1.rag import router as rag_router

api_router = APIRouter()
api_router.include_router(system_router, tags=["system"])
api_router.include_router(auth_router)
api_router.include_router(collections_router)
api_router.include_router(tags_router)
api_router.include_router(knowledge_router)
api_router.include_router(files_router)
api_router.include_router(ai_router)
api_router.include_router(search_router)
api_router.include_router(dashboard_router)
api_router.include_router(activities_router)
api_router.include_router(rag_router)
