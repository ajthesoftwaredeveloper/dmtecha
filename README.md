# AI-Powered Knowledge Base with RAG Pipeline

A production-ready, high-performance, and feature-rich AI-Powered Knowledge Base monorepo featuring a complete Retrieval-Augmented Generation (RAG) pipeline. Built with Turborepo, Next.js, NestJS, and Supabase (PostgreSQL + `pgvector`).

---

## 🎥 Loom Walkthrough
*   **Walkthrough Recording:** *[Insert Loom Link Here]*

---

## 🚀 Key Features Implemented & Optimized

1.  **Monorepo DX**: Streamlined Turborepo pipelines (`build`, `dev`, `lint`, `typecheck`) with pnpm workspaces. A single command (`pnpm setup`) installs all dependencies and builds workspace packages in topological order.
2.  **Strict Security & Multi-Tenant Data Isolation**: Row-Level Security (RLS) is fully enabled on Supabase. Frontend operations are scoped strictly using the user's Supabase JWT token. Server-side writes (like embedding chunk inserts) bypass RLS using the admin `service_role` client to prevent unauthorized write-access to embeddings.
3.  **Intelligent RAG Pipeline**:
    *   **Chunking Strategy**: Splitting documents by paragraph or sentence boundaries first, falling back to word limits, with configurable chunk size (1000 characters) and overlap (200 characters).
    *   **Decoupled AI Abstraction**: Completely independent configurations for Chat Completions and Embeddings via `.env`, allowing hybrid models (e.g., Groq for lightning-fast completions + Together AI or OpenAI for embeddings).
4.  **Real-Time AI Response Streaming**: Implemented Server-Sent Events (SSE) streaming (`POST /chat/stream`) yielding instant token-by-token rendering.
5.  **Interactive Conversation Sidebar**: Full conversation management in the UI with a persistent sidebar loaded from the database, allowing users to restore past sessions or delete chats.
6.  **PDF & TXT File Uploads**: Drag-and-drop document upload interface with background text extraction (`pdf-parse`) and RAG indexing.
7.  **Token Footprint & Cost Metrics**: Advanced usage metrics page mapping prompt tokens, completion tokens, message count, and estimated cost saving.

---

## 🛠️ Setup & Local Running Instructions

### Prerequisites
*   **Node.js**: `v20` (pinned via `.nvmrc`)
*   **pnpm**: `^9.x`
*   **Supabase Database**: A PostgreSQL database with the `pgvector` and `uuid-ossp` extensions enabled.

### 1. Database Migration Setup
Run the migrations in order against your Supabase database (either via Supabase CLI or using the SQL Editor):
1.  `apps/api/supabase/migrations/00001_initial_schema.sql` (Creates profiles, documents, chunks, conversations, messages, GIN index on tags, and `match_document_chunks` RPC).
2.  `apps/api/supabase/migrations/00002_rls_policies.sql` (Enables and secures RLS policies).
3.  `apps/api/supabase/migrations/00003_change_vector_dimension_to_2048.sql` (Drops the 1536 HNSW index and configures vector dimension to `2048` to support larger embedding models).
4.  `apps/api/supabase/migrations/00004_add_token_tracking.sql` (Adds `prompt_tokens` and `completion_tokens` fields to the `messages` table).

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Frontend Supabase (Prefix required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Provider Configuration (openai | groq | together | openrouter | ollama)
AI_PROVIDER=openrouter
AI_API_KEY=your-provider-api-key
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openai/gpt-4o-mini # Chat model

# Decoupled Embedding Config (Optional: falls back to AI_PROVIDER/AI_API_KEY if omitted)
AI_EMBEDDING_PROVIDER=openrouter
AI_EMBEDDING_API_KEY=your-provider-api-key
AI_EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
AI_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free # Outputs 2048-dim vectors

# App Server Port Configuration
NEXT_PUBLIC_API_URL=http://localhost:4000
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

### 3. Run the Monorepo
```bash
# Install dependencies & build packages
pnpm setup

# Run dev servers in parallel (Next.js on :3000, NestJS on :4000)
pnpm dev
```

---

## 📐 Architectural Decisions & Tech Justifications

### Monorepo Structure
*   **Turborepo**: Enables caching of builds and tasks. If shared types haven't changed, builds are skipped, cutting compilation times.
*   **Shared Packages**: Domain-driven typing (`@dmtecha/shared-types`) ensures compile-time synchronization of API request/response payloads, and common helpers live in `@dmtecha/utils`.

### Database Schema Design
*   **Multi-tenant Isolation**: RLS policies restrict all documents, conversations, and messages queries to the authenticated user (`auth.uid() = user_id`).
*   **Service Role for Vector Chunking**: Users should never have direct write permission on `document_chunks`. Chunks are written server-side via the admin client (`service_role`) to prevent embedding tampering.
*   **GIN Indexing**: Tag filtering queries run efficiently using a GIN index on the `tags` array column.

### RAG Strategy
*   **Flat Vector Similarity (Cosine Similarity)**: In `00003_change_vector_dimension_to_2048.sql`, we transitioned the embedding column to 2048 dimensions to support next-gen dense embedding models. Since `pgvector` limits index creation to $\le 2000$ dimensions, similarity queries perform a flat scan. Flat scans provide 100% accuracy and execute in milliseconds for typical knowledge bases.
*   **Paragraph-Sentence Boundary Split**: Instead of arbitrary character splits which sever contexts, `ChunkingService` splits text on double newlines or punctuation (`.`, `!`, `?`), ensuring chunks preserve complete semantic phrases.

---

## 🎛️ Swapping AI Providers Guide

The AI client relies on the universal **OpenAI Node SDK**. You can swap models, completions providers, or embedding generators purely via the `.env` configuration.

### Provider Details:
1.  **OpenAI**:
    ```bash
    AI_PROVIDER=openai
    AI_API_KEY=sk-...
    AI_MODEL=gpt-4o-mini
    AI_EMBEDDING_MODEL=text-embedding-3-small # Note: outputs 1536-dim vectors. Alter database table to vector(1536) if using.
    ```
2.  **OpenRouter** (For serverless access to free models):
    ```bash
    AI_PROVIDER=openrouter
    AI_BASE_URL=https://openrouter.ai/api/v1
    AI_MODEL=openai/gpt-4o-mini
    AI_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free # Outputs 2048-dim vectors
    ```
3.  **Groq** (Completions) + **Together** (Embeddings) - Hybrid Approach:
    ```bash
    # Chat completions via Groq
    AI_PROVIDER=groq
    AI_API_KEY=gsk_...
    AI_MODEL=llama-3.3-70b-versatile

    # Embeddings via Together AI
    AI_EMBEDDING_PROVIDER=together
    AI_EMBEDDING_API_KEY=together_...
    AI_EMBEDDING_MODEL=togethercomputer/m2-bert-80m-8k-retrieval # Verify output dimension
    ```
4.  **Local Ollama**:
    ```bash
    AI_PROVIDER=ollama
    AI_API_KEY=ollama
    AI_BASE_URL=http://localhost:11434/v1
    AI_MODEL=llama3
    AI_EMBEDDING_MODEL=nomic-embed-text
    ```

---

## 📈 Future Optimizations & Scale Path

With more time, the following improvements would prepare the platform for enterprise-scale usage:

1.  **Hybrid Search (Sparse + Dense)**: Combine pgvector similarity search with full-text search (`tsvector` and `tsquery`) to match exact keyword queries while retaining semantic context.
2.  **Rerankers (Cross-Encoder Models)**: Use a reranker model (such as Cohere or BGE-Reranker) on the top 10 retrieved chunks to re-order and narrow down to the most relevant 3-5 chunks before injecting them into the LLM prompt.
3.  **Chunk Hierarchy & Parent-Child Retrieval**: Instead of storing and retrieving huge chunks, chunk the document into small pieces (e.g., 200 chars) for embedding lookup, but retrieve the larger parent paragraph (e.g., 1000 chars) as context to provide better background details for the LLM.
4.  **Redis Context Caching**: Cache similarity search results and chat session history in Redis to avoid querying PostgreSQL database tables repeatedly for identical user queries.
