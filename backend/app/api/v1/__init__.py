from fastapi import APIRouter
from app.api.v1.system import router as system_router
from app.api.v1.auth import router as auth_router

api_router = APIRouter()
api_router.include_router(system_router, tags=["system"])
api_router.include_router(auth_router)

