import { z } from 'zod';

export const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // AI Provider
  AI_PROVIDER: z.enum(['openai', 'groq', 'together', 'openrouter', 'ollama']).default('openai'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_FALLBACK_MODEL: z.string().optional(),
  AI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  
  // Optional override for Embeddings provider
  AI_EMBEDDING_PROVIDER: z.enum(['openai', 'groq', 'together', 'openrouter', 'ollama']).optional(),
  AI_EMBEDDING_API_KEY: z.string().optional(),
  AI_EMBEDDING_BASE_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),

  // App
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}
