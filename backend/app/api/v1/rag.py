from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.database.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.knowledge import Knowledge
from app.models.chunk import KnowledgeChunk
from app.schemas.rag import (
    RAGStatusResponse,
    RAGEstimateResponse,
    RAGReindexRequest,
    RAGReindexResponse,
    ChunkOut,
    RetrievalChunkOut,
    RAGRetrieveResponse,
)
from app.services.rag_ingestion_service import rag_ingestion_service
from app.services.embedding_service import embedding_service
from app.services.retrieval_service import retrieval_service
from app.core.config import settings

router = APIRouter(prefix="/rag", tags=["rag"])

@router.get("/status", response_model=RAGStatusResponse)
async def get_rag_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve RAG system status, pgvector extension state, and user chunk statistics."""
    # Check pgvector extension status
    ext_version = None
    try:
        ext_res = await db.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector';"))
        ext_version = ext_res.scalar()
    except Exception:
        ext_version = None

    # Count user's knowledge by indexing status
    total_q = select(func.count(Knowledge.id)).where(Knowledge.user_id == current_user.id, Knowledge.is_archived == False)
    total_items = (await db.execute(total_q)).scalar() or 0

    indexed_q = select(func.count(Knowledge.id)).where(
        Knowledge.user_id == current_user.id,
        Knowledge.is_archived == False,
        Knowledge.indexing_status == "INDEXED",
    )
    indexed_items = (await db.execute(indexed_q)).scalar() or 0

    failed_q = select(func.count(Knowledge.id)).where(
        Knowledge.user_id == current_user.id,
        Knowledge.is_archived == False,
        Knowledge.indexing_status == "FAILED",
    )
    failed_items = (await db.execute(failed_q)).scalar() or 0

    unindexed_items = total_items - indexed_items

    # Count total chunks for user
    chunk_q = select(func.count(KnowledgeChunk.id)).where(KnowledgeChunk.user_id == current_user.id)
    total_chunks = (await db.execute(chunk_q)).scalar() or 0

    return RAGStatusResponse(
        vector_extension_installed=bool(ext_version),
        vector_version=ext_version,
        embedding_provider=getattr(settings, "EMBEDDING_PROVIDER", "mock"),
        embedding_model=embedding_service.model_name,
        embedding_dimension=embedding_service.dimension,
        total_items=total_items,
        indexed_items=indexed_items,
        unindexed_items=unindexed_items,
        failed_items=failed_items,
        total_chunks=total_chunks,
    )

@router.get("/estimate", response_model=RAGEstimateResponse)
async def get_reindex_estimate(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Estimate chunk and embedding request counts prior to backfill."""
    estimate = await rag_ingestion_service.estimate_backfill(user_id=current_user.id, db=db)
    return RAGEstimateResponse(**estimate)

@router.post("/reindex", response_model=RAGReindexResponse)
async def reindex_all_knowledge(
    payload: Optional[RAGReindexRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-index all knowledge items for the authenticated user, with optional dry_run."""
    req = payload or RAGReindexRequest()
    if req.dry_run:
        est = await rag_ingestion_service.estimate_backfill(user_id=current_user.id, db=db)
        return RAGReindexResponse(
            dry_run=True,
            processed_items=0,
            succeeded=0,
            failed=0,
            total_chunks_created=0,
            estimated_tokens=est.get("estimated_tokens", 0),
            estimated_api_requests=est.get("estimated_api_requests", 0),
        )

    result = await rag_ingestion_service.backfill_user_knowledge(
        user_id=current_user.id,
        db=db,
        dry_run=False,
        force=req.force,
        batch_size=req.batch_size,
    )
    return RAGReindexResponse(**result)

@router.post("/reindex/{knowledge_id}")
async def reindex_single_knowledge(
    knowledge_id: str,
    force: bool = Query(True, description="Force re-chunking and re-embedding"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-index a single specific knowledge item."""
    result = await rag_ingestion_service.ingest_knowledge(
        knowledge_id=knowledge_id,
        user_id=current_user.id,
        db=db,
        force=force,
    )
    if result.get("status") == "NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge item not found.")
    return result

@router.get("/chunks/{knowledge_id}", response_model=List[ChunkOut])
async def get_knowledge_chunks(
    knowledge_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all chunks and vector metadata for a specific knowledge item."""
    # Ensure item belongs to user
    k_res = await db.execute(
        select(Knowledge).where(Knowledge.id == knowledge_id, Knowledge.user_id == current_user.id)
    )
    if not k_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge item not found.")

    res = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.knowledge_id == knowledge_id, KnowledgeChunk.user_id == current_user.id)
        .order_by(KnowledgeChunk.chunk_index.asc())
    )
    chunks = res.scalars().all()

    return [
        ChunkOut(
            id=c.id,
            knowledge_id=c.knowledge_id,
            chunk_index=c.chunk_index,
            content=c.content,
            content_hash=c.content_hash,
            token_count=c.token_count,
            embedding_model=c.embedding_model,
            has_embedding=c.embedding is not None,
            source_metadata=c.source_metadata,
            created_at=c.created_at,
        )
        for c in chunks
    ]

@router.get("/retrieve", response_model=RAGRetrieveResponse)
async def debug_retrieve_chunks(
    q: str = Query(..., min_length=1, description="Search query string"),
    knowledge_id: Optional[str] = Query(None, description="Optional knowledge ID to filter by document"),
    mode: str = Query("hybrid", pattern="^(hybrid|dense|sparse)$", description="Retrieval mode (hybrid, dense, sparse)"),
    top_k: int = Query(5, ge=1, le=50, description="Maximum number of chunks to return"),
    min_similarity: float = Query(0.0, ge=0.0, le=1.0, description="Minimum similarity threshold for dense search"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Debug and inspect chunk retrieval across dense, sparse, and hybrid RRF algorithms."""
    # Verify knowledge_id ownership if provided
    if knowledge_id:
        k_res = await db.execute(
            select(Knowledge).where(Knowledge.id == knowledge_id, Knowledge.user_id == current_user.id)
        )
        if not k_res.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified knowledge item not found or access denied.")

    if mode == "dense":
        chunks = await retrieval_service.retrieve_dense(
            db=db,
            query=q,
            user_id=current_user.id,
            knowledge_id=knowledge_id,
            top_k=top_k,
            min_similarity=min_similarity,
        )
    elif mode == "sparse":
        chunks = await retrieval_service.retrieve_sparse(
            db=db,
            query=q,
            user_id=current_user.id,
            knowledge_id=knowledge_id,
            top_k=top_k,
        )
    else:
        chunks = await retrieval_service.retrieve_hybrid(
            db=db,
            query=q,
            user_id=current_user.id,
            knowledge_id=knowledge_id,
            top_k=top_k,
            min_similarity=min_similarity,
        )

    return RAGRetrieveResponse(
        query=q,
        mode=mode,
        knowledge_id=knowledge_id,
        total_results=len(chunks),
        embedding_model=embedding_service.model_name,
        results=[
            RetrievalChunkOut(
                id=c.id,
                knowledge_id=c.knowledge_id,
                chunk_index=c.chunk_index,
                content=c.content,
                token_count=c.token_count,
                document_title=c.document_title,
                document_type=c.document_type,
                embedding_model=c.embedding_model,
                dense_rank=c.dense_rank,
                dense_score=c.dense_score,
                sparse_rank=c.sparse_rank,
                sparse_score=c.sparse_score,
                rrf_score=c.rrf_score,
                method=c.method,
                source_metadata=c.source_metadata,
            )
            for c in chunks
        ],
    )


