# Second Brain — Personal Knowledge Operating System

An AI-powered, personal knowledge management engine designed to help knowledge workers, developers, and researchers capture, organize, synthesize, and converse with their multi-format knowledge base.

---

## 1. Project Overview

**Second Brain** is a full-stack, enterprise-grade personal knowledge operating system developed as a final-year major project in Computer Science & Engineering. Built with Next.js 16, React 19, FastAPI, SQLAlchemy 2.0, and PostgreSQL, the platform seamlessly integrates notes, web clippings, and uploaded documents (.pdf, .docx) into a unified, searchable, and AI-grounded personal repository.

---

## 2. Problem Statement

Modern professionals and researchers interact with fragmented information across browser tabs, PDF documents, technical specifications, and raw notes. Existing tools suffer from:
- **Siloed formats**: Disconnect between bookmarks, uploaded files, and markdown notes.
- **Surface-level search**: Keyword matching without contextual relevance or text extraction from attachments.
- **AI Hallucinations & Context Bleeding**: Generic chatbots that invent facts or cross-contaminate unrelated notes.
- **Security & Privacy Risks**: Cloud-based tools that ingest private internal documents into public training models or expose servers to Server-Side Request Forgery (SSRF) when clipping links.

---

## 3. Project Objectives

1. **Unified Multi-Format Storage**: Ingest text notes, public webpages, PDFs, and Word documents (.docx) into a normalized PostgreSQL relational database.
2. **Deep Document & Web Extraction**: Extract structural paragraphs and tables from files and webpages, stripping boilerplate navigation headers and footers.
3. **Database-Backed Intelligent Search**: Provide sub-millisecond weighted relevance search across titles, summaries, contents, and tags with pagination.
4. **Context-Isolated AI Assistance**: Provide conversational Q&A strictly grounded in user-saved notes, with strict isolation between Single-Document Context Mode and Global Knowledge Mode.
5. **Real-time Live Analytics**: Track user activity and visualize database-grounded statistics without mock data.
6. **Robust Security Boundaries**: Enforce user data isolation, SSRF defense, file signature validation, and secure authentication.

---

## 4. Main Features

- **Authentication & Security**: Argon2/bcrypt password hashing, JWT authentication, and user-level data isolation.
- **Knowledge Engine**: Full CRUD for notes, links, and documents with tagging, custom collections, and favorites.
- **Document Processing**: Chunked upload of `.pdf` and `.docx` files, magic byte validation, text and table extraction.
- **Web Clipper**: Intelligent URL capture with SSRF defense (localhost/private IP filtering, DNS rebinding prevention), content sanitization, automatic summary generation, and tag suggestions.
- **Intelligent Search**: Weighted relevance ranking (`title` weight 10, `summary` weight 5, `content` weight 2) with multi-criteria filters.
- **AI Knowledge Assistant**: Summarization, concept extraction, tag suggestions, and dual-mode conversational chat with cited sources.
- **Dashboard & Activity Engine**: Live PostgreSQL counters for all resources, recent additions, and persistent activity audit logs.

---

## 5. Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Library**: React 19
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4 (Fixed dark theme with purple accent system)
- **Icons**: Lucide React
- **Testing**: Jest, React Testing Library

### Backend
- **Framework**: FastAPI (Python 3.12)
- **ORM**: SQLAlchemy 2.0 (AsyncIO engine)
- **Database**: PostgreSQL 16
- **Migrations**: Alembic
- **Document Parsers**: pypdf, python-docx, beautifulsoup4
- **Testing**: Pytest, Pytest-AsyncIO, HTTPX

---

## 6. System Architecture

```mermaid
flowchart TD
    User([User Browser])
    NextJS[Next.js 16 Frontend / React 19]
    FastAPI[FastAPI Backend Server]
    Postgres[(PostgreSQL 16 Database)]
    LocalStorage[Local File Storage /storage]
    AIProvider[AI Provider Engine: Mock/Local NLP or Gemini API]

    User <--> NextJS
    NextJS <-- REST API / JWT --> FastAPI
    FastAPI <--> Postgres
    FastAPI <--> LocalStorage
    FastAPI <--> AIProvider
```

---

## 7. Frontend Architecture

The frontend follows a modern React 19 / Next.js 16 App Router structure:
- `src/app/`: Next.js root layout, font configurations, metadata, and application entry points.
- `src/components/`:
  - `layout/`: `AppShell`, `Sidebar` (collapsible, mobile overlay drawer), `Header`.
  - `dashboard/`: `DashboardView` with live PostgreSQL metrics, recent notes, favorite spotlight, and activity timeline.
  - `knowledge/`: `KnowledgeLibrary` (grid/list/compact views, type filters, sort) and `KnowledgeDetail` (note viewer, inline editor, file downloader, AI action pills).
  - `upload/`: `AddKnowledgeModal` with tabs for Notes, Web Clipper, and File Uploads.
  - `collections/`: `CollectionsView` for organizing notes into structured workspaces.
  - `tags/`: `TagsView` with item counts and search filtering.
  - `search/`: `CommandPalette` (Cmd+K global search bar with instant results).
  - `ai/`: `AIAssistantDrawer` (grounded chat with document context banner, toggle to global, and source citations).
  - `settings/`: `SettingsView` showing user storage usage and account profile.
- `src/context/`: `AuthContext` (JWT management, profile caching) and `KnowledgeContext` (global state management for items, collections, tags, dashboard stats, and real activity events).
- `src/services/api/`: Typed API client layer (`client.ts`, `knowledge.ts`, `files.ts`, `collections.ts`, `tags.ts`, `ai.ts`, `dashboard.ts`).

---

## 8. Backend Architecture

The backend follows a modular layered architecture:
- `backend/app/api/v1/`: API route controllers for `auth`, `knowledge`, `files`, `collections`, `tags`, `search`, `ai`, `dashboard`, and `activities`.
- `backend/app/core/`: Application settings (`config.py`), security primitives (`security.py`), and authentication dependencies (`dependencies.py`).
- `backend/app/database/`: Async SQLAlchemy engine and session lifecycle management (`session.py`).
- `backend/app/models/`: SQLAlchemy 2.0 mapped models (`User`, `Knowledge`, `File`, `Collection`, `Tag`, `Activity`, `ProcessingJob`).
- `backend/app/schemas/`: Pydantic v2 validation models with automatic camelCase aliases.
- `backend/app/services/`: Business logic services:
  - `document_processor.py`: PDF page extraction and DOCX paragraph/table extraction.
  - `web_extractor.py`: SSRF-protected webpage download, HTML sanitization, and Markdown formatting.
  - `activity_service.py`: Transactional event logging for user audit trails.
  - `ai_service.py`: Interface to AI provider instances.
- `backend/app/ai/`:
  - `mock_provider.py`: Deterministic local NLP fallback engine with regex intent parsing (comparisons, definitions, procedural, out-of-scope).
  - `gemini_provider.py`: Google Gemini 1.5 Flash integration.

---

## 9. Database Overview & Entity-Relationship Model

```mermaid
erDiagram
    USERS ||--o{ KNOWLEDGE : owns
    USERS ||--o{ COLLECTIONS : owns
    USERS ||--o{ TAGS : owns
    USERS ||--o{ FILES : owns
    USERS ||--o{ ACTIVITIES : performs
    COLLECTIONS ||--o{ KNOWLEDGE : categorizes
    KNOWLEDGE ||--o{ FILES : attaches
    KNOWLEDGE }o--o{ TAGS : labeled_with

    USERS {
        string id PK
        string email UK
        string hashed_password
        string name
        bigint storage_used_bytes
        bigint storage_limit_bytes
    }

    KNOWLEDGE {
        string id PK
        string user_id FK
        string title
        string type
        text summary
        text content
        string collection_id FK
        boolean is_favorite
        boolean is_archived
        datetime created_at
        datetime last_accessed_at
    }

    COLLECTIONS {
        string id PK
        string user_id FK
        string name
        string icon
        string color
    }

    TAGS {
        string id PK
        string user_id FK
        string name
        string color
    }

    FILES {
        string id PK
        string user_id FK
        string knowledge_id FK
        string original_filename
        string stored_filename
        string mime_type
        integer size_bytes
        string processing_status
    }

    ACTIVITIES {
        string id PK
        string user_id FK
        string action
        string knowledge_id
        string knowledge_title
        string type
        datetime timestamp
    }
```

---

## 10. Authentication Flow

1. User submits email and password to `/api/v1/auth/signup`.
2. Password is encrypted using `passlib` (Argon2 / bcrypt) with salt.
3. User logs in at `/api/v1/auth/login`. On validation, server issues a signed HS256 JWT access token.
4. Token is stored in `localStorage` and attached via `Authorization: Bearer <token>` on all subsequent API requests.
5. In FastAPI, `get_current_user` extracts the JWT, verifies the signature, and retrieves the active `User` record.

---

## 11. File Processing Workflow

1. User uploads a `.pdf` or `.docx` file through the upload tab or drag-and-drop zone.
2. The server verifies file extension and validates the binary header signature (magic bytes: `%PDF-` or `PK\x03\x04`).
3. The file is saved to disk in `backend/storage/` under a secure UUID filename, avoiding path traversal.
4. If `create_knowledge=True`, a parent `Knowledge` item is generated and linked to the `File` record.
5. FastAPI enqueues background processing (`process_file_background`):
   - For PDFs: `pypdf.PdfReader` iterates over pages, extracting text and section headings.
   - For DOCXs: `docx.Document` extracts text paragraphs and parses tables cell-by-cell.
6. Extracted text updates the `Knowledge.content` field and transitions `processing_status` to `"completed"`.

---

## 12. Web Clipper Workflow

1. User enters a public webpage URL in the Web Link tab.
2. **SSRF Validation**: `validate_target_url` resolves DNS hostnames and rejects localhost, private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback addresses (`127.0.0.1`, `::1`), link-local IPs, and AWS metadata IPs (`169.254.169.254`).
3. Webpage is fetched with strict timeout (15s) and maximum size limits (10MB).
4. `BeautifulSoup` removes script tags, style sheets, tracking pixels, navigation headers (`.navheader`), footers (`.navfooter`), and breadcrumb bars.
5. Page title, meta description, and article body are converted into clean Markdown.
6. The AI engine synthesizes a concise 2-4 sentence summary and extracts key technical concepts.
7. The user can review and edit all extracted content before saving permanently to PostgreSQL.

---

## 13. AI Workflow

### Dual-Mode Chat Operation
- **Single Document Context Mode**: When a user inspects a specific document in the detail view, queries send `knowledge_id: item.id`. The backend restricts context strictly to that document, filters boilerplate introductory phrases, and cites only that document.
- **Global Knowledge Mode**: When querying without an active document context, the backend performs multi-term PostgreSQL search retrieval to ground the response across all saved notes and documents.
- **Negative Answer Grounding**: If the knowledge base does not contain information addressing the query, the AI provider explicitly states this honest limitation and clears source references (`sources = []`), preventing misleading citations.

### Offline / Local NLP Fallback Mode
By default, `AI_PROVIDER=mock` executes locally using deterministic regex intent classification and sentence-level extractive summarization without network calls or external API keys. Setting `AI_PROVIDER=gemini` enables live Google Gemini 1.5 Flash generation.

---

## 14. Search Workflow

1. User presses `Cmd+K` (or clicks Search) to open the Command Palette.
2. Frontend queries `/api/v1/search?q=<query>`.
3. The SQL query scores results using relevance weighting:
   - Match in `title`: weight 10
   - Match in `summary`: weight 5
   - Match in `content`: weight 2
   - Match in `tags`: weight 3
4. Server generates dynamic context snippets centered around the matching keywords.
5. Clicking any result immediately opens the note in the Knowledge Detail view and updates `last_accessed_at`.

---

## 15. Environment Configuration

### Backend (`backend/.env`)
```ini
# PostgreSQL Database Connection
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/second_brain
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/second_brain

# Security & Authentication
JWT_SECRET=super_secret_second_brain_jwt_token_key_change_in_production_2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# File Storage
STORAGE_DIR=storage
STORAGE_ENDPOINT=http://localhost:8000/static

# AI Configuration (mock for offline local execution; gemini for cloud AI)
AI_PROVIDER=mock
GEMINI_MODEL=gemini-1.5-flash
# GEMINI_API_KEY=your_gemini_api_key_here

# Frontend URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Frontend (`.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 16. Installation Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.12+
- Docker Desktop (for local PostgreSQL 16)

---

## 17. Docker / PostgreSQL Setup

Start the PostgreSQL 16 database container:
```bash
docker run --name second-brain-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=second_brain -p 5432:5432 -d postgres:16
```

Run database migrations:
```bash
cd backend
alembic upgrade head
```

---

## 18. Backend Startup

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- API Base: `http://localhost:8000`
- Swagger Interactive Documentation: `http://localhost:8000/docs`

---

## 19. Frontend Startup

```bash
# In the repository root:
npm install
npm run dev
```
- Open `http://localhost:3000` in your web browser.

---

## 20. Automated Testing Instructions

### Run Backend Pytest Suite (50 Tests)
```bash
python -c "import sys; sys.path.insert(0, 'backend'); import pytest; sys.exit(pytest.main(['backend/app/tests', '-v']))"
```

### Run Frontend Jest Suite (13 Suites, 90 Tests)
```bash
npx jest
```

### Run TypeScript Strict Typecheck
```bash
npx tsc --noEmit
```

### Run ESLint Quality Audit
```bash
npx eslint src/
```

### Run Production Build
```bash
npm run build
```

---

## 21. API Endpoint Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | Register a new user |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT access token |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile |
| `GET` | `/api/v1/dashboard/stats` | Real-time user metrics, recent items, and activities |
| `GET` | `/api/v1/activities` | Paginated user activity event log |
| `GET` | `/api/v1/knowledge` | List personal knowledge items with filters |
| `POST` | `/api/v1/knowledge` | Create a text note |
| `POST` | `/api/v1/knowledge/import-url` | Web Clipper URL import with SSRF defense |
| `GET` | `/api/v1/knowledge/{id}` | Retrieve item by ID & update last accessed time |
| `PATCH` | `/api/v1/knowledge/{id}` | Update note content, title, tags, or summary |
| `DELETE` | `/api/v1/knowledge/{id}` | Delete a knowledge item |
| `POST` | `/api/v1/knowledge/{id}/favorite` | Toggle favorite status |
| `POST` | `/api/v1/files/upload` | Upload PDF/DOCX and enqueue text extraction |
| `GET` | `/api/v1/files/{id}/download` | Download original binary file |
| `GET` | `/api/v1/search` | Intelligent weighted relevance search |
| `POST` | `/api/v1/ai/summarize` | AI-generated summary of knowledge content |
| `POST` | `/api/v1/ai/extract-concepts` | Extract key technical concepts |
| `POST` | `/api/v1/ai/suggest-tags` | Generate relevant suggested tags |
| `POST` | `/api/v1/ai/chat` | Dual-mode conversational knowledge assistant |

---

## 22. Security Measures

1. **User Isolation**: Every database query enforces `user_id == current_user.id`. Users cannot view or modify other users' notes, files, collections, tags, or activities.
2. **SSRF Defense**: The Web Clipper rejects private IPv4/IPv6 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopbacks (`127.0.0.1`, `::1`), link-local IPs, and cloud metadata IPs (`169.254.169.254`) before making HTTP requests.
3. **File Signature Validation**: Validates binary magic bytes to ensure uploaded files genuinely match `.pdf` or `.docx` formats rather than renamed executables.
4. **Path Traversal Protection**: Uploaded files receive sanitized UUID-based names in storage, preventing directory traversal attacks.
5. **CORS Hardening**: Strict origin whitelisting in FastAPI prevents cross-site request forgery.

---

## 23. Known Limitations

1. **Scanned PDF OCR**: PDFs without embedded text streams (scanned image documents) are flagged as empty; OCR (e.g. Tesseract) is not included in the standard lightweight Docker runtime.
2. **Dynamic SPA Web Clipper**: Single Page Applications requiring client-side JavaScript execution (e.g. complex React apps without server-rendered HTML) may return limited content; standard public HTML pages, technical blogs, and documentation are fully supported.
3. **Gemini API Quotas**: Live Gemini integration requires an active `GEMINI_API_KEY`. When unconfigured or rate-limited, the system seamlessly operates in deterministic local NLP mode (`AI_PROVIDER=mock`).
