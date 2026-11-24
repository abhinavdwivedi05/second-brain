"""CLI script for safe, controlled RAG knowledge re-indexing and backfill.

Usage:
    # 1. Dry run inspection (no changes made):
    python backend/app/scripts/reindex_knowledge.py --dry-run

    # 2. Re-index unindexed or mock-embedded items for all users:
    python backend/app/scripts/reindex_knowledge.py

    # 3. Re-index specific user:
    python backend/app/scripts/reindex_knowledge.py --user-email user@example.com

    # 4. Re-index a specific knowledge item:
    python backend/app/scripts/reindex_knowledge.py --knowledge-id <UUID>

    # 5. Force re-index all items even if already indexed with current model:
    python backend/app/scripts/reindex_knowledge.py --force
"""

import sys
import os
import argparse
import asyncio

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import select
from app.database.session import AsyncSessionLocal
from app.models.user import User
from app.models.knowledge import Knowledge
from app.services.embedding_service import embedding_service
from app.services.rag_ingestion_service import rag_ingestion_service

async def main():
    parser = argparse.ArgumentParser(description="Second Brain RAG Controlled Knowledge Re-indexing Engine")
    parser.add_argument("--dry-run", action="store_true", help="Simulate re-indexing without calling embedding provider or altering DB")
    parser.add_argument("--user-email", type=str, help="Target a specific user by email (default: all users)")
    parser.add_argument("--knowledge-id", type=str, help="Target a single knowledge item by ID")
    parser.add_argument("--force", action="store_true", help="Force re-chunking and re-embedding even if already indexed with current model")
    parser.add_argument("--batch-size", type=int, default=20, help="Batch size for processing items")

    args = parser.parse_args()

    print("=" * 70)
    print("Second Brain AI 2.0 - Controlled RAG Knowledge Re-indexing Engine")
    print(f"Active Provider:    {embedding_service.active_provider_name}")
    print(f"Active Model:       {embedding_service.model_name}")
    print(f"Vector Dimensions:  {embedding_service.dimension}")
    print(f"Mode:               {'DRY RUN (Simulation - No DB Writes)' if args.dry_run else 'LIVE EXECUTION'}")
    print(f"Force Re-index:     {args.force}")
    print("=" * 70)

    async with AsyncSessionLocal() as session:
        # Single knowledge item target
        if args.knowledge_id:
            k_res = await session.execute(select(Knowledge).where(Knowledge.id == args.knowledge_id.strip()))
            item = k_res.scalar_one_or_none()
            if not item:
                print(f"Error: Knowledge item '{args.knowledge_id}' not found.")
                return
            print(f"Targeting single item: '{item.title}' (ID: {item.id}, User: {item.user_id})")
            if args.dry_run:
                print("Dry-run complete. No database changes made.")
                return

            print("Ingesting and embedding item...")
            res = await rag_ingestion_service.ingest_knowledge(
                knowledge_id=item.id,
                user_id=item.user_id,
                db=session,
                force=args.force,
            )
            print(f"Result: status={res.get('status')}, chunks={res.get('chunks_created')}, embeddings={res.get('embeddings_generated')}")
            if res.get("error"):
                print(f"Error: {res['error']}")
            print("=" * 70)
            return

        # Resolve target users
        user_query = select(User)
        if args.user_email:
            user_query = user_query.where(User.email == args.user_email.strip())

        users = (await session.execute(user_query)).scalars().all()
        if not users:
            print(f"No users found matching criteria.")
            return

        print(f"Found {len(users)} user(s) to process.\n")

        total_processed = 0
        total_succeeded = 0
        total_failed = 0
        total_chunks = 0

        for user in users:
            print(f"--- User: {user.name} ({user.email}) [ID: {user.id}] ---")
            
            # Get estimate
            estimate = await rag_ingestion_service.estimate_backfill(user_id=user.id, db=session)
            print(f"Total Items:            {estimate['total_items']}")
            print(f"Already Indexed:        {estimate['already_indexed_count']}")
            print(f"Unindexed / Stale:      {estimate['unindexed_items_count']}")
            print(f"Estimated Chunks:       {estimate['estimated_chunks']}")
            print(f"Estimated Tokens:       {estimate['estimated_tokens']}")

            if args.dry_run:
                print("Dry-run complete for this user. No database changes made.\n")
                continue

            # Run backfill
            print("\nStarting ingestion...")
            result = await rag_ingestion_service.backfill_user_knowledge(
                user_id=user.id,
                db=session,
                dry_run=False,
                force=args.force,
                batch_size=args.batch_size,
            )
            processed = result.get("processed_items", 0)
            succeeded = result.get("succeeded", 0)
            failed = result.get("failed", 0)
            chunks_created = result.get("total_chunks_created", 0)

            total_processed += processed
            total_succeeded += succeeded
            total_failed += failed
            total_chunks += chunks_created

            print(f"User Results: Processed={processed}, Succeeded={succeeded}, Failed={failed}, Chunks Created={chunks_created}\n")

        print("=" * 70)
        if args.dry_run:
            print("DRY RUN FINISHED - No database records were modified.")
        else:
            print(f"RE-INDEX COMPLETE: Total Processed={total_processed}, Succeeded={total_succeeded}, Failed={total_failed}, Chunks Created={total_chunks}")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main())
