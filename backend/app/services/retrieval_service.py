import math
import re
import logging
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Set
from sqlalchemy import select, func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import KnowledgeChunk
from app.models.knowledge import Knowledge
from app.services.embedding_service import embedding_service, BaseEmbeddingProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further",
    "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
    "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now",
    "of", "off", "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
    "own", "same", "she", "should", "shouldn't", "so", "some", "such", "than", "that", "the",
    "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "were",
    "weren't", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with",
    "won't", "would", "wouldn't", "you", "your", "yours", "yourself", "yourselves"
}

@dataclass
class RetrievalChunk:
    """Represents a chunk retrieved via dense, sparse, or hybrid search."""
    id: str
    knowledge_id: str
    user_id: str
    chunk_index: int
    content: str
    token_count: int
    source_metadata: Dict[str, Any]
    document_title: str
    document_type: str
    embedding_model: Optional[str] = None
    dense_rank: Optional[int] = None
    dense_score: Optional[float] = None
    sparse_rank: Optional[int] = None
    sparse_score: Optional[float] = None
    rrf_score: Optional[float] = None
    method: str = "dense"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "knowledgeId": self.knowledge_id,
            "userId": self.user_id,
            "chunkIndex": self.chunk_index,
            "content": self.content,
            "tokenCount": self.token_count,
            "sourceMetadata": self.source_metadata,
            "documentTitle": self.document_title,
            "documentType": self.document_type,
            "embeddingModel": self.embedding_model,
            "denseRank": self.dense_rank,
            "denseScore": self.dense_score,
            "sparseRank": self.sparse_rank,
            "sparseScore": self.sparse_score,
            "rrfScore": self.rrf_score,
            "method": self.method,
        }

def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two vector lists in Python."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)

class RetrievalService:
    """Hybrid Retrieval Service combining dense vector similarity with sparse keyword FTS."""

    async def retrieve_dense(
        self,
        db: AsyncSession,
        query: str,
        user_id: str,
        knowledge_id: Optional[str] = None,
        top_k: int = 10,
        min_similarity: float = 0.0,
        provider: Optional[BaseEmbeddingProvider] = None,
    ) -> List[RetrievalChunk]:
        """Perform dense vector retrieval using pgvector cosine distance.
        
        Guarantees:
        1. Query embedding generated using task_type RETRIEVAL_QUERY.
        2. Filters strictly by user_id and optional knowledge_id.
        3. Excludes chunks with NULL embeddings.
        4. Excludes chunks embedded with a different model to avoid mixing spaces.
        5. Falls back to Python cosine similarity for SQLite during test execution.
        """
        clean_q = (query or "").strip()
        if not clean_q or not user_id:
            return []

        emb_provider = provider or embedding_service
        try:
            query_vector = await emb_provider.embed_query(clean_q)
        except Exception as exc:
            logger.warning(f"Dense vector embedding failed for query '{clean_q[:30]}': {exc}")
            return []

        if not query_vector or len(query_vector) != emb_provider.dimension:
            logger.warning(f"Dense vector dimension mismatch: expected {emb_provider.dimension}, got {len(query_vector) if query_vector else 0}")
            return []

        bind = db.get_bind()
        is_sqlite = bind is not None and bind.dialect.name == "sqlite"

        if is_sqlite:
            # SQLite compatibility path for automated unit test execution
            stmt = (
                select(KnowledgeChunk, Knowledge.title, Knowledge.type)
                .join(Knowledge, Knowledge.id == KnowledgeChunk.knowledge_id)
                .where(
                    KnowledgeChunk.user_id == user_id,
                    KnowledgeChunk.embedding.is_not(None),
                    KnowledgeChunk.embedding_model == emb_provider.model_name,
                )
            )
            if knowledge_id:
                stmt = stmt.where(KnowledgeChunk.knowledge_id == knowledge_id)

            res = await db.execute(stmt)
            rows = res.all()

            scored: List[tuple[float, KnowledgeChunk, str, str]] = []
            for chunk, doc_title, doc_type in rows:
                raw_emb = chunk.embedding
                if isinstance(raw_emb, (list, tuple)):
                    chunk_vec = list(raw_emb)
                elif hasattr(raw_emb, "tolist"):
                    chunk_vec = raw_emb.tolist()
                elif isinstance(raw_emb, str):
                    try:
                        import json
                        chunk_vec = json.loads(raw_emb)
                    except Exception:
                        continue
                else:
                    continue

                sim = _cosine_similarity(query_vector, chunk_vec)
                if sim >= min_similarity:
                    scored.append((sim, chunk, doc_title or "Untitled", doc_type or "note"))

            scored.sort(key=lambda x: x[0], reverse=True)
            results = []
            for rank, (sim, chunk, doc_title, doc_type) in enumerate(scored[:top_k], start=1):
                results.append(
                    RetrievalChunk(
                        id=chunk.id,
                        knowledge_id=chunk.knowledge_id,
                        user_id=chunk.user_id,
                        chunk_index=chunk.chunk_index,
                        content=chunk.content,
                        token_count=chunk.token_count,
                        source_metadata=chunk.source_metadata or {},
                        document_title=doc_title,
                        document_type=doc_type,
                        embedding_model=chunk.embedding_model,
                        dense_rank=rank,
                        dense_score=round(float(sim), 4),
                        method="dense",
                    )
                )
            return results

        # PostgreSQL native pgvector cosine distance (<=>)
        dist_expr = KnowledgeChunk.embedding.cosine_distance(query_vector).label("distance")
        stmt = (
            select(
                KnowledgeChunk,
                Knowledge.title.label("doc_title"),
                Knowledge.type.label("doc_type"),
                dist_expr,
            )
            .join(Knowledge, Knowledge.id == KnowledgeChunk.knowledge_id)
            .where(
                KnowledgeChunk.user_id == user_id,
                KnowledgeChunk.embedding.is_not(None),
                KnowledgeChunk.embedding_model == emb_provider.model_name,
            )
        )
        if knowledge_id:
            stmt = stmt.where(KnowledgeChunk.knowledge_id == knowledge_id)

        stmt = stmt.order_by(dist_expr.asc()).limit(top_k * 2)
        res = await db.execute(stmt)
        rows = res.all()

        results: List[RetrievalChunk] = []
        rank = 1
        for chunk, doc_title, doc_type, dist in rows:
            # Cosine similarity is 1.0 - cosine_distance
            sim = 1.0 - float(dist if dist is not None else 1.0)
            if sim < min_similarity:
                continue
            results.append(
                RetrievalChunk(
                    id=chunk.id,
                    knowledge_id=chunk.knowledge_id,
                    user_id=chunk.user_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    token_count=chunk.token_count,
                    source_metadata=chunk.source_metadata or {},
                    document_title=doc_title or "Untitled",
                    document_type=doc_type or "note",
                    embedding_model=chunk.embedding_model,
                    dense_rank=rank,
                    dense_score=round(sim, 4),
                    method="dense",
                )
            )
            rank += 1
            if len(results) >= top_k:
                break

        return results

    async def retrieve_sparse(
        self,
        db: AsyncSession,
        query: str,
        user_id: str,
        knowledge_id: Optional[str] = None,
        top_k: int = 10,
    ) -> List[RetrievalChunk]:
        """Perform sparse keyword retrieval using PostgreSQL FTS with fallback."""
        clean_q = (query or "").strip()
        if not clean_q or not user_id:
            return []

        bind = db.get_bind()
        is_sqlite = bind is not None and bind.dialect.name == "sqlite"

        if is_sqlite:
            return await self._sparse_sqlite_fallback(
                db=db,
                query=clean_q,
                user_id=user_id,
                knowledge_id=knowledge_id,
                top_k=top_k,
            )

        # 1. PostgreSQL Full-Text Search using websearch_to_tsquery
        # Sanitize query for websearch
        safe_query = re.sub(r"['\":*&|!]", " ", clean_q).strip()
        if not safe_query:
            safe_query = clean_q

        ts_vector = func.to_tsvector("english", KnowledgeChunk.content)
        ts_query = func.websearch_to_tsquery("english", safe_query)
        rank_expr = func.ts_rank_cd(ts_vector, ts_query).label("rank_score")

        stmt = (
            select(
                KnowledgeChunk,
                Knowledge.title.label("doc_title"),
                Knowledge.type.label("doc_type"),
                rank_expr,
            )
            .join(Knowledge, Knowledge.id == KnowledgeChunk.knowledge_id)
            .where(
                KnowledgeChunk.user_id == user_id,
                ts_vector.op("@@")(ts_query),
            )
        )
        if knowledge_id:
            stmt = stmt.where(KnowledgeChunk.knowledge_id == knowledge_id)

        stmt = stmt.order_by(rank_expr.desc()).limit(top_k)

        try:
            res = await db.execute(stmt)
            rows = res.all()
        except Exception as exc:
            logger.warning(f"PostgreSQL FTS query failed, attempting token fallback: {exc}")
            rows = []

        if rows:
            results: List[RetrievalChunk] = []
            for rank, (chunk, doc_title, doc_type, rank_score) in enumerate(rows, start=1):
                results.append(
                    RetrievalChunk(
                        id=chunk.id,
                        knowledge_id=chunk.knowledge_id,
                        user_id=chunk.user_id,
                        chunk_index=chunk.chunk_index,
                        content=chunk.content,
                        token_count=chunk.token_count,
                        source_metadata=chunk.source_metadata or {},
                        document_title=doc_title or "Untitled",
                        document_type=doc_type or "note",
                        embedding_model=chunk.embedding_model,
                        sparse_rank=rank,
                        sparse_score=round(float(rank_score or 0.0), 4),
                        method="sparse",
                    )
                )
            return results

        # 2. Tokenized ILIKE Fallback if FTS yields 0 rows (e.g. stop words or exact symbols)
        return await self._sparse_sqlite_fallback(
            db=db,
            query=clean_q,
            user_id=user_id,
            knowledge_id=knowledge_id,
            top_k=top_k,
        )

    async def _sparse_sqlite_fallback(
        self,
        db: AsyncSession,
        query: str,
        user_id: str,
        knowledge_id: Optional[str] = None,
        top_k: int = 10,
    ) -> List[RetrievalChunk]:
        """Token-matching keyword retrieval fallback for SQLite or when FTS query is empty."""
        tokens = [
            t.lower()
            for t in re.findall(r"\w+", query)
            if len(t) > 2 and t.lower() not in STOPWORDS
        ]
        if not tokens:
            tokens = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 1]
        if not tokens:
            return []

        filters = [KnowledgeChunk.content.ilike(f"%{token}%") for token in tokens]
        stmt = (
            select(KnowledgeChunk, Knowledge.title, Knowledge.type)
            .join(Knowledge, Knowledge.id == KnowledgeChunk.knowledge_id)
            .where(
                KnowledgeChunk.user_id == user_id,
                or_(*filters),
            )
        )
        if knowledge_id:
            stmt = stmt.where(KnowledgeChunk.knowledge_id == knowledge_id)

        res = await db.execute(stmt)
        rows = res.all()

        scored: List[tuple[float, KnowledgeChunk, str, str]] = []
        for chunk, doc_title, doc_type in rows:
            c_lower = chunk.content.lower()
            score = 0.0
            for t in tokens:
                count = c_lower.count(t)
                if count > 0:
                    score += 1.0 + min(count * 0.2, 2.0)
            if score > 0:
                scored.append((score, chunk, doc_title or "Untitled", doc_type or "note"))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for rank, (score, chunk, doc_title, doc_type) in enumerate(scored[:top_k], start=1):
            results.append(
                RetrievalChunk(
                    id=chunk.id,
                    knowledge_id=chunk.knowledge_id,
                    user_id=chunk.user_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    token_count=chunk.token_count,
                    source_metadata=chunk.source_metadata or {},
                    document_title=doc_title,
                    document_type=doc_type,
                    embedding_model=chunk.embedding_model,
                    sparse_rank=rank,
                    sparse_score=round(float(score), 4),
                    method="sparse",
                )
            )
        return results

    async def retrieve_hybrid(
        self,
        db: AsyncSession,
        query: str,
        user_id: str,
        knowledge_id: Optional[str] = None,
        top_k: int = 5,
        dense_top_k: int = 20,
        sparse_top_k: int = 20,
        rrf_k: int = 60,
        dense_weight: float = 1.0,
        sparse_weight: float = 1.0,
        min_similarity: float = 0.0,
        provider: Optional[BaseEmbeddingProvider] = None,
    ) -> List[RetrievalChunk]:
        """Perform Hybrid Retrieval combining dense vector and sparse keyword search with RRF.
        
        Reciprocal Rank Fusion (RRF) Formula:
            RRF_score(d) = (dense_weight / (rrf_k + dense_rank(d))) + (sparse_weight / (rrf_k + sparse_rank(d)))
            
        Chunks retrieved by both methods receive higher fused rankings and retain
        explainability metadata (dense_rank, dense_score, sparse_rank, sparse_score, rrf_score).
        """
        clean_q = (query or "").strip()
        if not clean_q or not user_id:
            return []

        # 1. Execute dense vector search
        dense_results: List[RetrievalChunk] = []
        try:
            dense_results = await self.retrieve_dense(
                db=db,
                query=clean_q,
                user_id=user_id,
                knowledge_id=knowledge_id,
                top_k=dense_top_k,
                min_similarity=min_similarity,
                provider=provider,
            )
        except Exception as exc:
            logger.warning(f"Hybrid retrieval dense pass failed: {exc}")
            dense_results = []

        # 2. Execute sparse keyword search
        sparse_results: List[RetrievalChunk] = []
        try:
            sparse_results = await self.retrieve_sparse(
                db=db,
                query=clean_q,
                user_id=user_id,
                knowledge_id=knowledge_id,
                top_k=sparse_top_k,
            )
        except Exception as exc:
            logger.warning(f"Hybrid retrieval sparse pass failed: {exc}")
            sparse_results = []

        # 3. Fuse via Reciprocal Rank Fusion (RRF)
        fused_map: Dict[str, RetrievalChunk] = {}

        # Process dense candidates
        for chunk in dense_results:
            rrf = dense_weight / (rrf_k + (chunk.dense_rank or len(dense_results)))
            chunk.rrf_score = round(rrf, 6)
            chunk.method = "dense"
            fused_map[chunk.id] = chunk

        # Process sparse candidates and merge
        for chunk in sparse_results:
            sparse_contrib = sparse_weight / (rrf_k + (chunk.sparse_rank or len(sparse_results)))
            if chunk.id in fused_map:
                existing = fused_map[chunk.id]
                existing.sparse_rank = chunk.sparse_rank
                existing.sparse_score = chunk.sparse_score
                existing.rrf_score = round((existing.rrf_score or 0.0) + sparse_contrib, 6)
                existing.method = "hybrid"
            else:
                chunk.rrf_score = round(sparse_contrib, 6)
                chunk.method = "sparse"
                fused_map[chunk.id] = chunk

        fused_list = list(fused_map.values())
        fused_list.sort(key=lambda x: (x.rrf_score or 0.0), reverse=True)

        return fused_list[:top_k]

retrieval_service = RetrievalService()

