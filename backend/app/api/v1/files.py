import os
import re
from typing import Optional, List
from pathlib import Path
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File as FastAPIFile,
    Form,
    Query,
    Response,
    BackgroundTasks,
)
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete as sa_delete

from app.database.session import get_db, AsyncSessionLocal
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.file import File
from app.models.knowledge import Knowledge
from app.models.collection import Collection
from app.models.tag import Tag
from app.schemas.file import FileResponse, FileListResponse
from app.services.storage.local_provider import storage_provider
from app.services.document_processor import (
    validate_file_content,
    extract_document_text,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/files", tags=["files"])

def _format_file_response(f: File) -> FileResponse:
    return FileResponse(
        id=f.id,
        user_id=f.user_id,
        knowledge_id=f.knowledge_id,
        original_filename=f.original_filename,
        stored_filename=f.stored_filename,
        mime_type=f.mime_type,
        size_bytes=f.size_bytes,
        file_path=f.file_path,
        extracted_text=f.extracted_text,
        processing_status=f.processing_status,
        processing_error=f.processing_error,
        created_at=f.created_at,
        updated_at=f.updated_at,
        download_url=f"/api/v1/files/{f.id}/download",
        file_size_formatted=storage_provider.format_bytes(f.size_bytes),
    )

async def _get_background_session():
    """Helper to obtain DB session for background tasks, supporting test dependency overrides."""
    from app.main import app
    db_gen = app.dependency_overrides.get(get_db, None)
    if db_gen:
        async for s in db_gen():
            return s
    return AsyncSessionLocal()

async def process_file_background(file_id: str):
    """Background task to extract document text and persist into File & Knowledge records."""
    session = await _get_background_session()
    try:
        # Retrieve file
        res = await session.execute(select(File).where(File.id == file_id))
        f = res.scalar_one_or_none()
        if not f:
            return

        # Transition status to 'processing'
        f.processing_status = "processing"
        f.processing_error = None
        await session.commit()
        await session.refresh(f)

        try:
            target_path = storage_provider.get_path(f.stored_filename)
            extracted_text = extract_document_text(target_path, f.original_filename)

            f.extracted_text = extracted_text
            f.processing_status = "completed"
            f.processing_error = None

            # If associated with Knowledge, update knowledge content and status
            if f.knowledge_id:
                k_res = await session.execute(select(Knowledge).where(Knowledge.id == f.knowledge_id))
                k = k_res.scalar_one_or_none()
                if k:
                    k.content = extracted_text
                    k.processing_status = "COMPLETED"
                    k.processing_progress = 100
                    k.processing_step = "Document text extracted"

            await session.commit()

            # Trigger RAG Ingestion for extracted document text
            if f.knowledge_id:
                try:
                    from app.services.rag_ingestion_service import rag_ingestion_service
                    await rag_ingestion_service.ingest_knowledge(f.knowledge_id, f.user_id, session)
                except Exception:
                    pass
        except Exception as exc:
            f.processing_status = "failed"
            f.processing_error = str(exc)

            if f.knowledge_id:
                k_res = await session.execute(select(Knowledge).where(Knowledge.id == f.knowledge_id))
                k = k_res.scalar_one_or_none()
                if k:
                    k.processing_status = "FAILED"
                    k.processing_step = f"Extraction failed: {str(exc)}"

            await session.commit()
    finally:
        await session.close()

@router.post("/upload", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = FastAPIFile(...),
    knowledge_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    collection_id: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    create_knowledge: bool = Form(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF or DOCX file, store it safely, validate contents, and enqueue document text extraction."""
    orig_name = file.filename or "upload.bin"
    ext = Path(orig_name).suffix.lower()

    if ext not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Only .pdf and .docx documents are accepted.",
        )

    # Validate collection ownership if specified
    if collection_id:
        c_res = await db.execute(
            select(Collection).where(Collection.id == collection_id, Collection.user_id == current_user.id)
        )
        if not c_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified collection not found or not owned by current user",
            )

    # Validate knowledge ownership if existing knowledge_id specified
    target_knowledge: Optional[Knowledge] = None
    if knowledge_id:
        k_res = await db.execute(
            select(Knowledge).where(Knowledge.id == knowledge_id, Knowledge.user_id == current_user.id)
        )
        target_knowledge = k_res.scalar_one_or_none()
        if not target_knowledge:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified knowledge item not found or not owned by current user",
            )

    # Save to disk using chunked writer
    try:
        stored_filename = await storage_provider.save(file)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store file on disk: {str(e)}",
        )

    saved_path = storage_provider.get_path(stored_filename)
    file_size_bytes = os.path.getsize(saved_path)

    # Enforce max upload size limit
    if file_size_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
        storage_provider.delete(stored_filename)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload size limit ({storage_provider.format_bytes(settings.MAX_UPLOAD_SIZE_BYTES)}).",
        )

    # Content signature (magic bytes) validation
    try:
        doc_type = validate_file_content(saved_path, orig_name)
    except ValueError as val_err:
        storage_provider.delete(stored_filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )

    mime_type = "application/pdf" if doc_type == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    k_type = "PDF" if doc_type == "pdf" else "DOCUMENT"

    # Automatically create or link Knowledge item if requested
    if not target_knowledge and create_knowledge:
        # Generate friendly clean title from filename if title not provided
        clean_title = (title or Path(orig_name).stem).replace("_", " ").replace("-", " ").strip()
        formatted_title = clean_title.title() if clean_title else orig_name

        tag_names = []
        if tags:
            tag_names = [t.strip().lstrip("#").lower() for t in tags.split(",") if t.strip()]

        # Resolve tags
        resolved_tags: List[Tag] = []
        for tname in tag_names:
            t_res = await db.execute(select(Tag).where(Tag.name == tname, Tag.user_id == current_user.id))
            existing_tag = t_res.scalar_one_or_none()
            if not existing_tag:
                existing_tag = Tag(name=tname, user_id=current_user.id, color="#6366F1")
                db.add(existing_tag)
                await db.flush()
            resolved_tags.append(existing_tag)

        target_knowledge = Knowledge(
            user_id=current_user.id,
            title=formatted_title,
            type=k_type,
            summary=f"Ingested {doc_type.upper()} document '{orig_name}' ({storage_provider.format_bytes(file_size_bytes)}).",
            content=f"# {formatted_title}\n\n**Source File:** `{orig_name}` ({storage_provider.format_bytes(file_size_bytes)})\n\nProcessing text extraction...",
            file_name=orig_name,
            file_size=storage_provider.format_bytes(file_size_bytes),
            file_type=mime_type,
            storage_key=stored_filename,
            collection_id=collection_id,
            processing_status="PROCESSING",
            processing_progress=20,
            processing_step="File uploaded, extraction queued",
            key_concepts=[doc_type.upper(), "Document Extraction"],
            tags=resolved_tags,
        )
        db.add(target_knowledge)
        await db.flush()
    elif target_knowledge:
        target_knowledge.file_name = orig_name
        target_knowledge.file_size = storage_provider.format_bytes(file_size_bytes)
        target_knowledge.file_type = mime_type
        target_knowledge.storage_key = stored_filename
        target_knowledge.processing_status = "PROCESSING"
        target_knowledge.processing_progress = 20
        target_knowledge.processing_step = "File uploaded, extraction queued"

    # Create File record
    new_file = File(
        user_id=current_user.id,
        knowledge_id=target_knowledge.id if target_knowledge else None,
        original_filename=orig_name,
        stored_filename=stored_filename,
        file_path=stored_filename,
        mime_type=mime_type,
        size_bytes=file_size_bytes,
        processing_status="uploaded",
        processing_error=None,
    )
    db.add(new_file)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="DOCUMENT_UPLOADED",
        knowledge_id=target_knowledge.id if target_knowledge else new_file.id,
        knowledge_title=orig_name,
        item_type="DOCUMENT",
    )
    await db.commit()
    await db.refresh(new_file)

    # Enqueue background text extraction
    background_tasks.add_task(process_file_background, new_file.id)

    return _format_file_response(new_file)

@router.get("", response_model=FileListResponse)
async def list_files(
    response: Response,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    file_type: Optional[str] = Query(None, description="Filter by 'pdf' or 'docx'"),
    knowledge_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search by original filename or extracted text"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all files owned by the authenticated user with filtering and pagination."""
    query = select(File).where(File.user_id == current_user.id)

    if file_type:
        ft = file_type.lower().strip()
        if ft in ["pdf", "application/pdf"]:
            query = query.where(File.mime_type == "application/pdf")
        elif ft in ["docx", "doc"]:
            query = query.where(File.mime_type.ilike("%wordprocessingml%"))

    if knowledge_id:
        query = query.where(File.knowledge_id == knowledge_id)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                File.original_filename.ilike(term),
                File.extracted_text.ilike(term),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    # Paginate and order by newest first
    query = query.order_by(File.created_at.desc()).offset(offset).limit(limit)
    res = await db.execute(query)
    files = res.scalars().all()

    response.headers["X-Total-Count"] = str(total)

    return FileListResponse(
        items=[_format_file_response(f) for f in files],
        total=total,
        limit=limit,
        offset=offset,
    )

@router.get("/{file_id}", response_model=FileResponse)
async def get_file_metadata(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve metadata and extracted text for an individual file owned by current user."""
    res = await db.execute(
        select(File).where(File.id == file_id, File.user_id == current_user.id)
    )
    f = res.scalar_one_or_none()
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied.",
        )
    return _format_file_response(f)

@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the original stored document, enforcing ownership and path security."""
    res = await db.execute(
        select(File).where(File.id == file_id, File.user_id == current_user.id)
    )
    f = res.scalar_one_or_none()
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied.",
        )

    try:
        file_path = storage_provider.get_path(f.stored_filename)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored file is missing from backend disk storage.",
        )

    return FastAPIFileResponse(
        path=str(file_path),
        media_type=f.mime_type,
        filename=f.original_filename,
    )

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete the File record and remove the stored binary file from disk.
    
    Associated Knowledge entries are safely preserved (file reference is detached).
    """
    res = await db.execute(
        select(File).where(File.id == file_id, File.user_id == current_user.id)
    )
    f = res.scalar_one_or_none()
    if not f:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied.",
        )

    # Detach from associated Knowledge item if linked
    if f.knowledge_id:
        k_res = await db.execute(select(Knowledge).where(Knowledge.id == f.knowledge_id))
        k = k_res.scalar_one_or_none()
        if k:
            k.file_name = None
            k.file_size = None
            k.file_type = None
            k.storage_key = None

    # Delete physical file from disk
    storage_provider.delete(f.stored_filename)

    # Delete File record from PostgreSQL
    await db.delete(f)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

