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

| Script | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Clean all build artifacts |

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
