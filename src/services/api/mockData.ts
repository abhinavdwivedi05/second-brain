import { KnowledgeItem, Collection, Tag, UserProfile, ActivityLog } from '@/types';

export const INITIAL_USER: UserProfile = {
  id: 'user-001',
  name: 'Abhinav',
  email: 'abhinav@secondbrain.ai',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  role: 'Senior Product Engineer',
  storageUsedBytes: 142857000, // ~142 MB
  storageLimitBytes: 10737418240, // 10 GB
  aiCreditsRemaining: 840,
  aiCreditsTotal: 1000,
};

export const INITIAL_COLLECTIONS: Collection[] = [
  {
    id: 'col-web-dev',
    name: 'Web Development',
    description: 'Frontend frameworks, React patterns, CSS architectures, and Web APIs',
    icon: 'Code2',
    color: '#3B82F6', // blue
    itemCount: 4,
    createdAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'col-backend',
    name: 'Backend & Systems',
    description: 'Distributed systems, database design, API security, and server logic',
    icon: 'Server',
    color: '#10B981', // emerald
    itemCount: 3,
    createdAt: '2026-08-05T14:30:00Z',
  },
  {
    id: 'col-cloud',
    name: 'Cloud & Infrastructure',
    description: 'AWS services, Docker containers, Kubernetes, and CI/CD pipelines',
    icon: 'Cloud',
    color: '#8B5CF6', // purple
    itemCount: 2,
    createdAt: '2026-08-10T09:15:00Z',
  },
  {
    id: 'col-interview',
    name: 'Interview Prep',
    description: 'Data structures, algorithms, system design questions, and mock answers',
    icon: 'GraduationCap',
    color: '#F59E0B', // amber
    itemCount: 2,
    createdAt: '2026-08-15T16:00:00Z',
  },
  {
    id: 'col-ai',
    name: 'AI & Machine Learning',
    description: 'Vector databases, RAG architecture, LLM prompt engineering, and embeddings',
    icon: 'Brain',
    color: '#EC4899', // pink
    itemCount: 2,
    createdAt: '2026-09-01T11:20:00Z',
  },
];

export const INITIAL_TAGS: Tag[] = [
  { id: 'tag-react', name: 'react', color: '#61DAFB', itemCount: 3 },
  { id: 'tag-jwt', name: 'jwt', color: '#000000', itemCount: 2 },
  { id: 'tag-security', name: 'security', color: '#EF4444', itemCount: 2 },
  { id: 'tag-backend', name: 'backend', color: '#10B981', itemCount: 4 },
  { id: 'tag-docker', name: 'docker', color: '#2496ED', itemCount: 2 },
  { id: 'tag-aws', name: 'aws', color: '#FF9900', itemCount: 2 },
  { id: 'tag-dsa', name: 'dsa', color: '#8B5CF6', itemCount: 1 },
  { id: 'tag-python', name: 'python', color: '#3776AB', itemCount: 2 },
  { id: 'tag-system-design', name: 'system-design', color: '#F59E0B', itemCount: 2 },
  { id: 'tag-ai', name: 'ai', color: '#EC4899', itemCount: 2 },
];

export const INITIAL_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: 'k-001',
    title: 'React Server Components (RSC) Architecture & Hydration Model',
    type: 'NOTE',
    summary: 'Comprehensive breakdown of React Server Components, server execution boundaries, zero-bundle-size components, and streaming HTML with Suspense.',
    content: `# React Server Components Architecture & Hydration Model

React Server Components (RSC) represent a fundamental paradigm shift in how React applications are rendered and delivered.

## Key Differences from Client Components
1. **Zero Bundle Impact**: RSC run exclusively on the server and are never sent to the client bundle.
2. **Direct Backend Access**: RSC can directly query databases, access file systems, and read internal microservice APIs without exposing credentials.
3. **Automatic Code Splitting**: Client components imported by Server Components are automatically code-split into optimal dynamic chunks.

## The Hydration Pipeline
- Server executes the component tree and serializes it into a streamable JSON-like format (RSC Payload).
- HTML shell is sent immediately to the browser for fast FCP (First Contentful Paint).
- React client reconciles the RSC payload with the DOM tree and hydrates interactive Client Components.

\`\`\`tsx
// Example Server Component fetching data directly
import { db } from '@/lib/db';

export default async function UserProfileCard({ userId }: { userId: string }) {
  const user = await db.user.findUnique({ where: { id: userId } });
  
  return (
    <div className="p-4 rounded-lg bg-surface border border-border">
      <h3 className="font-semibold text-foreground">{user.name}</h3>
      <p className="text-sm text-muted">{user.email}</p>
    </div>
  );
}
\`\`\`

## Best Practices
- Keep Client Components at the leaves of your component tree.
- Pass server data to Client Components as props or serializable state.
- Use \`useActionState\` or Server Actions for form submissions.`,
    tags: ['react', 'nextjs', 'frontend'],
    collectionId: 'col-web-dev',
    collectionName: 'Web Development',
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-09-25T14:20:00Z',
    updatedAt: '2026-09-25T16:45:00Z',
    lastAccessedAt: '2026-09-26T11:10:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Zero-bundle-size components',
      'RSC Payload serialization',
      'Progressive streaming hydration',
      'Client boundary isolation',
      'Server Actions mutation',
    ],
    relatedKnowledgeIds: ['k-005', 'k-010'],
    aiInsights: [
      'This note highlights how RSC reduces client JS bundle size by up to 60% compared to traditional SPA setups.',
      'Pairs closely with your note on Clean Architecture Principles in React.',
    ],
  },
  {
    id: 'k-002',
    title: 'JWT Authentication & Secure Token Revocation Standard',
    type: 'PDF',
    summary: 'A 18-page whitepaper detailing JSON Web Token security considerations, short-lived access tokens, refresh token rotation, and Redis blacklist mechanisms.',
    content: `# JWT Authentication & Secure Token Revocation Standard

## Executive Overview
JSON Web Tokens (JWT) provide a stateless, compact mechanism for transmitting cryptographic claims between parties. However, statelessness introduces challenges for immediate session invalidation.

## Recommended Architecture
- **Short-Lived Access Token**: Expiry = 15 minutes. Stored in memory or short-lived cookie.
- **Long-Lived Refresh Token**: Expiry = 7 days. Stored in \`HttpOnly\`, \`SameSite=Strict\`, \`Secure\` cookie.
- **Refresh Token Rotation**: Every call to \`/auth/refresh\` returns a NEW refresh token and invalidates the previous token family.

## Storage Security Comparison
| Mechanism | XSS Protection | CSRF Protection | Auto-Sent |
| :--- | :--- | :--- | :--- |
| LocalStorage | ❌ Vulnerable | ✅ Immune | No |
| SessionStorage | ❌ Vulnerable | ✅ Immune | No |
| HttpOnly Cookie | ✅ Protected | ⚠️ Needs CSRF Token | Yes |

## Redis Token Blacklist Pattern
When a user logs out or changes password:
1. Extract \`jti\` (JWT ID claim) from current token.
2. Push \`jti\` into Redis key space with TTL equal to the token's remaining lifespan.
3. API Gateway checks Redis bloom filter / cache on protected routes.`,
    fileName: 'jwt-security-standards-2026.pdf',
    fileSize: '2.4 MB',
    fileType: 'application/pdf',
    tags: ['jwt', 'security', 'backend'],
    collectionId: 'col-backend',
    collectionName: 'Backend & Systems',
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-09-24T09:15:00Z',
    updatedAt: '2026-09-24T09:15:00Z',
    lastAccessedAt: '2026-09-26T08:30:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Short-lived Access Tokens (15m)',
      'HttpOnly SameSite Cookies',
      'Refresh Token Family Rotation',
      'Redis JTI Blacklisting',
      'HMAC-SHA256 vs RS256 signing',
    ],
    relatedKnowledgeIds: ['k-005', 'k-003'],
    aiInsights: [
      'Essential reference for securing auth flows in your FastAPI microservices.',
      'Recommends RS256 asymmetric signing over HS256 for multi-service microservices.',
    ],
  },
  {
    id: 'k-003',
    title: 'Docker Container Networking & Overlay Bridge Drivers',
    type: 'LINK',
    summary: 'Deep dive into Docker network drivers: bridge, host, overlay, macvlan, and custom subnet routing across multi-host environments.',
    originalUrl: 'https://docs.docker.com/network/drivers/',
    content: `# Docker Container Networking & Overlay Bridge Drivers

Docker provides pluggable network drivers allowing isolated network namespaces for containers.

## Network Drivers Overview
- **Bridge Driver**: Default for standalone containers. Creates a virtual ethernet bridge (\`docker0\`) on host machine.
- **Host Driver**: Removes network isolation between container and host machine. Uses host's network stack directly.
- **Overlay Driver**: Enables container-to-container communication across multiple Swarm/Kubernetes physical nodes without host-level routing.
- **Macvlan Driver**: Assigns a MAC address to a container, making it appear as a physical device on your network.

## Commands Reference
\`\`\`bash
# Create custom isolated bridge network
docker network create --driver bridge --subnet 172.28.0.0/16 my_isolated_net

# Inspect container network namespace
docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' my_container
\`\`\`

## Security Rules
- Never expose database containers on host ports directly.
- Connect API service and DB service via private Docker bridge networks.`,
    tags: ['docker', 'devops', 'backend'],
    collectionId: 'col-cloud',
    collectionName: 'Cloud & Infrastructure',
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-09-22T11:40:00Z',
    updatedAt: '2026-09-22T11:40:00Z',
    lastAccessedAt: '2026-09-25T15:10:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Bridge network isolation',
      'Multi-host Overlay VXLAN encapsulation',
      'DNS alias resolution inside Docker networks',
      'Virtual Ethernet pairs (veth)',
    ],
    relatedKnowledgeIds: ['k-004', 'k-002'],
    aiInsights: [
      'Useful for setting up containerized microservices in production.',
      'Explains why multi-container setups should use private subnets.',
    ],
  },
  {
    id: 'k-004',
    title: 'AWS EC2 vs Serverless Infrastructure Cost & Latency Benchmark',
    type: 'DOCUMENT',
    summary: 'Comparative analysis of running containerized workloads on EC2 Auto-Scaling Groups vs AWS Fargate and Lambda for variable traffic patterns.',
    content: `# AWS EC2 vs Serverless Infrastructure Cost & Latency Benchmark

## Executive Summary
This document analyzes total cost of ownership (TCO) and cold start latencies across three primary AWS compute architectures over a 12-month period with variable peak traffic.

## Architectural Trade-offs
### 1. Amazon EC2 (t4g.medium Reserved Instances)
- **Cost**: Predictable flat rate (~$22/month per instance).
- **Pros**: Low latency, full kernel access, custom storage.
- **Cons**: Over-provisioned during idle periods; requires manual AMI patching and scaling policy tuning.

### 2. AWS Fargate (Serverless Containers)
- **Cost**: Pay per vCPU-second and GB-second.
- **Pros**: Zero cluster maintenance, rapid scaling from 2 to 50 tasks in 90 seconds.
- **Cons**: 15-25% higher cost per unit compute than reserved EC2 instances under steady 24/7 load.

### 3. AWS Lambda (Function as a Service)
- **Cost**: $0 at zero traffic; $0.0000166667 per GB-second.
- **Pros**: Instant scale to 1,000 concurrency.
- **Cons**: Cold starts (300ms - 1.2s for Python/Java), 15-minute execution limit.

## Verdict & Recommendation
Use **Fargate** for API endpoints with unpredictable spikes, and **EC2 ARM64 (Graviton3)** for core steady-state backend services.`,
    fileName: 'aws-compute-benchmark-2026.docx',
    fileSize: '1.8 MB',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    tags: ['aws', 'cloud', 'system-design'],
    collectionId: 'col-cloud',
    collectionName: 'Cloud & Infrastructure',
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-09-20T16:10:00Z',
    updatedAt: '2026-09-20T16:10:00Z',
    lastAccessedAt: '2026-09-26T09:45:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Graviton3 ARM64 cost efficiency',
      'AWS Fargate task provisioning time',
      'Lambda cold start mitigation',
      'Traffic pattern TCO calculation',
    ],
    relatedKnowledgeIds: ['k-003', 'k-005'],
    aiInsights: [
      'Highlights Graviton3 instances delivering 40% better price performance than x86.',
    ],
  },
  {
    id: 'k-005',
    title: 'System Design: Distributed Rate Limiter using Redis & Leaky Bucket',
    type: 'NOTE',
    summary: 'Architectural blueprint for building a distributed rate limiting middleware supporting Token Bucket, Sliding Window Counter, and Redis Lua scripts.',
    content: `# System Design: Distributed Rate Limiter using Redis & Leaky Bucket

## Requirements & Scale
- **Scale**: 500,000 Requests Per Minute across 50 API nodes.
- **Latency Budget**: < 3ms per rate check.
- **Accuracy**: Strict per-user limits with burst allowance.

## Algorithms Evaluated
1. **Fixed Window Counter**: Memory efficient, but allows 2x traffic bursts at window boundaries.
2. **Sliding Window Log**: Highly accurate, but high memory footprint (stores timestamp for every request).
3. **Sliding Window Counter**: Hybrid approach combining current and previous window counts. Extremely efficient.
4. **Token Bucket with Redis Lua Script**: Best for allowing controlled bursts while enforcing steady rates.

## Redis Lua Script implementation
\`\`\`lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('get', key) or "0")

if current + 1 > limit then
    return 0 -- Rejected
else
    redis.call("INCRBY", key, 1)
    if current == 0 then
        redis.call("EXPIRE", key, 60)
    end
    return 1 -- Allowed
end
\`\`\`

## High Availability & Fallback Strategy
If Redis cluster experiences failover:
- Degrade gracefully to local in-memory rate limiting per node.
- Log warning metrics to Datadog without blocking HTTP client requests.`,
    tags: ['system-design', 'backend', 'redis'],
    collectionId: 'col-interview',
    collectionName: 'Interview Prep',
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-09-18T14:30:00Z',
    updatedAt: '2026-09-18T14:30:00Z',
    lastAccessedAt: '2026-09-26T10:15:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Token Bucket vs Sliding Window Counter',
      'Redis Atomic Lua Execution',
      'Graceful degradation under Redis failure',
      'Multi-tenant rate limits',
    ],
    relatedKnowledgeIds: ['k-002', 'k-007'],
    aiInsights: [
      'Top choice for backend system design interviews.',
      'Explains why Lua scripts prevent race conditions in multi-threaded microservices.',
    ],
  },
  {
    id: 'k-006',
    title: 'Python Asyncio Internals, Tasks, and Custom Event Loops',
    type: 'DOCUMENT',
    summary: 'Deep dive into Python GIL non-blocking I/O, coroutines, generators, Future objects, and uvloop execution performance.',
    content: `# Python Asyncio Internals, Tasks, and Custom Event Loops

Python's \`asyncio\` library enables concurrent code execution using the \`async\`/\`await\` syntax built on top of cooperative multitasking.

## Core Components
- **Event Loop**: The central loop running tasks, managing I/O events (epoll/kqueue), and dispatching callbacks.
- **Coroutines**: Functions defined with \`async def\` that can pause execution via \`await\`.
- **Tasks**: Wrappers for coroutines scheduled on the event loop.
- **Futures**: Objects representing an eventual result of an asynchronous operation.

\`\`\`python
import asyncio
import time

async def fetch_data(item_id: int):
    print(f"Start fetching {item_id}")
    await asyncio.sleep(1)  # Non-blocking yield to event loop
    print(f"Finished fetching {item_id}")
    return {"id": item_id, "status": "ok"}

async def main():
    results = await asyncio.gather(*[fetch_data(i) for i in range(5)])
    print(results)

asyncio.run(main())
\`\`\`

## High Performance with \`uvloop\`
Replacing Python's default event loop with \`uvloop\` (built on \`libuv\`, the C library powering Node.js) increases throughput by up to 2x-4x in FastAPI applications.`,
    fileName: 'python-asyncio-deep-dive.docx',
    fileSize: '1.2 MB',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    tags: ['python', 'backend'],
    collectionId: 'col-backend',
    collectionName: 'Backend & Systems',
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-09-15T18:20:00Z',
    updatedAt: '2026-09-15T18:20:00Z',
    lastAccessedAt: '2026-09-24T12:00:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Cooperative multitasking vs Threads',
      'epoll/kqueue system calls',
      'uvloop C-bindings performance',
      'asyncio.gather vs TaskGroup',
    ],
    relatedKnowledgeIds: ['k-005'],
    aiInsights: [
      'Directly applicable to FastAPI backend optimization.',
    ],
  },
  {
    id: 'k-007',
    title: 'DSA Patterns: Two Pointers & Sliding Window Master Guide',
    type: 'NOTE',
    summary: 'Comprehensive pattern guide for solving contiguous subarray, string manipulation, and window optimization problems in O(N) time.',
    content: `# DSA Patterns: Two Pointers & Sliding Window Master Guide

## When to use Sliding Window
Use sliding window when asked to find the **maximum, minimum, or target property** of a **contiguous array or string**.

## 1. Fixed Window Size (e.g. Max Sum Subarray of Size K)
- Maintain a window sum.
- Add element entering from right; subtract element leaving from left.

\`\`\`typescript
function maxSubarraySum(arr: number[], k: number): number {
  let maxSum = 0, windowSum = 0;
  for (let i = 0; i < arr.length; i++) {
    windowSum += arr[i];
    if (i >= k - 1) {
      maxSum = Math.max(maxSum, windowSum);
      windowSum -= arr[i - (k - 1)];
    }
  }
  return maxSum;
}
\`\`\`

## 2. Dynamic Window Size (e.g. Longest Substring Without Repeating Characters)
- Expand right boundary (\`right++\`) until condition becomes invalid.
- Shrink left boundary (\`left++\`) until condition becomes valid again.
- Record maximum window length (\`right - left + 1\`).

## Complexity Benchmark
- **Brute Force**: O(N²) time, O(1) space.
- **Sliding Window**: O(N) time, O(min(N, K)) space with HashMap.`,
    tags: ['dsa', 'algorithms', 'python'],
    collectionId: 'col-interview',
    collectionName: 'Interview Prep',
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-09-12T10:00:00Z',
    updatedAt: '2026-09-12T10:00:00Z',
    lastAccessedAt: '2026-09-25T09:10:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Fixed window expansion/shrinkage',
      'Dynamic boundary sliding pointer',
      'HashMap auxiliary frequency tracker',
      'Time complexity reduction from O(N²) to O(N)',
    ],
    relatedKnowledgeIds: ['k-005'],
    aiInsights: [
      'High priority pattern for coding interviews.',
    ],
  },
  {
    id: 'k-008',
    title: 'Voice Note: Second Brain AI Search & Graph Visualization Strategy',
    type: 'AUDIO',
    summary: 'Audio transcript discussing the roadmap for local vector search, hybrid keyword BM25 + cosine similarity search, and interactive node graph UI.',
    content: `# Voice Note: Second Brain AI Search & Graph Visualization Strategy

**Audio Transcript:**
"Hey Abhinav, recording a quick thought on our Second Brain product strategy.

First, users don't want another rigid folder structure. They want hybrid search. When they type a query like 'JWT refresh tokens', we should run a hybrid search combining sparse BM25 keyword matching with dense vector embedding cosine similarity.

Second, for the related knowledge visualization, let's keep it calm. We shouldn't show a messy 3D network graph that looks like spider webs. Instead, let's show contextual related cards with relationship strength badges like '94% Semantic Match' or 'Shared Collection: Backend'.

Third, local privacy. Ensure all note extractions and embeddings can run locally or via encrypted vector endpoints so sensitive developer notes stay private.

Let's prioritize building the command palette (Cmd+K) next!"`,
    fileName: 'product-strategy-voice-note-sep26.mp3',
    fileSize: '3.6 MB',
    fileType: 'audio/mp3',
    audioDuration: '02:45',
    tags: ['ai', 'product', 'system-design'],
    collectionId: 'col-ai',
    collectionName: 'AI & Machine Learning',
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-09-26T07:15:00Z',
    updatedAt: '2026-09-26T07:15:00Z',
    lastAccessedAt: '2026-09-26T11:45:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Hybrid BM25 + Cosine Similarity Vector Search',
      'Contextual relationship strength matching',
      'Calm UI design vs noisy graph views',
      'Local privacy vector indexing',
    ],
    relatedKnowledgeIds: ['k-009', 'k-001'],
    aiInsights: [
      'Voice transcript parsed with 99.2% accuracy.',
      'Key takeaway: Hybrid search outperforms simple vector similarity for technical terms like JWT and Docker.',
    ],
  },
  {
    id: 'k-009',
    title: 'Vector Database Architecture: pgvector vs Qdrant vs Pinecone',
    type: 'PDF',
    summary: 'Technical evaluation of vector database solutions for RAG applications, comparing HNSW index building, memory usage, latency, and hybrid search capabilities.',
    content: `# Vector Database Architecture: pgvector vs Qdrant vs Pinecone

## Overview
Selecting the right vector database determines the scalability and cost of AI semantic retrieval pipelines.

## Feature Comparison Matrix
| Feature | pgvector (PostgreSQL) | Qdrant | Pinecone |
| :--- | :--- | :--- | :--- |
| Architecture | Extension to Postgres | Standalone Rust engine | Managed Cloud service |
| Index Types | HNSW, IVFFlat | HNSW with Payload filtering | Proprietary dynamic |
| Memory Footprint | Medium | Low (Rust native) | Managed |
| Hybrid Search | Native SQL JOIN + BM25 | Native Sparse-Dense Vectors | Metadata filter only |
| Hostability | Self-hosted or RDS | Self-hosted or Cloud | Fully Managed |

## HNSW Index Tuning (pgvector)
\`\`\`sql
-- Create HNSW index for 1536-dimensional OpenAI embeddings
CREATE INDEX ON knowledge_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
\`\`\`

## Verdict
For Second Brain, **pgvector** is ideal because it keeps metadata, tags, collections, and vector embeddings inside a single PostgreSQL database transactionally!`,
    fileName: 'vector-db-benchmark-2026.pdf',
    fileSize: '3.1 MB',
    fileType: 'application/pdf',
    tags: ['ai', 'security', 'system-design'],
    collectionId: 'col-ai',
    collectionName: 'AI & Machine Learning',
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-09-21T13:10:00Z',
    updatedAt: '2026-09-21T13:10:00Z',
    lastAccessedAt: '2026-09-26T09:00:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'HNSW (Hierarchical Navigable Small World) index',
      'pgvector PostgreSQL transactional consistency',
      'Cosine distance vs L2 distance',
      'Sparse-Dense hybrid embedding vectors',
    ],
    relatedKnowledgeIds: ['k-008', 'k-005'],
    aiInsights: [
      'Confirms pgvector as the optimal single-database choice for FastAPI + PostgreSQL stack.',
    ],
  },
  {
    id: 'k-010',
    title: 'Clean Architecture Principles in React & Next.js Apps',
    type: 'LINK',
    summary: 'Guidelines for separating domain entities, use cases, controller abstractions, and React presentation components to keep codebases scalable.',
    originalUrl: 'https://clean-frontend-architecture.dev/guide',
    content: `# Clean Architecture Principles in React & Next.js Apps

## Core Layers
1. **Domain Layer**: Pure TypeScript entities and business logic validation. Zero UI or React dependencies.
2. **Use Case Layer**: Application logic workflows (e.g. \`CreateKnowledgeItem\`, \`SearchKnowledgeBase\`).
3. **Interface Adapters (API Services)**: API clients, HTTP wrappers, localStorage repositories, and state adapters.
4. **Presentation Layer (React Components)**: Pure UI elements rendering domain state and delegating actions to services.

## Directory Layout Pattern
\`\`\`text
src/
├── domain/            # Core entities & domain rules
├── services/          # API & persistence abstractions
├── hooks/             # Custom React hooks wrapping use cases
├── components/        # Presentational UI components
│   ├── ui/            # Design system primitives
│   ├── layout/        # Shell & navigation
│   └── knowledge/     # Knowledge-specific feature components
└── app/               # Next.js App Router pages
\`\`\`

## Key Takeaway
Never embed raw \`fetch\` calls or direct data manipulation inside JSX files. Pass clean abstractions via hooks or context!`,
    tags: ['react', 'architecture', 'frontend'],
    collectionId: 'col-web-dev',
    collectionName: 'Web Development',
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-09-17T11:00:00Z',
    updatedAt: '2026-09-17T11:00:00Z',
    lastAccessedAt: '2026-09-25T17:30:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: [
      'Domain/Service/Presentation Layer separation',
      'Dependency Inversion Principle in React',
      'Isolated API abstractions',
      'Predictable component state flow',
    ],
    relatedKnowledgeIds: ['k-001'],
    aiInsights: [
      'Matches the exact design principles used in this Second Brain codebase!',
    ],
  },
];

export const INITIAL_ACTIVITIES: ActivityLog[] = [
  {
    id: 'act-001',
    action: 'ACCESSED',
    knowledgeId: 'k-001',
    knowledgeTitle: 'React Server Components Architecture & Hydration Model',
    timestamp: '2026-09-26T11:10:00Z',
    type: 'NOTE',
  },
  {
    id: 'act-002',
    action: 'AI_PROCESSED',
    knowledgeId: 'k-008',
    knowledgeTitle: 'Voice Note: Second Brain AI Search & Graph Visualization Strategy',
    timestamp: '2026-09-26T07:15:00Z',
    type: 'AUDIO',
  },
  {
    id: 'act-003',
    action: 'FAVORITED',
    knowledgeId: 'k-002',
    knowledgeTitle: 'JWT Authentication & Secure Token Revocation Standard',
    timestamp: '2026-09-25T18:40:00Z',
    type: 'PDF',
  },
  {
    id: 'act-004',
    action: 'CREATED',
    knowledgeId: 'k-001',
    knowledgeTitle: 'React Server Components Architecture & Hydration Model',
    timestamp: '2026-09-25T14:20:00Z',
    type: 'NOTE',
  },
  {
    id: 'act-005',
    action: 'UPDATED',
    knowledgeId: 'k-005',
    knowledgeTitle: 'System Design: Distributed Rate Limiter using Redis & Leaky Bucket',
    timestamp: '2026-09-24T15:10:00Z',
    type: 'NOTE',
  },
];
