import io
import os
from pathlib import Path
import pytest
import docx
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.services.storage.local_provider import storage_provider
from app.api.v1.files import process_file_background

def make_valid_pdf(text: str = "Test PDF Document for Second Brain") -> bytes:
    """Generate minimal valid PDF bytes with extractable text and exact xref table."""
    stream_content = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET\n"
    stream_bytes = stream_content.encode("latin1")
    length = len(stream_bytes)

    parts = [
        b"%PDF-1.4\n",
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
        f"4 0 obj\n<< /Length {length} >>\nstream\n".encode("latin1") + stream_bytes + b"endstream\nendobj\n",
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ]

    offsets = [0]
    cur = len(parts[0])
    for p in parts[1:]:
        offsets.append(cur)
        cur += len(p)

    xref = f"xref\n0 {len(parts)}\n0000000000 65535 f \n"
    for off in offsets[1:]:
        xref += f"{off:010d} 00000 n \n"
    xref += f"trailer\n<< /Size {len(parts)} /Root 1 0 R >>\nstartxref\n{cur}\n%%EOF\n"

    return b"".join(parts) + xref.encode("latin1")

def make_valid_docx(title: str = "Test DOCX", body: str = "Paragraph content", table_cells: tuple = ("Row1 Col1", "Row1 Col2")) -> bytes:
    """Generate valid DOCX document bytes containing paragraphs and tables."""
    doc = docx.Document()
    doc.add_heading(title, level=1)
    doc.add_paragraph(body)
    table = doc.add_table(rows=1, cols=2)
    table.cell(0, 0).text = table_cells[0]
    table.cell(0, 1).text = table_cells[1]
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

async def get_authenticated_headers(client: AsyncClient, email: str = "filetester@example.com", name: str = "File Tester"):
    pwd = "Password123!"
    await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": pwd, "name": name},
    )
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": email, "password": pwd},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_unauthenticated_file_endpoints_blocked():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/files")
        assert resp.status_code == 401

        resp = await client.post("/api/v1/files/upload")
        assert resp.status_code == 401

        resp = await client.get("/api/v1/files/nonexistent-id")
        assert resp.status_code == 401

        resp = await client.get("/api/v1/files/nonexistent-id/download")
        assert resp.status_code == 401

        resp = await client.delete("/api/v1/files/nonexistent-id")
        assert resp.status_code == 401

@pytest.mark.asyncio
async def test_upload_validation_and_rejections():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = await get_authenticated_headers(client, "uploader_val@example.com", "Val User")

        # 1. Unsupported extension (.txt)
        txt_files = {"file": ("test.txt", b"plain text content", "text/plain")}
        resp = await client.post("/api/v1/files/upload", headers=headers, files=txt_files)
        assert resp.status_code == 400
        assert "Unsupported file extension" in resp.json()["detail"]

        # 2. Invalid PDF content (magic bytes mismatch)
        fake_pdf = {"file": ("fake.pdf", b"this is not a valid pdf at all", "application/pdf")}
        resp = await client.post("/api/v1/files/upload", headers=headers, files=fake_pdf)
        assert resp.status_code == 400
        assert "PDF format signature" in resp.json()["detail"]

        # 3. Invalid DOCX content (magic bytes mismatch)
        fake_docx = {"file": ("fake.docx", b"this is not a zip docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        resp = await client.post("/api/v1/files/upload", headers=headers, files=fake_docx)
        assert resp.status_code == 400
        assert "DOCX package signature" in resp.json()["detail"]

        # 4. Oversized file check
        orig_max = settings.MAX_UPLOAD_SIZE_BYTES
        try:
            settings.MAX_UPLOAD_SIZE_BYTES = 100  # small limit for testing
            pdf_bytes = make_valid_pdf("Oversized content")
            resp = await client.post(
                "/api/v1/files/upload",
                headers=headers,
                files={"file": ("large.pdf", pdf_bytes, "application/pdf")},
            )
            assert resp.status_code in [400, 413]
            assert "exceeds maximum upload size" in resp.json()["detail"]
        finally:
            settings.MAX_UPLOAD_SIZE_BYTES = orig_max

@pytest.mark.asyncio
async def test_pdf_upload_extraction_and_metadata():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = await get_authenticated_headers(client, "pdf_extractor@example.com", "PDF User")

        pdf_bytes = make_valid_pdf("PostgreSQL Architecture and Storage Internals")
        files = {"file": ("postgres_internals.pdf", pdf_bytes, "application/pdf")}
        data = {"title": "PostgreSQL Internals Guide", "tags": "postgres,database,systems"}

        # Upload
        resp = await client.post("/api/v1/files/upload", headers=headers, files=files, data=data)
        assert resp.status_code == 201
        file_data = resp.json()
        file_id = file_data["id"]
        assert file_data["originalFilename"] == "postgres_internals.pdf"
        assert file_data["mimeType"] == "application/pdf"
        assert file_data["processingStatus"] in ["uploaded", "processing", "completed"]
        assert file_data["knowledgeId"] is not None
        knowledge_id = file_data["knowledgeId"]

        # Run background processor
        await process_file_background(file_id)

        # Retrieve file metadata
        get_file_resp = await client.get(f"/api/v1/files/{file_id}", headers=headers)
        assert get_file_resp.status_code == 200
        processed_file = get_file_resp.json()
        assert processed_file["processingStatus"] == "completed"
        assert "PostgreSQL Architecture and Storage Internals" in processed_file["extractedText"]

        # Verify associated Knowledge record has extracted text
        k_resp = await client.get(f"/api/v1/knowledge/{knowledge_id}", headers=headers)
        assert k_resp.status_code == 200
        k_data = k_resp.json()
        assert k_data["type"] == "PDF"
        assert "PostgreSQL Architecture and Storage Internals" in k_data["content"]
        assert k_data["processingStatus"] == "COMPLETED"

@pytest.mark.asyncio
async def test_docx_upload_extraction_and_tables():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = await get_authenticated_headers(client, "docx_extractor@example.com", "DOCX User")

        docx_bytes = make_valid_docx(
            title="Distributed Consensus Specifications",
            body="Raft protocol provides reliable state machine replication.",
            table_cells=("Term Index", "Leader Lease"),
        )
        files = {"file": ("consensus_spec.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        data = {"title": "Distributed Consensus Notes"}

        resp = await client.post("/api/v1/files/upload", headers=headers, files=files, data=data)
        assert resp.status_code == 201
        file_id = resp.json()["id"]

        await process_file_background(file_id)

        get_resp = await client.get(f"/api/v1/files/{file_id}", headers=headers)
        assert get_resp.status_code == 200
        processed = get_resp.json()
        assert processed["processingStatus"] == "completed"
        assert "Raft protocol provides reliable state machine replication." in processed["extractedText"]
        assert "Term Index | Leader Lease" in processed["extractedText"]

@pytest.mark.asyncio
async def test_file_listing_filtering_and_pagination():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = await get_authenticated_headers(client, "list_user@example.com", "List User")

        # Upload a PDF and a DOCX
        pdf_bytes = make_valid_pdf("PDF content for listing")
        docx_bytes = make_valid_docx("DOCX content for listing")

        await client.post(
            "/api/v1/files/upload",
            headers=headers,
            files={"file": ("list_test1.pdf", pdf_bytes, "application/pdf")},
        )
        await client.post(
            "/api/v1/files/upload",
            headers=headers,
            files={"file": ("list_test2.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )

        # List all
        resp = await client.get("/api/v1/files", headers=headers)
        assert resp.status_code == 200
        assert "X-Total-Count" in resp.headers
        data = resp.json()
        assert data["total"] >= 2
        assert len(data["items"]) >= 2

        # Filter by file_type = pdf
        pdf_list = await client.get("/api/v1/files?file_type=pdf", headers=headers)
        assert pdf_list.status_code == 200
        for item in pdf_list.json()["items"]:
            assert item["mimeType"] == "application/pdf"

        # Search by q
        q_resp = await client.get("/api/v1/files?q=list_test2", headers=headers)
        assert q_resp.status_code == 200
        q_data = q_resp.json()
        assert any("list_test2" in item["originalFilename"] for item in q_data["items"])

@pytest.mark.asyncio
async def test_user_ownership_isolation_for_files():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        user1_headers = await get_authenticated_headers(client, "file_owner1@example.com", "Owner 1")
        user2_headers = await get_authenticated_headers(client, "file_owner2@example.com", "Owner 2")

        pdf_bytes = make_valid_pdf("Secret Owner 1 Document")
        upload_resp = await client.post(
            "/api/v1/files/upload",
            headers=user1_headers,
            files={"file": ("secret1.pdf", pdf_bytes, "application/pdf")},
        )
        file_id = upload_resp.json()["id"]

        # User 2 tries to get User 1's file metadata
        u2_get = await client.get(f"/api/v1/files/{file_id}", headers=user2_headers)
        assert u2_get.status_code == 404

        # User 2 tries to download User 1's file
        u2_dl = await client.get(f"/api/v1/files/{file_id}/download", headers=user2_headers)
        assert u2_dl.status_code == 404

        # User 2 tries to delete User 1's file
        u2_del = await client.delete(f"/api/v1/files/{file_id}", headers=user2_headers)
        assert u2_del.status_code == 404

        # User 2 listing does not include User 1's file
        u2_list = await client.get("/api/v1/files", headers=user2_headers)
        file_ids = [f["id"] for f in u2_list.json()["items"]]
        assert file_id not in file_ids

@pytest.mark.asyncio
async def test_file_download_and_missing_disk_handling():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = await get_authenticated_headers(client, "downloader@example.com", "Download User")

        pdf_bytes = make_valid_pdf("Original Download Verification Bytes")
        upload_resp = await client.post(
            "/api/v1/files/upload",
            headers=headers,
            files={"file": ("original_download.pdf", pdf_bytes, "application/pdf")},
        )
        file_data = upload_resp.json()
        file_id = file_data["id"]
        stored_name = file_data["storedFilename"]

        # Download original
        dl_resp = await client.get(f"/api/v1/files/{file_id}/download", headers=headers)
        assert dl_resp.status_code == 200
        assert dl_resp.content == pdf_bytes
        assert "original_download.pdf" in dl_resp.headers.get("content-disposition", "")

        # Simulate missing file on disk
        target_path = storage_provider.get_path(stored_name)
        if target_path.exists():
            os.remove(target_path)

        # Download should gracefully return 404
        dl_missing = await client.get(f"/api/v1/files/{file_id}/download", headers=headers)
        assert dl_missing.status_code == 404
        assert "missing from backend disk" in dl_missing.json()["detail"]

@pytest.mark.asyncio
async def test_file_deletion_and_knowledge_preservation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = await get_authenticated_headers(client, "deleter@example.com", "Delete User")

        pdf_bytes = make_valid_pdf("Preserved Knowledge Notes")
        upload_resp = await client.post(
            "/api/v1/files/upload",
            headers=headers,
            files={"file": ("delete_test.pdf", pdf_bytes, "application/pdf")},
        )
        file_data = upload_resp.json()
        file_id = file_data["id"]
        knowledge_id = file_data["knowledgeId"]

        # Delete file
        del_resp = await client.delete(f"/api/v1/files/{file_id}", headers=headers)
        assert del_resp.status_code == 204

        # File record is gone
        get_file = await client.get(f"/api/v1/files/{file_id}", headers=headers)
        assert get_file.status_code == 404

        # Crucial check: Associated Knowledge record was PRESERVED
        get_k = await client.get(f"/api/v1/knowledge/{knowledge_id}", headers=headers)
        assert get_k.status_code == 200
        assert get_k.json()["id"] == knowledge_id

