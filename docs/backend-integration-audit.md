# SECOND BRAIN — Backend Integration & Architecture Audit

**Document Status:** Final Audit Report  
**Author:** Antigravity AI Engineering  
**Date:** September 26, 2026  
**Target Repository:** `Second Brain`  

---

## 1. Executive Summary & Codebase Audit (Phase 1)

This audit inspects the existing **Second Brain — Personal Knowledge Operating System** frontend codebase to establish an authoritative technical foundation before building the FastAPI backend, PostgreSQL database schema, Alembic migrations, and REST endpoints.

### Key Audit Discoveries:

| Technical Property | Specification / Value in Codebase |
| :--- | :--- |
| **Frontend Framework & Version** | Next.js `16.3.6` (App Router) |
| **UI Library & React Version** | React `19.2.8` / React DOM `19.2.8` |
| **Styling & Design System** | Tailwind CSS `^4.0` (`@tailwindcss/postcss`), custom dark/light theme tokens in `globals.css` |
| **TypeScript Version & Config** | TypeScript `^5.0`, `target: ES2017`, `moduleResolution: bundler`, `@/*` alias mapped to `./src/*` |
| **Icons & Utility Libraries** | `lucide-react` (`^1.48.0`), `clsx` (`^2.1.1`), `tailwind-merge` (`^3.7.0`) |
| **Current State Architecture** | Centralized React Context (`KnowledgeContext.tsx`, `ThemeContext.tsx`) managing views, filters, and UI modals |
| **Current Data Persistence** | In-browser `localStorage` (`second_brain_knowledge_v1`, `second_brain_collections_v1`, `second_brain_tags_v1`) seeded by static mock data |
| **Environment Variables** | None currently present (No `.env` file committed) |

---

## 2. Existing Frontend Architecture (Phase 2 - Section A)

### 2.1 View & Route Structure
The application currently operates as a high-performance single-page application (SPA) shell mounted at `src/app/page.tsx`, managed by `KnowledgeContext` with active view states:

1. **Dashboard (`DashboardView.tsx`)**: Displays storage analytics, AI credit breakdown, quick text/link capture, recent activity logs, and pinned/favorite knowledge entries.
2. **Knowledge Library (`KnowledgeLibrary.tsx`)**: Primary search and filter hub with multi-layout support (`grid`, `list`, `compact`), type chips (`ALL`, `NOTE`, `LINK`, `PDF`, `IMAGE`, `AUDIO`, `DOCUMENT`), and sorting options.
3. **Knowledge Detail View (`KnowledgeDetail.tsx`)**: Rich view/edit interface displaying raw content, extracted AI key concepts, automated summary, related knowledge links, metadata properties, and action controls.
4. **Collections View (`CollectionsView.tsx`)**: Grouping manager displaying collection cards, item counts, icons, creation modal, and collection deletion triggers.
5. **Tags View (`TagsView.tsx`)**: Tag directory showing system tags, item counts, color badges, and instant filter triggers.
6. **Command Palette (`CommandPalette.tsx`)**: Global modal launched via `Cmd+K` / `Ctrl+K` for instant multi-field search and view shortcuts.
7. **Unified Capture Modal (`AddKnowledgeModal.tsx`)**: Multi-tab modal (`Note`, `Link`, `File Upload`) supporting drag-and-drop file ingestion, tag selection, and collection mapping.
8. **AI Assistant Drawer (`AIAssistantDrawer.tsx`)**: Slide-out assistant drawer providing context-aware Q&A, content summarization, and key concept extraction.
9. **Settings & Profile (`SettingsView.tsx`)**: Account management, storage quota indicator, AI credit breakdown, theme preference, and data export.
10. **Landing Page (`LandingPage.tsx`)**: Marketing overview explaining system architecture and product features.

### 2.2 Component Hierarchy & Layout Standard
```text
RootLayout (src/app/layout.tsx)
  └── ThemeProvider (src/context/ThemeContext.tsx)
        └── KnowledgeProvider (src/context/KnowledgeContext.tsx)
              └── AppShell (src/components/layout/AppShell.tsx)
                    ├── Sidebar (src/components/layout/Sidebar.tsx)
                    ├── Header (src/components/layout/Header.tsx)
                    ├── Main View Router (src/app/page.tsx -> Dashboard | Library | Detail | Collections | Tags | Settings)
                    ├── CommandPalette (src/components/search/CommandPalette.tsx)
                    ├── AddKnowledgeModal (src/components/upload/AddKnowledgeModal.tsx)
                    └── AIAssistantDrawer (src/components/ai/AIAssistantDrawer.tsx)
```

### 2.3 Data Models & TypeScript Contracts (`src/types/index.ts`)

```typescript
export type KnowledgeType = 'NOTE' | 'LINK' | 'PDF' | 'IMAGE' | 'AUDIO' | 'DOCUMENT';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface KnowledgeItem {
  id: string;
  title: string;
  type: KnowledgeType;
  summary: string;
  content: string;
  originalUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  tags: string[];
  collectionId?: string;
  collectionName?: string;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  lastAccessedAt?: string;
  processingStatus: ProcessingStatus;
  processingProgress?: number; // 0 to 100
  processingStep?: string;
  keyConcepts: string[];
  relatedKnowledgeIds: string[];
  aiInsights?: string[];
  audioDuration?: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  itemCount: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  itemCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
  storageUsedBytes: number;
  storageLimitBytes: number;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
}

export interface ActivityLog {
  id: string;
  action: 'CREATED' | 'UPDATED' | 'FAVORITED' | 'ACCESSED' | 'DELETED' | 'AI_PROCESSED';
  knowledgeId: string;
  knowledgeTitle: string;
  timestamp: string;
  type: KnowledgeType;
}

export interface SearchFilterOptions {
  query: string;
  type?: KnowledgeType | 'ALL';
  collectionId?: string;
  tag?: string;
  favoritesOnly?: boolean;
  sortBy?: 'newest' | 'oldest' | 'recently_accessed' | 'title';
}
```

---

## 3. Existing API Contracts & Backend Migration Mapping (Phase 2 - Section B)

Currently, all data requests flow through 5 client-side service abstractions in `src/services/api/`. Below is the complete contract breakdown and the corresponding FastAPI endpoints that will replace the mock logic.

### 3.1 `KnowledgeService` (`src/services/api/knowledge.ts`)

#### Contract 1: Get All Knowledge Items
- **Service Method:** `KnowledgeService.getAll(options?: SearchFilterOptions)`
- **Endpoint:** `GET /api/v1/knowledge`
- **HTTP Method:** `GET`
- **Query Parameters:**
  - `query`: `string` (optional - search term)
  - `type`: `KnowledgeType | 'ALL'` (optional)
  - `collection_id`: `string` (optional)
  - `tag`: `string` (optional)
  - `favorites_only`: `boolean` (optional)
  - `sort_by`: `'newest' | 'oldest' | 'recently_accessed' | 'title'` (optional, default: `newest`)
- **Response Type:** `KnowledgeItem[]`
- **Current Mock Implementation:** Filters and sorts in-memory JavaScript array loaded from `localStorage`.
- **Expected Backend Implementation:** FastAPI handler executing SQL queries via SQLAlchemy 2.x on PostgreSQL, with indexed `ILIKE` / PostgreSQL full-text search, foreign key joins on `tags` and `collections`, and strict `user_id` scope.

#### Contract 2: Get Knowledge Item by ID
- **Service Method:** `KnowledgeService.getById(id: string)`
- **Endpoint:** `GET /api/v1/knowledge/{id}`
- **HTTP Method:** `GET`
- **Request Parameters:** Path parameter `id` (`UUID` / `string`)
- **Response Type:** `KnowledgeItem | null`
- **Current Mock Implementation:** Finds item in `localStorage` array and updates `lastAccessedAt` timestamp locally.
- **Expected Backend Implementation:** FastAPI handler performing SQL lookup by `id` and `user_id`. Updates `last_accessed_at` column in DB and returns item with related tags, collection name, and key concepts. Returns `404 Not Found` if non-existent or owned by another user.

#### Contract 3: Toggle Favorite Status
- **Service Method:** `KnowledgeService.toggleFavorite(id: string)`
- **Endpoint:** `PATCH /api/v1/knowledge/{id}/favorite` (or `PATCH /api/v1/knowledge/{id}`)
- **HTTP Method:** `PATCH`
- **Request Body:** `{ "isFavorite": boolean }`
- **Response Type:** `KnowledgeItem`
- **Current Mock Implementation:** Toggles `isFavorite` boolean in `localStorage` and updates `updatedAt`.
- **Expected Backend Implementation:** Updates `is_favorite` boolean field in PostgreSQL and returns updated `KnowledgeItem`.

#### Contract 4: Create Knowledge Item
- **Service Method:** `KnowledgeService.create(data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>)`
- **Endpoint:** `POST /api/v1/knowledge`
- **HTTP Method:** `POST`
- **Request Body (Pydantic Schema):**
  ```json
  {
    "title": "string",
    "type": "NOTE | LINK | PDF | IMAGE | AUDIO | DOCUMENT",
    "summary": "string",
    "content": "string",
    "originalUrl": "string (optional)",
    "fileName": "string (optional)",
    "fileSize": "string (optional)",
    "fileType": "string (optional)",
    "tags": ["string"],
    "collectionId": "string (optional)",
    "isFavorite": false,
    "isArchived": false,
    "keyConcepts": ["string"],
    "relatedKnowledgeIds": ["string"]
  }
  ```
- **Response Type:** `KnowledgeItem`
- **Current Mock Implementation:** Appends new object with generated timestamp and ID to `localStorage`.
- **Expected Backend Implementation:** Validates payload, inserts record into `knowledge` table, creates tag associations in `knowledge_tags`, creates an initial activity log record, and returns populated entity.

#### Contract 5: Update Knowledge Item
- **Service Method:** `KnowledgeService.update(id: string, updates: Partial<KnowledgeItem>)`
- **Endpoint:** `PATCH /api/v1/knowledge/{id}`
- **HTTP Method:** `PATCH`
- **Request Body:** `Partial<KnowledgeItem>`
- **Response Type:** `KnowledgeItem`
- **Current Mock Implementation:** Merges updates with existing item in `localStorage`.
- **Expected Backend Implementation:** Atomic SQL `UPDATE` scoped to `user_id`. Updates modified fields and `updated_at` timestamp.

#### Contract 6: Delete Knowledge Item
- **Service Method:** `KnowledgeService.delete(id: string)`
- **Endpoint:** `DELETE /api/v1/knowledge/{id}`
- **HTTP Method:** `DELETE`
- **Response Type:** `{ "success": boolean }` (or `204 No Content`)
- **Current Mock Implementation:** Filters item out of `localStorage`.
- **Expected Backend Implementation:** Performs cascading delete on `knowledge_tags`, `knowledge_collections`, and associated processing job records for `id` where `user_id == current_user.id`.

#### Contract 7: Get Related Knowledge Items
- **Service Method:** `KnowledgeService.getRelatedItems(item: KnowledgeItem)`
- **Endpoint:** `GET /api/v1/knowledge/{id}/related`
- **HTTP Method:** `GET`
- **Response Type:** `KnowledgeItem[]`
- **Current Mock Implementation:** Filters items sharing collection, tags, or explicit IDs, capped at 4 items.
- **Expected Backend Implementation:** SQL query selecting top 4 items sharing tags or collection, or using pgvector similarity match when enabled.

---

### 3.2 `CollectionService` (`src/services/api/collections.ts`)

#### Contract 1: Get All Collections
- **Service Method:** `CollectionService.getAll()`
- **Endpoint:** `GET /api/v1/collections`
- **HTTP Method:** `GET`
- **Response Type:** `Collection[]`
- **Current Mock Implementation:** Returns collections array from `localStorage`.
- **Expected Backend Implementation:** Queries `collections` table filtered by `user_id`, aggregating item count from `knowledge` table.

#### Contract 2: Create Collection
- **Service Method:** `CollectionService.create(collection: Omit<Collection, 'id' | 'createdAt' | 'itemCount'>)`
- **Endpoint:** `POST /api/v1/collections`
- **HTTP Method:** `POST`
- **Request Body:** `{ "name": string, "description": string, "icon": string, "color": string }`
- **Response Type:** `Collection`
- **Current Mock Implementation:** Creates collection item in `localStorage` with `itemCount: 0`.
- **Expected Backend Implementation:** Inserts row into `collections` table and returns entity.

#### Contract 3: Delete Collection
- **Service Method:** `CollectionService.delete(id: string)`
- **Endpoint:** `DELETE /api/v1/collections/{id}`
- **HTTP Method:** `DELETE`
- **Response Type:** `{ "success": boolean }`
- **Current Mock Implementation:** Removes collection from `localStorage`.
- **Expected Backend Implementation:** Deletes collection record and unsets `collection_id` on associated knowledge items.

---

### 3.3 `TagService` (`src/services/api/tags.ts`)

#### Contract 1: Get All Tags
- **Service Method:** `TagService.getAll()`
- **Endpoint:** `GET /api/v1/tags`
- **HTTP Method:** `GET`
- **Response Type:** `Tag[]`
- **Current Mock Implementation:** Returns tags from `localStorage`.
- **Expected Backend Implementation:** SQL query aggregating tags and usage counts for authenticated user.

#### Contract 2: Ensure Tag Exists / Create Tag
- **Service Method:** `TagService.ensureTagExists(name: string)`
- **Endpoint:** `POST /api/v1/tags`
- **HTTP Method:** `POST`
- **Request Body:** `{ "name": string, "color"?: string }`
- **Response Type:** `Tag`
- **Current Mock Implementation:** Sanitizes tag name, checks `localStorage`, creates tag with random color if missing.
- **Expected Backend Implementation:** Performs atomic `UPSERT` on `tags` table scoped to `user_id`.

---

### 3.4 `FileService` (`src/services/api/files.ts`)

#### Contract 1: Upload and Process File
- **Service Method:** `FileService.uploadAndProcessFile(file: File, collectionId?: string, tags?: string[], onProgress?: Callback)`
- **Endpoint:** `POST /api/v1/files/upload`
- **HTTP Method:** `POST`
- **Request Type:** `multipart/form-data`
  - `file`: Binary file stream
  - `collection_id`: string (optional)
  - `tags`: comma-separated string or array (optional)
- **Response Type:** `KnowledgeItem`
- **Current Mock Implementation:** Simulates upload and text extraction with `setTimeout` delays (25%, 60%, 85%, 100%), generating fake summaries and inserting item into `localStorage`.
- **Expected Backend Implementation:**
  1. Validates MIME type, file extension, and file size limits (< 50MB).
  2. Generates safe unique storage key (e.g. `UUIDv4 + extension`).
  3. Writes file payload to local file storage / S3 object storage.
  4. Inserts DB record into `knowledge` with `processing_status = 'PENDING'`.
  5. Triggers synchronous or worker pipeline (PDF text extraction, DOCX parsing, Image metadata/OCR, Audio transcription).
  6. Updates job status to `COMPLETED` and populates `content`, `summary`, and `key_concepts`.

---

### 3.5 `AIService` (`src/services/api/ai.ts`)

#### Contract 1: Summarize Content
- **Service Method:** `AIService.summarizeContent(content: string, title?: string)`
- **Endpoint:** `POST /api/v1/ai/summarize`
- **HTTP Method:** `POST`
- **Request Body:** `{ "content": string, "title"?: string }`
- **Response Type:** `{ "summary": string }`
- **Current Mock Implementation:** Evaluates word count and returns hardcoded summary text after 800ms delay.
- **Expected Backend Implementation:** Calls backend AI pipeline abstraction (e.g., OpenAI / Gemini / local LLM driver) to generate summary.

#### Contract 2: Extract Key Concepts
- **Service Method:** `AIService.extractKeyConcepts(content: string)`
- **Endpoint:** `POST /api/v1/ai/extract-key-concepts`
- **HTTP Method:** `POST`
- **Request Body:** `{ "content": string }`
- **Response Type:** `{ "keyConcepts": string[] }`
- **Current Mock Implementation:** Returns fixed 5 architecture topics after 600ms delay.
- **Expected Backend Implementation:** Prompt-engineered concept extraction returning JSON array of strings.

#### Contract 3: Generate Suggested Tags
- **Service Method:** `AIService.generateSuggestedTags(content: string, title: string)`
- **Endpoint:** `POST /api/v1/ai/suggest-tags`
- **HTTP Method:** `POST`
- **Request Body:** `{ "content": string, "title": string }`
- **Response Type:** `{ "tags": string[] }`
- **Current Mock Implementation:** Naive string keyword inclusion checks.
- **Expected Backend Implementation:** Categorization engine returning recommended tags.

#### Contract 4: Assistant Q&A Chat
- **Service Method:** `AIService.askAssistant(query: string, activeKnowledge?: KnowledgeItem | null)`
- **Endpoint:** `POST /api/v1/ai/chat`
- **HTTP Method:** `POST`
- **Request Body:** `{ "query": string, "knowledgeId"?: string }`
- **Response Type:** `{ "answer": string }`
- **Current Mock Implementation:** Regex keyword matching on predefined topics ("jwt", "react", "docker").
- **Expected Backend Implementation:** Contextual RAG / Knowledge retrieval agent answering questions about user's knowledge base.

---

### 3.6 Authentication Services (New Infrastructure - Phase 6 Requirement)

To transition from demo state to multi-tenant production, authentication contracts will be added:

#### Contract 1: User Registration
- **Endpoint:** `POST /api/v1/auth/register`
- **Request Body:** `{ "email": string, "password": string, "name": string }`
- **Response Type:** `{ "user": UserProfile, "accessToken": string, "tokenType": "bearer" }`

#### Contract 2: User Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body:** `{ "username": string (email), "password": string }` (OAuth2PasswordRequestForm compatible)
- **Response Type:** `{ "access_token": string, "token_type": "bearer", "user": UserProfile }`

#### Contract 3: Get Current User Profile
- **Endpoint:** `GET /api/v1/auth/me`
- **Header:** `Authorization: Bearer <token>`
- **Response Type:** `UserProfile`

---

## 4. Gap Analysis & Architecture Transition Strategy

### Summary of Key Architecture Gaps:

1. **State Isolation & Security Gap:** Currently, all data lives in `localStorage` without authorization boundaries. The FastAPI backend must enforce server-side user isolation (`user_id` predicate on all database queries).
2. **Asynchronous File Processing Gap:** File uploads are currently simulated with client-side timers. The backend requires a real document text extractor (`pypdf`, `python-docx`, etc.) and a processing job queue standard.
3. **Full-Text & Vector Search Gap:** The frontend performs client-side string filtering. The backend will implement PostgreSQL `ILIKE` keyword search indexed via `trgm` / `tsvector`, and lay the groundwork for `pgvector` semantic search.
4. **Decoupled API Client Layer:** The existing service classes (`KnowledgeService`, `CollectionService`, `TagService`, `FileService`, `AIService`) in `src/services/api/` act as an ideal boundary. We will maintain these signature contracts and update their interior implementations from `localStorage` to standard `fetch` API calls connecting to `NEXT_PUBLIC_API_URL`.

---

## 5. Next Steps Plan

With the repository audit and technical gap report complete, backend implementation can begin systematically following the designated roadmap:

1. **Scaffold Python FastAPI Modular Monolith Structure** (`backend/app/...`)
2. **Configure PostgreSQL Connection & SQLAlchemy ORM Models** (`users`, `knowledge`, `tags`, `knowledge_tags`, `collections`, `processing_jobs`)
3. **Initialize Alembic Migrations**
4. **Implement JWT Authentication & User Isolation Middleware**
5. **Build Core Knowledge CRUD & Search Endpoints**
6. **Connect Frontend Service Layer to FastAPI Endpoints**
