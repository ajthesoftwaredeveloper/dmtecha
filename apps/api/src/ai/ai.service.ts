import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import type { EnvConfig } from '../config/env.validation';

import {
  PROVIDER_BASE_URLS,
  type AiProvider,
  type ChatCompletionOptions,
  type ChatCompletionResult,
  type EmbeddingOptions,
  type EmbeddingResult,
} from './ai.types';

/**
 * Provider-agnostic AI service.
 *
 * Uses the OpenAI SDK under the hood, which is compatible with all major
 * providers (Groq, Together AI, OpenRouter, Ollama) since they expose
 * OpenAI-compatible endpoints.
 *
 * Switch providers by changing AI_PROVIDER, AI_API_KEY, and optionally
 * AI_BASE_URL in the .env file — zero code changes required.
 */
@Injectable()
export class AiService implements OnModuleInit {
  private client!: OpenAI;
  private defaultModel!: string;
  private defaultEmbeddingModel!: string;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  onModuleInit(): void {
    const provider = this.configService.get('AI_PROVIDER', { infer: true }) as AiProvider;
    const apiKey = this.configService.get('AI_API_KEY', { infer: true }) ?? '';
    const customBaseUrl = this.configService.get('AI_BASE_URL', { infer: true });

    // Resolve base URL: custom override > provider default > OpenAI default
    const baseURL = customBaseUrl ?? PROVIDER_BASE_URLS[provider];

    this.client = new OpenAI({
      apiKey: apiKey || 'ollama', // Ollama doesn't need a real key
      ...(baseURL ? { baseURL } : {}),
    });

    this.defaultModel = this.configService.get('AI_MODEL', { infer: true });
    this.defaultEmbeddingModel = this.configService.get('AI_EMBEDDING_MODEL', { infer: true });

    console.warn(
      `🤖 AI Service initialized: provider=${provider}, model=${this.defaultModel}, embeddings=${this.defaultEmbeddingModel}`,
    );
  }

  /**
   * Generate a chat completion.
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const response = await this.client.chat.completions.create({
      model: options.model ?? this.defaultModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: false,
    });

    const choice = response.choices[0];
    if (!choice?.message?.content) {
      throw new Error('No content in AI response');
    }

    return {
      content: choice.message.content,
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Generate a streaming chat completion.
   * Returns an async iterable of content deltas.
   */
  async *chatCompletionStream(
    options: ChatCompletionOptions,
  ): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: options.model ?? this.defaultModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }

  /**
   * Generate embeddings for one or more text inputs.
   */
  async generateEmbeddings(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: options.model ?? this.defaultEmbeddingModel,
      input: options.input,
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Generate a single embedding vector for a text input.
   * Convenience method for single-text use cases.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const result = await this.generateEmbeddings({ input: text });
    const embedding = result.embeddings[0];
    if (!embedding) {
      throw new Error('No embedding returned');
    }
    return embedding;
  }
}
