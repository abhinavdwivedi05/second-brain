# Second Brain — System Architecture & Workflow Specifications

This document provides a technical walkthrough of the **Second Brain** system architecture, data models, state management, and lifecycle workflows.

---

## 1. System Components

The application is structured into three primary tiers:

```mermaid
flowchart LR
    subgraph Presentation_Layer [Presentation Layer: Next.js 16 / React 19]
        AppShell[AppShell / Layout]
        Context[KnowledgeContext & AuthContext]
        Views[Dashboard, Library, Detail, Collections, Tags, Settings]
        Drawers[AIAssistantDrawer, CommandPalette, AddKnowledgeModal]
    end

    subgraph Service_Layer [Service & Business Logic: FastAPI]
        Router[API v1 Routers]
        AuthService[Auth & JWT Verification]
        DocProcessor[Document Processor / pypdf & docx]
        WebClipper[Web Extractor & SSRF Guard]
        SearchService[Search Relevance Engine]
        AIOrchestrator[AI Provider: Mock / Gemini]
        ActivityLogger[Activity Tracking Engine]
    end

    subgraph Persistence_Layer [Persistence & Storage]
        PostgresDB[(PostgreSQL 16 Relational Database)]
        LocalStorage[(Local File Storage: /storage)]
    end

    Presentation_Layer <-- JSON REST / Bearer JWT --> Service_Layer
    Service_Layer <--> PostgresDB
    Service_Layer <--> LocalStorage
```

---

## 2. Frontend / Backend Communication Pipeline

1. **State Hydration**: On authentication, `KnowledgeContext` calls `refreshAllData()`. It dispatches parallel async requests via `apiClient`:
   - `GET /api/v1/knowledge`: Ingests user-scoped notes with pagination and active filters.
   - `GET /api/v1/collections`: Ingests user collections with live document counts.
   - `GET /api/v1/tags`: Ingests user tags.
   - `GET /api/v1/dashboard/stats`: Ingests real-time aggregated metrics and recent items.
   - `GET /api/v1/activities`: Ingests user audit timeline events.
2. **Optimistic & Synchronous Updates**: After any mutating CRUD operation (create note, toggle favorite, edit collection), the client immediately updates the local state and dispatches background synchronizations.
3. **HTTP Interceptor**: `apiClient` manages automatic injection of `Authorization: Bearer <token>`, content-type negotiation, and standardized error transformation (`ApiClientError`).

---

## 3. Database Schema & Relationships

### Core Relational Models:
1. **User (`users`)**:
   - Primary key: UUID string.
   - Fields: `email` (unique, indexed), `hashed_password`, `name`, `role`, `storage_used_bytes`, `storage_limit_bytes`.
   - Relationships: One-to-many with `Knowledge`, `Collections`, `Tags`, `Files`, and `Activities` (all configured with `cascade="all, delete-orphan"`).
2. **Knowledge (`knowledge`)**:
   - Primary key: UUID string.
   - Foreign keys: `user_id` (ondelete="CASCADE"), `collection_id` (ondelete="SET NULL").
   - Fields: `title`, `type` (NOTE, LINK, PDF, DOCUMENT), `summary`, `content`, `original_url`, `is_favorite`, `is_archived`, `created_at`, `updated_at`, `last_accessed_at`.
   - Relationships: Many-to-many with `Tag` via junction table `knowledge_tags`. One-to-many with `File`.
3. **File (`files`)**:
   - Primary key: UUID string.
   - Foreign keys: `user_id` (ondelete="CASCADE"), `knowledge_id` (ondelete="SET NULL").
   - Fields: `original_filename`, `stored_filename`, `mime_type`, `size_bytes`, `processing_status` (uploaded, processing, completed, failed), `extracted_text`.
4. **Activity (`activities`)**:
   - Primary key: UUID string.
   - Foreign keys: `user_id` (ondelete="CASCADE").
   - Fields: `action` (CREATED, UPDATED, DELETED, FAVORITED, DOCUMENT_UPLOADED, etc.), `knowledge_id`, `knowledge_title`, `type`, `timestamp`.

---

## 4. End-to-End Workflows

### A. Authentication & Session Flow
```mermaid
sequenceDiagram
    participant User as Browser Client
    participant API as FastAPI /api/v1/auth
    participant DB as PostgreSQL

    User->>API: POST /login (username, password)
    API->>DB: SELECT * FROM users WHERE email = ?
    DB-->>API: User record with hashed_password
    API->>API: verify_password(password, hashed_password)
    API->>API: create_access_token(subject=user.id)
    API-->>User: { access_token, token_type: "bearer" }
    User->>User: Save token in localStorage
    User->>API: GET /me (Authorization: Bearer token)
    API-->>User: UserProfile JSON
```

### B. Document Upload & Processing Workflow
```mermaid
sequenceDiagram
    participant User as Client
    participant API as /api/v1/files/upload
    participant Disk as /storage
    participant BG as Background Task
    participant DB as PostgreSQL

    User->>API: POST /upload (file, metadata)
    API->>API: Validate file signature (magic bytes)
    API->>Disk: Write stream in chunks to UUID filename
    API->>DB: INSERT INTO knowledge & INSERT INTO files
    API->>DB: INSERT INTO activities (DOCUMENT_UPLOADED)
    API-->>User: 201 Created (FileResponse)
    API->>BG: Enqueue process_file_background(file_id)
    BG->>Disk: Read file binary
    BG->>BG: Extract text paragraphs & tables (pypdf/docx)
    BG->>DB: UPDATE files SET extracted_text, status='completed'
    BG->>DB: UPDATE knowledge SET content, status='COMPLETED'
```

### C. Web Clipper Extraction Workflow
```mermaid
sequenceDiagram
    participant User as Client
    participant API as /api/v1/knowledge/import-url
    participant Guard as SSRF Validator
    participant Extractor as Webpage Extractor
    participant AI as AI Engine
    participant DB as PostgreSQL

    User->>API: POST /import-url (url, collection_id)
    API->>Guard: validate_target_url(url)
    Guard->>Guard: Resolve DNS & verify IP not private/localhost
    Guard-->>API: Validated public URL
    API->>Extractor: fetch_webpage(url) & parse HTML
    Extractor->>Extractor: Strip headers, footers, scripts, nav
    Extractor->>Extractor: Convert article DOM to Markdown
    Extractor->>AI: Generate summary & extract concepts
    AI-->>API: Title, Markdown body, 3-sentence summary, tags
    API->>DB: INSERT INTO knowledge (type="LINK")
    API->>DB: INSERT INTO activities (CREATED)
    API-->>User: 201 Created (KnowledgeOut)
```

### D. AI Grounded Chat & Context Isolation
```mermaid
sequenceDiagram
    participant User as Client
    participant Drawer as AIAssistantDrawer
    participant API as /api/v1/ai/chat
    participant DB as PostgreSQL
    participant Provider as AI Provider (Mock / Gemini)

    Note over User,Drawer: Case 1: Single Document Context Mode
    User->>Drawer: Ask "What is PostgreSQL?" (activeItem: Tutorial)
    Drawer->>API: POST /ai/chat { query, knowledge_id: "tutorial-id" }
    API->>DB: SELECT * FROM knowledge WHERE id = "tutorial-id" AND user_id = current_user
    DB-->>API: Note content
    API->>Provider: Prompt with Single-Document Grounding
    Provider-->>API: Answer + citation
    API-->>Drawer: { answer, sources: [{ id: "tutorial-id", title: "Tutorial" }] }

    Note over User,Drawer: Case 2: Global Knowledge Mode
    User->>Drawer: Click "Switch to Global" -> Ask "What do I know about Docker?"
    Drawer->>API: POST /ai/chat { query } (no knowledge_id)
    API->>DB: Execute relevance search across user knowledge
    DB-->>API: Matching notes (Docker note)
    API->>Provider: Multi-document synthesis prompt
    Provider-->>API: Synthesized answer
    API-->>Drawer: { answer, sources: [{ id: "docker-id", title: "Docker Note" }] }
```

