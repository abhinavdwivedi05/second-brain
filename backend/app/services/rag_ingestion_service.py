import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.knowledge import Knowledge
from app.models.chunk import KnowledgeChunk
from app.models.file import File
from app.services.chunking_service import chunking_service, DocumentChunk
from app.services.embedding_service import embedding_service, EmbeddingError
from app.core.config import settings

class RAGIngestionService:
    """Orchestrates document chunking, embedding generation, vector storage, and backfill."""

    async def resolve_knowledge_text(self, item: Knowledge, db: AsyncSession) -> Tuple[str, Dict[str, Any]]:
        """Resolve full extracted text and source metadata for any knowledge item."""
        metadata: Dict[str, Any] = {
            "title": item.title,
            "type": item.type,
            "knowledge_id": item.id,
        }

        # 1. For document types, check if associated file has extracted_text
        if item.type in ("DOCUMENT", "PDF"):
            file_res = await db.execute(
                select(File).where(File.knowledge_id == item.id).order_by(File.created_at.desc())
            )
            file_record = file_res.scalars().first()
            if file_record and file_record.extracted_text:
                metadata["file_name"] = file_record.original_filename
                metadata["mime_type"] = file_record.mime_type
                return file_record.extracted_text, metadata

        # 2. For Web links
        if item.type == "LINK" and item.original_url:
            metadata["original_url"] = item.original_url

        # 3. Fallback to knowledge content, then summary
        content = (item.content or "").strip()
        if not content and item.summary:
            content = item.summary.strip()

        return content, metadata

    async def ingest_knowledge(
        self,
        knowledge_id: str,
        user_id: str,
        db: AsyncSession,
        force: bool = False,
    ) -> Dict[str, Any]:
        """Process, chunk, and embed a specific knowledge item for RAG retrieval.
        
        Idempotent: skips re-embedding if content hash matches existing chunks unless force=True.
        Resilient: if embedding generation fails, chunks are preserved and status marked FAILED.
        """
        # Fetch knowledge item with user isolation
        res = await db.execute(
            select(Knowledge).where(Knowledge.id == knowledge_id, Knowledge.user_id == user_id)
        )
        item = res.scalar_one_or_none()
        if not item:
            return {"status": "NOT_FOUND", "knowledge_id": knowledge_id, "chunks_created": 0}

        text, metadata = await self.resolve_knowledge_text(item, db)
        if not text:
            item.indexing_status = "SKIPPED"
            item.chunk_count = 0
            item.indexed_at = datetime.now(timezone.utc)
            await db.commit()
            return {"status": "SKIPPED", "knowledge_id": knowledge_id, "reason": "No text content"}

        # 1. Chunk content
        chunks = chunking_service.chunk_text(
            text=text,
            source_type=item.type,
            metadata=metadata,
        )

        if not chunks:
            item.indexing_status = "SKIPPED"
            item.chunk_count = 0
            item.indexed_at = datetime.now(timezone.utc)
            await db.commit()
            return {"status": "SKIPPED", "knowledge_id": knowledge_id, "reason": "Zero chunks generated"}

        # 2. Check existing chunks for idempotency
        existing_res = await db.execute(
            select(KnowledgeChunk).where(
                KnowledgeChunk.knowledge_id == knowledge_id,
                KnowledgeChunk.user_id == user_id,
            ).order_by(KnowledgeChunk.chunk_index.asc())
        )
        existing_chunks = existing_res.scalars().all()

        # Check if hashes, counts, and model match exactly
        current_model = embedding_service.model_name
        if not force and len(existing_chunks) == len(chunks):
            all_match = all(
                ec.content_hash == c.content_hash
                and ec.embedding is not None
                and ec.embedding_model == current_model
                for ec, c in zip(existing_chunks, chunks)
            )
            if all_match:
                item.indexing_status = "INDEXED"
                item.chunk_count = len(chunks)
                await db.commit()
                return {
                    "status": "ALREADY_INDEXED",
                    "knowledge_id": knowledge_id,
                    "chunks_count": len(chunks),
                }

        # 3. Generate embeddings
        chunk_texts = [c.content for c in chunks]
        embeddings: Optional[List[List[float]]] = None
        embedding_error: Optional[str] = None
        model_name = embedding_service.model_name

        try:
            embeddings = await embedding_service.embed_texts(chunk_texts)
        except Exception as exc:
            embedding_error = str(exc)
            embeddings = None

        # 4. Atomically delete old chunks and store new chunks
        await db.execute(
            delete(KnowledgeChunk).where(
                KnowledgeChunk.knowledge_id == knowledge_id,
                KnowledgeChunk.user_id == user_id,
            )
        )

        now = datetime.now(timezone.utc)
        chunk_models: List[KnowledgeChunk] = []

        for idx, c in enumerate(chunks):
            vec = embeddings[idx] if embeddings and idx < len(embeddings) else None
            chunk_models.append(
                KnowledgeChunk(
                    knowledge_id=knowledge_id,
                    user_id=user_id,
                    chunk_index=c.chunk_index,
                    content=c.content,
                    embedding=vec,
                    embedding_model=model_name if vec is not None else None,
                    content_hash=c.content_hash,
                    source_metadata=c.source_metadata,
                    token_count=c.token_count,
                    created_at=now,
                    updated_at=now,
                )
            )

        db.add_all(chunk_models)

        # 5. Update Knowledge item indexing metadata
        if embeddings is not None:
            item.indexing_status = "INDEXED"
            item.chunk_count = len(chunks)
            item.indexed_at = now
        else:
            item.indexing_status = "FAILED"
            item.chunk_count = len(chunks)

        await db.commit()

        return {
            "status": "INDEXED" if embeddings is not None else "FAILED",
            "knowledge_id": knowledge_id,
            "chunks_created": len(chunks),
            "embeddings_generated": len(embeddings) if embeddings else 0,
            "error": embedding_error,
        }

    async def delete_knowledge_chunks(self, knowledge_id: str, user_id: str, db: AsyncSession) -> int:
        """Remove all vector chunks for a knowledge item."""
        res = await db.execute(
            delete(KnowledgeChunk).where(
                KnowledgeChunk.knowledge_id == knowledge_id,
                KnowledgeChunk.user_id == user_id,
            )
        )
        await db.commit()
        return res.rowcount or 0

    async def estimate_backfill(self, user_id: str, db: AsyncSession) -> Dict[str, Any]:
        """Estimate backfill metrics (items, chunks, estimated tokens) without calling embedding API."""
        # Query user items
        res = await db.execute(
            select(Knowledge)
            .where(Knowledge.user_id == user_id, Knowledge.is_archived == False)
        )
        items = res.scalars().all()

        total_items = len(items)
        unindexed_items = [item for item in items if item.indexing_status != "INDEXED"]
        estimated_chunks = 0
        estimated_tokens = 0

        for item in unindexed_items:
            text, _ = await self.resolve_knowledge_text(item, db)
            if text:
                chunks = chunking_service.chunk_text(text, source_type=item.type)
                estimated_chunks += len(chunks)
                estimated_tokens += sum(c.token_count for c in chunks)

        return {
            "total_items": total_items,
            "unindexed_items_count": len(unindexed_items),
            "already_indexed_count": total_items - len(unindexed_items),
            "estimated_chunks": estimated_chunks,
            "estimated_tokens": estimated_tokens,
            "estimated_api_requests": (estimated_chunks + 49) // 50 if estimated_chunks > 0 else 0,
        }

    async def backfill_user_knowledge(
        self,
        user_id: str,
        db: AsyncSession,
        dry_run: bool = False,
        force: bool = False,
        batch_size: int = 20,
    ) -> Dict[str, Any]:
        """Safely re-index or backfill all knowledge items for a user."""
        estimate = await self.estimate_backfill(user_id, db)
        if dry_run:
            return {"dry_run": True, **estimate}

        # Select items to process
        query = select(Knowledge).where(Knowledge.user_id == user_id, Knowledge.is_archived == False)
        if not force:
            query = query.where(Knowledge.indexing_status != "INDEXED")

        res = await db.execute(query)
        items_to_process = res.scalars().all()

        processed_count = 0
        succeeded_count = 0
        failed_count = 0
        total_chunks_created = 0

        for item in items_to_process:
            result = await self.ingest_knowledge(
                knowledge_id=item.id,
                user_id=user_id,
                db=db,
                force=force,
            )
            processed_count += 1
            if result.get("status") in ("INDEXED", "ALREADY_INDEXED"):
                succeeded_count += 1
                total_chunks_created += result.get("chunks_created", 0)
            else:
                failed_count += 1

        return {
            "dry_run": False,
            "processed_items": processed_count,
            "succeeded": succeeded_count,
            "failed": failed_count,
            "total_chunks_created": total_chunks_created,
        }

rag_ingestion_service = RAGIngestionService()

