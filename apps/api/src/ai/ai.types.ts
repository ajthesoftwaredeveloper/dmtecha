/**
 * Provider-agnostic AI service interfaces.
 * Allows switching between OpenAI, Groq, Together, OpenRouter, and Ollama
 * purely via environment variables.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingOptions {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Supported AI providers.
 */
export type AiProvider = 'openai' | 'groq' | 'together' | 'openrouter' | 'ollama';

/**
 * Provider-specific base URLs.
 */
export const PROVIDER_BASE_URLS: Record<AiProvider, string | undefined> = {
  openai: undefined, // Uses OpenAI SDK default
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434/v1',
};
