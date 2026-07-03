import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import type { EnvConfig } from '../config/env.validation';

import {
  PROVIDER_BASE_URLS,
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
  private chatClient!: OpenAI;
  private embeddingClient!: OpenAI;
  private defaultModel!: string;
  private defaultEmbeddingModel!: string;
  private fallbackModel?: string;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  onModuleInit(): void {
    const provider = this.configService.get('AI_PROVIDER', { infer: true });
    const apiKey = this.configService.get('AI_API_KEY', { infer: true }) ?? '';
    const customBaseUrl = this.configService.get('AI_BASE_URL', { infer: true });

    // Resolve base URL: custom override > provider default > OpenAI default
    const baseURL = customBaseUrl ?? PROVIDER_BASE_URLS[provider];

    this.chatClient = new OpenAI({
      apiKey: apiKey || 'ollama', // Ollama doesn't need a real key
      ...(baseURL ? { baseURL } : {}),
      ...(provider === 'openrouter'
        ? {
            defaultHeaders: {
              'HTTP-Referer': 'https://github.com/ajthesoftwaredeveloper/dmtecha',
              'X-OpenRouter-Title': 'AI-Powered Knowledge Base',
            },
          }
        : {}),
    });

    // Resolve embedding provider, key, and baseUrl, falling back to chat provider settings
    const embedProvider = this.configService.get('AI_EMBEDDING_PROVIDER', { infer: true }) ?? provider;
    const embedApiKey = this.configService.get('AI_EMBEDDING_API_KEY', { infer: true }) ?? apiKey;
    const embedCustomBaseUrl = this.configService.get('AI_EMBEDDING_BASE_URL', { infer: true }) ?? customBaseUrl;
    const embedBaseURL = embedCustomBaseUrl ?? PROVIDER_BASE_URLS[embedProvider];

    this.embeddingClient = new OpenAI({
      apiKey: embedApiKey || 'ollama',
      ...(embedBaseURL ? { baseURL: embedBaseURL } : {}),
      ...(embedProvider === 'openrouter'
        ? {
            defaultHeaders: {
              'HTTP-Referer': 'https://github.com/ajthesoftwaredeveloper/dmtecha',
              'X-OpenRouter-Title': 'AI-Powered Knowledge Base',
            },
          }
        : {}),
    });

    this.defaultModel = this.configService.get('AI_MODEL', { infer: true });
    this.fallbackModel = this.configService.get('AI_FALLBACK_MODEL', { infer: true });
    this.defaultEmbeddingModel = this.configService.get('AI_EMBEDDING_MODEL', { infer: true });

    console.warn(
      `🤖 AI Service initialized: [Chat] provider=${provider}, model=${this.defaultModel}, fallback=${String(this.fallbackModel)} | [Embeddings] provider=${embedProvider}, model=${this.defaultEmbeddingModel}`,
    );
  }

  /**
   * Generate a chat completion.
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const model = options.model ?? this.defaultModel;
    try {
      const response = await this.chatClient.chat.completions.create({
        model,
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
    } catch (err) {
      if (this.fallbackModel && model !== this.fallbackModel) {
        console.warn(
          `⚠️ Chat completion failed with model ${model}. Retrying with fallback model ${this.fallbackModel}... Error:`,
          err,
        );
        return this.chatCompletion({
          ...options,
          model: this.fallbackModel,
        });
      }
      throw err;
    }
  }

  /**
   * Generate a streaming chat completion.
   * Returns an async iterable of content deltas.
   */
  async *chatCompletionStream(options: ChatCompletionOptions): AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk> {
    const model = options.model ?? this.defaultModel;
    try {
      const stream = await this.chatClient.chat.completions.create({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
        stream_options: { include_usage: true }, // Returns token usage in the final chunk
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (err) {
      if (this.fallbackModel && model !== this.fallbackModel) {
        console.warn(
          `⚠️ Chat completion stream failed with model ${model}. Retrying with fallback model ${this.fallbackModel}... Error:`,
          err,
        );
        yield* this.chatCompletionStream({
          ...options,
          model: this.fallbackModel,
        });
      } else {
        throw err;
      }
    }
  }

  /**
   * Generate embeddings for one or more text inputs.
   */
  async generateEmbeddings(options: EmbeddingOptions): Promise<EmbeddingResult> {
    const response = await this.embeddingClient.embeddings.create({
      model: options.model ?? this.defaultEmbeddingModel,
      input: options.input,
      encoding_format: 'float',
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
