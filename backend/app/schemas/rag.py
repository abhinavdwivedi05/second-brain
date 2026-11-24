from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(word.capitalize() for word in parts[1:])

class RAGStatusResponse(BaseModel):
    vector_extension_installed: bool
    vector_version: Optional[str] = None
    embedding_provider: str
    embedding_model: str
    embedding_dimension: int
    total_items: int
    indexed_items: int
    unindexed_items: int
    failed_items: int
    total_chunks: int

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

class RAGEstimateResponse(BaseModel):
    total_items: int
    unindexed_items_count: int
    already_indexed_count: int
    estimated_chunks: int
    estimated_tokens: int
    estimated_api_requests: int

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

class RAGReindexRequest(BaseModel):
    dry_run: bool = False
    force: bool = False
    batch_size: int = Field(20, ge=1, le=100)

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

class RAGReindexResponse(BaseModel):
    dry_run: bool
    processed_items: int
    succeeded: int
    failed: int
    total_chunks_created: int
    estimated_tokens: Optional[int] = None
    estimated_api_requests: Optional[int] = None

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

class ChunkOut(BaseModel):
    id: str
    knowledge_id: str
    chunk_index: int
    content: str
    content_hash: str
    token_count: int
    embedding_model: Optional[str] = None
    has_embedding: bool
    source_metadata: Dict[str, Any]
    created_at: datetime | str

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=_to_camel,
        populate_by_name=True,
    )

class RetrievalChunkOut(BaseModel):
    id: str
    knowledge_id: str
    chunk_index: int
    content: str
    token_count: int
    document_title: str
    document_type: str
    embedding_model: Optional[str] = None
    dense_rank: Optional[int] = None
    dense_score: Optional[float] = None
    sparse_rank: Optional[int] = None
    sparse_score: Optional[float] = None
    rrf_score: Optional[float] = None
    method: str
    source_metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )

class RAGRetrieveResponse(BaseModel):
    query: str
    mode: str
    knowledge_id: Optional[str] = None
    total_results: int
    embedding_model: str
    results: List[RetrievalChunkOut]

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )


