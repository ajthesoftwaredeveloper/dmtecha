# AI-Powered Knowledge Base

A full-stack AI-powered knowledge base with RAG (Retrieval-Augmented Generation) capabilities.

## Tech Stack

- **Monorepo:** Turborepo + pnpm
- **Frontend:** Next.js 14+ (App Router)
- **Backend:** NestJS 10+
- **Database:** Supabase (PostgreSQL + pgvector)
- **AI:** OpenAI SDK (provider-agnostic)

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Setup

```bash
# Install dependencies
pnpm setup

# Copy environment variables
cp .env.example .env

# Start development servers
pnpm dev
```

### Available Scripts

| Script              | Description                        |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | Start all apps in development mode |
| `pnpm build`        | Build all apps and packages        |
| `pnpm lint`         | Lint all apps and packages         |
| `pnpm format`       | Format all files with Prettier     |
| `pnpm format:check` | Check formatting                   |
| `pnpm typecheck`    | Run TypeScript type checking       |
| `pnpm clean`        | Clean all build artifacts          |

### Project Structure

```
├── apps/
│   ├── web/          # Next.js frontend (:3000)
│   └── api/          # NestJS backend  (:4000)
├── packages/
│   ├── eslint-config/    # Shared ESLint configs
│   ├── prettier-config/  # Shared Prettier config
│   ├── shared-types/     # Shared TypeScript types
│   └── utils/            # Shared utilities
├── turbo.json
└── package.json
```

## License

MIT

## Swapping AI Providers

The AI integration is provider-agnostic and uses the OpenAI SDK as a unified client. You can swap providers by changing `.env` variables without changing any code.

### Supported Providers:

- **OpenAI**: Set `AI_PROVIDER=openai`, provide `AI_API_KEY`, and set standard models (e.g. `gpt-4o-mini` and `text-embedding-3-small`).
- **OpenRouter**: Set `AI_PROVIDER=openrouter`, provide `AI_API_KEY`, and set prefixed model names:
  - `AI_MODEL=openrouter/free` (or a specific free/paid model slug like `meta-llama/llama-3.3-70b-instruct:free`).
  - `AI_EMBEDDING_MODEL=openai/text-embedding-3-small` (or another model that produces **1536**-dimensional embeddings to match the database schema constraints).
- **Groq**: Set `AI_PROVIDER=groq`, `AI_API_KEY`, and model.
- **Together AI**: Set `AI_PROVIDER=together`, `AI_API_KEY`, and model.
- **Ollama (Local)**: Set `AI_PROVIDER=ollama`, keep `AI_API_KEY` blank, and set models (ensure your local Ollama is running and has the models pulled).

> [!IMPORTANT]
> **Database Vector Size Constraint:**
> The database schema enforces a vector size of exactly **1536** for document chunks. When choosing an embedding model from any provider, verify it outputs 1536-dimensional vectors (such as `text-embedding-3-small`), otherwise chunk inserts will fail.
