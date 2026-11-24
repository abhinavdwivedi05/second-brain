import os
from typing import List, Union
from pydantic import AnyHttpUrl, validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Second Brain API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/second_brain"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/second_brain"
    
    # SQLite fallback option if Postgres connection fails
    SQLITE_FALLBACK_URL: str = "sqlite+aiosqlite:///./second_brain.db"
    USE_SQLITE_FALLBACK: bool = False

    # Security
    JWT_SECRET: str = "super_secret_second_brain_jwt_token_key_change_in_production_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    # Development auth bypass (disabled by default)
    DEV_AUTH_BYPASS: bool = False

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    # File Storage
    STORAGE_DIR: str = "storage"
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024 # 50 MB

    # AI Generation Provider (independent from EMBEDDING_PROVIDER)
    AI_PROVIDER: str = "ollama" # "ollama", "mock", or "gemini"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "llama3.2:1b"
    AI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_API_URL: str = "https://generativelanguage.googleapis.com/v1beta/models"

    # RAG, Embedding & Vector Settings
    EMBEDDING_PROVIDER: str = "local" # "local", "gemini", "vertex", or "mock"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    LOCAL_EMBEDDING_MODEL: str = "intfloat/multilingual-e5-base"
    LOCAL_EMBEDDING_DEVICE: str = "cpu"
    EMBEDDING_DIMENSION: int = 768
    EMBEDDING_DIMENSIONS: int = 768
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 120

    # Vertex AI Settings (when EMBEDDING_PROVIDER="vertex")
    VERTEX_PROJECT_ID: str = ""
    VERTEX_LOCATION: str = "us-central1"
    VERTEX_ACCESS_TOKEN: str = ""
    VERTEX_EMBEDDING_MODEL: str = "text-embedding-004"

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
