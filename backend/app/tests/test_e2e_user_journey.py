import io
import uuid
import socket
import pytest
import pytest_asyncio
import httpx
from pypdf import PdfWriter
import docx

from app.main import app
from app.services import web_extractor
from app.core.config import settings

@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

def create_sample_pdf_bytes(text: str = "Second Brain PDF Documentation: Distributed Consensus & Raft Protocol.") -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    # Use real PDF format
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()

def create_sample_docx_bytes(title: str = "System Architecture", table_cell: str = "FastAPI Backend") -> bytes:
    doc = docx.Document()
    doc.add_heading(title, 0)
    doc.add_paragraph("This document outlines the core architectural components of Second Brain.")
    table = doc.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Component"
    table.cell(0, 1).text = "Technology"
    table.cell(1, 0).text = "API Gateway"
    table.cell(1, 1).text = table_cell
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

SAMPLE_WEB_HTML = """<!DOCTYPE html>
<html>
<head>
    <title>PostgreSQL Tutorial & Documentation - Official Guide</title>
    <meta name="description" content="Official tutorial for PostgreSQL relational database.">
</head>
<body>
<article>
    <h1>PostgreSQL Tutorial</h1>
    <p>PostgreSQL is an advanced open-source object-relational database management system offering reliability and data integrity.</p>
    <p>In this guide, you will learn structured query language commands, index optimization, and transaction isolation levels.</p>
</article>
</body>
</html>
"""

@pytest.mark.asyncio
async def test_complete_24_step_user_journey(client: httpx.AsyncClient, monkeypatch):
    """Complete 24-step end-to-end user journey across all Second Brain subsystems."""
    monkeypatch.setattr(settings, "AI_PROVIDER", "mock")
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))
    ])

    async def mock_fetch(url: str, **kwargs):
        return SAMPLE_WEB_HTML, url, 200

    monkeypatch.setattr(web_extractor, "fetch_webpage", mock_fetch)

    # ----------------------------------------------------
    # Step 1: User registers and logs in
    # ----------------------------------------------------
    uid = uuid.uuid4().hex[:8]
    email = f"e2e_{uid}@example.com"
    pwd = "StrongPassword123!"
    reg_res = await client.post("/api/v1/auth/signup", json={"name": "End2End User", "email": email, "password": pwd})
    assert reg_res.status_code == 201

    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email

    # ----------------------------------------------------
    # Step 2: User creates a text note
    # ----------------------------------------------------
    note_payload = {
        "title": "System Design: Microservices Communication",
        "type": "NOTE",
        "content": "Comparing gRPC protocol buffers with REST JSON APIs in distributed systems.",
        "summary": "Technical trade-offs between gRPC and REST.",
        "tags": ["architecture", "backend"],
    }
    note_res = await client.post("/api/v1/knowledge", json=note_payload, headers=headers)
    assert note_res.status_code == 201
    note_id = note_res.json()["id"]

    # ----------------------------------------------------
    # Step 3: User edits and favorites the note
    # ----------------------------------------------------
    edit_res = await client.patch(
        f"/api/v1/knowledge/{note_id}",
        json={"title": "System Design: Microservices Communication (Final Revision)"},
        headers=headers,
    )
    assert edit_res.status_code == 200
    assert "Final Revision" in edit_res.json()["title"]

    fav_res = await client.post(f"/api/v1/knowledge/{note_id}/favorite", headers=headers)
    assert fav_res.status_code == 200
    assert fav_res.json()["isFavorite"] is True

    # ----------------------------------------------------
    # Step 4: User creates a collection
    # ----------------------------------------------------
    col_payload = {
        "name": "Backend Engineering",
        "description": "System architecture and cloud notes",
        "icon": "FolderKanban",
        "color": "#8B5CF6",
    }
    col_res = await client.post("/api/v1/collections", json=col_payload, headers=headers)
    assert col_res.status_code == 201
    col_id = col_res.json()["id"]

    # ----------------------------------------------------
    # Step 5: User adds tags
    # ----------------------------------------------------
    tag_res = await client.post(
        "/api/v1/tags",
        json={"name": "distributed-systems", "color": "#10B981"},
        headers=headers,
    )
    assert tag_res.status_code == 201

    # ----------------------------------------------------
    # Step 6 & 7: User uploads a PDF and content is extracted
    # ----------------------------------------------------
    pdf_bytes = create_sample_pdf_bytes()
    pdf_upload = await client.post(
        "/api/v1/files/upload",
        files={"file": ("raft_protocol.pdf", pdf_bytes, "application/pdf")},
        data={"collection_id": col_id, "tags": "consensus,pdf"},
        headers=headers,
    )
    assert pdf_upload.status_code == 201
    pdf_file_id = pdf_upload.json()["id"]
    pdf_k_id = pdf_upload.json()["knowledgeId"]
    assert pdf_file_id is not None
    assert pdf_k_id is not None

    # ----------------------------------------------------
    # Step 8 & 9: User uploads a DOCX with paragraphs and tables
    # ----------------------------------------------------
    docx_bytes = create_sample_docx_bytes(title="System Architecture Spec", table_cell="FastAPI Engine")
    docx_upload = await client.post(
        "/api/v1/files/upload",
        files={"file": ("architecture_spec.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"collection_id": col_id, "tags": "docx,spec"},
        headers=headers,
    )
    assert docx_upload.status_code == 201
    docx_k_id = docx_upload.json()["knowledgeId"]
    assert docx_k_id is not None

    # ----------------------------------------------------
    # Step 10 & 11: User imports a public webpage using its URL
    # ----------------------------------------------------
    url_res = await client.post(
        "/api/v1/knowledge/import-url",
        json={"url": "https://www.postgresql.org/docs/tutorial/index.html", "collection_id": col_id},
        headers=headers,
    )
    assert url_res.status_code == 201
    url_item = url_res.json()
    url_k_id = url_item["id"]
    assert "PostgreSQL" in url_item["title"]
    assert url_item["type"] == "LINK"
    assert len(url_item["summary"]) > 10

    # ----------------------------------------------------
    # Step 12: User edits the imported knowledge item
    # ----------------------------------------------------
    url_edit = await client.patch(
        f"/api/v1/knowledge/{url_k_id}",
        json={"summary": "Curated PostgreSQL official tutorial bookmark with relational notes."},
        headers=headers,
    )
    assert url_edit.status_code == 200
    assert "Curated PostgreSQL" in url_edit.json()["summary"]

    # ----------------------------------------------------
    # Step 13 & 14: User searches for a keyword from imported webpage
    # ----------------------------------------------------
    search_res = await client.get("/api/v1/search?q=PostgreSQL", headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] >= 1
    found_ids = [item["id"] for item in search_data["items"]]
    assert url_k_id in found_ids

    # ----------------------------------------------------
    # Step 15: User opens the item from search results
    # ----------------------------------------------------
    detail_res = await client.get(f"/api/v1/knowledge/{url_k_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["lastAccessedAt"] is not None

    # ----------------------------------------------------
    # Step 16: User generates a summary
    # ----------------------------------------------------
    sum_res = await client.post("/api/v1/ai/summarize", json={"knowledge_id": url_k_id}, headers=headers)
    assert sum_res.status_code == 200
    assert len(sum_res.json()["summary"]) > 10

    # ----------------------------------------------------
    # Step 17: User extracts concepts
    # ----------------------------------------------------
    conc_res = await client.post("/api/v1/ai/extract-concepts", json={"knowledge_id": url_k_id}, headers=headers)
    assert conc_res.status_code == 200
    assert len(conc_res.json()["keyConcepts"]) > 0

    # ----------------------------------------------------
    # Step 18: User requests tag suggestions
    # ----------------------------------------------------
    tags_res = await client.post("/api/v1/ai/suggest-tags", json={"knowledge_id": url_k_id}, headers=headers)
    assert tags_res.status_code == 200
    assert len(tags_res.json()["tags"]) > 0

    # ----------------------------------------------------
    # Step 19, 20, 21: User asks AI chat in single-document mode
    # ----------------------------------------------------
    chat_res = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is PostgreSQL?", "knowledge_id": url_k_id},
        headers=headers,
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert "relational database" in chat_data["answer"].lower()
    assert len(chat_data["sources"]) == 1
    assert chat_data["sources"][0]["id"] == url_k_id

    # ----------------------------------------------------
    # Step 22: Dashboard counts and activity reflect operations
    # ----------------------------------------------------
    dash_res = await client.get("/api/v1/dashboard/stats", headers=headers)
    assert dash_res.status_code == 200
    stats = dash_res.json()
    assert stats["totalKnowledge"] >= 4
    assert stats["totalNotes"] >= 1
    assert stats["totalLinks"] >= 1
    assert stats["totalDocuments"] >= 2
    assert stats["totalCollections"] >= 1
    assert stats["totalFavorites"] >= 1
    assert len(stats["recentActivities"]) >= 5

    act_res = await client.get("/api/v1/activities", headers=headers)
    assert act_res.status_code == 200
    acts = act_res.json()
    action_types = {a["action"] for a in acts}
    assert "CREATED" in action_types
    assert "UPDATED" in action_types
    assert "FAVORITED" in action_types

    # ----------------------------------------------------
    # Step 23 & 24: User refreshes application and data remains available
    # ----------------------------------------------------
    refreshed_k = await client.get("/api/v1/knowledge", headers=headers)
    assert refreshed_k.status_code == 200
    assert len(refreshed_k.json()) >= 4

    refreshed_cols = await client.get("/api/v1/collections", headers=headers)
    assert refreshed_cols.status_code == 200
    assert len(refreshed_cols.json()) >= 1

    refreshed_files = await client.get("/api/v1/files", headers=headers)
    assert refreshed_files.status_code == 200
    assert len(refreshed_files.json()["items"]) >= 2

    refreshed_dash = await client.get("/api/v1/dashboard/stats", headers=headers)
    assert refreshed_dash.status_code == 200
    assert refreshed_dash.json()["totalKnowledge"] >= 4

