import { Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';

import type {
  ChatResponseDto,
  Message,
  ChatStreamEvent,
  UsageMetricsDto,
} from '@dmtecha/shared-types';
import { nowISO } from '@dmtecha/utils';

import { AiService } from '../ai/ai.service';
import type { ChatMessage } from '../ai/ai.types';
import { SupabaseConfigService } from '../config/supabase.config';
import { RagService } from '../rag/rag.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly supabaseConfig: SupabaseConfigService,
  ) {}

  /**
   * Process a chat message:
   * 1. Create or reuse conversation
   * 2. Retrieve relevant context via RAG
   * 3. Build prompt with context
   * 4. Generate AI response
   * 5. Store messages in DB with token counts
   * 6. Return response with source citations
   */
  async chat(
    userId: string,
    message: string,
    conversationId?: string,
    _accessToken?: string,
  ): Promise<ChatResponseDto> {
    const supabase = this.supabaseConfig.getAdminClient();

    // 1. Create or get conversation
    let convId = conversationId;
    if (!convId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, title: message.slice(0, 100) })
        .select('id')
        .single();

      if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`);
      convId = (data as Record<string, unknown>)['id'] as string;
    }

    // 2. Store user message
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // 3. Retrieve relevant context chunks
    const sourceChunks = await this.ragService.searchSimilarChunks(message, userId, {
      matchThreshold: 0.3,
      matchCount: 5,
    });

    // 4. Build context-augmented prompt
    const contextText =
      sourceChunks.length > 0
        ? sourceChunks
            .map(
              (chunk, i) => `[Source ${String(i + 1)}: ${chunk.documentTitle}]\n${chunk.content}`,
            )
            .join('\n\n')
        : '';

    const systemPrompt = `You are a helpful AI assistant for a knowledge base. Answer questions based on the provided context documents. If the context doesn't contain relevant information, say so honestly. Always cite which source documents you used.

${contextText ? `## Relevant Context:\n\n${contextText}` : 'No relevant documents found in the knowledge base.'}`;

    // 5. Get conversation history (last 10 messages)
    const { data: historyData } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(10);

    const history: ChatMessage[] = ((historyData as Array<Record<string, unknown>>) ?? []).map(
      (m) => ({
        role: m['role'] as 'user' | 'assistant' | 'system',
        content: m['content'] as string,
      }),
    );

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];

    // 6. Generate AI response
    const aiResult = await this.aiService.chatCompletion({ messages, temperature: 0.3 });

    // Estimate tokens
    const allText = messages.map(m => m.content).join(' ');
    const promptTokens = aiResult.usage?.promptTokens ?? Math.max(Math.round(allText.length / 4), 10);
    const completionTokens = aiResult.usage?.completionTokens ?? Math.max(Math.round(aiResult.content.length / 4), 5);

    // 7. Store assistant response
    const sourceChunkIds = sourceChunks.map((c) => c.id);
    const { data: savedMessage, error: saveError } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: aiResult.content,
        source_chunk_ids: sourceChunkIds,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save assistant message:', saveError);
    }

    const msgRow = savedMessage as Record<string, unknown> | null;

    const responseMessage: Message = {
      id: (msgRow?.['id'] as string) ?? '',
      conversationId: convId,
      role: 'assistant',
      content: aiResult.content,
      sourceChunkIds: sourceChunkIds,
      promptTokens,
      completionTokens,
      createdAt: (msgRow?.['created_at'] as string) ?? nowISO(),
      updatedAt: (msgRow?.['created_at'] as string) ?? nowISO(),
    };

    return {
      message: responseMessage,
      sourceChunks: sourceChunks.map((chunk) => ({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        content: chunk.content,
        similarity: chunk.similarity,
      })),
    };
  }

  /**
   * Process a chat message with Server-Sent Events (SSE) streaming.
   */
  async chatStream(
    userId: string,
    message: string,
    res: Response,
    conversationId?: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getAdminClient();

    // 1. Create or get conversation
    let convId = conversationId;
    if (!convId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ user_id: userId, title: message.slice(0, 100) })
        .select('id')
        .single();

      if (error || !data) {
        const errEvent: ChatStreamEvent = { type: 'error', message: `Failed to create conversation: ${error?.message}` };
        res.write(`data: ${JSON.stringify(errEvent)}\n\n`);
        res.end();
        return;
      }
      convId = (data as Record<string, unknown>)['id'] as string;
    }

    // 2. Store user message
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // 3. Retrieve relevant context chunks
    const sourceChunks = await this.ragService.searchSimilarChunks(message, userId, {
      matchThreshold: 0.3,
      matchCount: 5,
    });

    // 4. Send citations first
    const sourcesEvent: ChatStreamEvent = {
      type: 'sources',
      chunks: sourceChunks.map((c) => ({
        chunkId: c.id,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        content: c.content,
        similarity: c.similarity,
      })),
    };
    res.write(`data: ${JSON.stringify(sourcesEvent)}\n\n`);

    // 5. Build prompt
    const contextText =
      sourceChunks.length > 0
        ? sourceChunks
            .map(
              (chunk, i) => `[Source ${String(i + 1)}: ${chunk.documentTitle}]\n${chunk.content}`,
            )
            .join('\n\n')
        : '';

    const systemPrompt = `You are a helpful AI assistant for a knowledge base. Answer questions based on the provided context documents. If the context doesn't contain relevant information, say so honestly. Always cite which source documents you used.

${contextText ? `## Relevant Context:\n\n${contextText}` : 'No relevant documents found in the knowledge base.'}`;

    // 6. Fetch conversation history
    const { data: historyData } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(10);

    const history = ((historyData as Array<Record<string, unknown>>) ?? []).map(
      (m) => ({
        role: m['role'] as 'user' | 'assistant' | 'system',
        content: m['content'] as string,
      }),
    );

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];

    // 7. Call chat completion stream
    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const stream = this.aiService.chatCompletionStream({ messages, temperature: 0.3 });
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          fullContent += delta;
          const contentEvent: ChatStreamEvent = { type: 'content', delta };
          res.write(`data: ${JSON.stringify(contentEvent)}\n\n`);
        }

        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
          completionTokens = chunk.usage.completion_tokens ?? completionTokens;
        }
      }
    } catch (err: unknown) {
      console.error('Streaming completion failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Streaming failed';
      const errEvent: ChatStreamEvent = { type: 'error', message: errMsg };
      res.write(`data: ${JSON.stringify(errEvent)}\n\n`);
      res.end();
      return;
    }

    // Fallback simple token estimation if API didn't return usage
    if (promptTokens === 0) {
      const allText = messages.map(m => m.content).join(' ');
      promptTokens = Math.max(Math.round(allText.length / 4), 10);
      completionTokens = Math.max(Math.round(fullContent.length / 4), 5);
    }

    // 8. Save assistant response
    const sourceChunkIds = sourceChunks.map((c) => c.id);
    const { data: savedMessage, error: saveError } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: fullContent,
        source_chunk_ids: sourceChunkIds,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save assistant message:', saveError);
    }

    const msgRow = savedMessage as Record<string, unknown> | null;
    const responseMessage: Message = {
      id: (msgRow?.['id'] as string) ?? '',
      conversationId: convId,
      role: 'assistant',
      content: fullContent,
      sourceChunkIds,
      promptTokens,
      completionTokens,
      createdAt: (msgRow?.['created_at'] as string) ?? nowISO(),
      updatedAt: (msgRow?.['created_at'] as string) ?? nowISO(),
    };

    const doneEvent: ChatStreamEvent = { type: 'done', message: responseMessage };
    res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
    res.end();
  }

  /**
   * Get all conversations for a user.
   */
  async getConversations(userId: string): Promise<Record<string, unknown>[]> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  /**
   * Get messages for a conversation.
   */
  async getMessages(conversationId: string, userId: string): Promise<Record<string, unknown>[]> {
    const supabase = this.supabaseConfig.getAdminClient();

    // Verify ownership
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!conv) throw new Error('Conversation not found');

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);

    const messages = (data ?? []) as Record<string, unknown>[];

    // Collect all source chunk ids
    const allChunkIds: string[] = [];
    for (const msg of messages) {
      const ids = msg['source_chunk_ids'] as string[] | undefined;
      if (ids && ids.length > 0) {
        allChunkIds.push(...ids);
      }
    }

    // Fetch details for all chunks
    const chunkMap = new Map<string, Record<string, unknown>>();
    if (allChunkIds.length > 0) {
      const { data: chunks } = await supabase
        .from('document_chunks')
        .select(`
          id,
          content,
          documents (
            title,
            id
          )
        `)
        .in('id', allChunkIds);

      interface DbChunkResult {
        id: string;
        content: string;
        documents: {
          title: string;
          id: string;
        } | null;
      }

      for (const chunk of (chunks as unknown as DbChunkResult[]) ?? []) {
        chunkMap.set(chunk.id, {
          chunkId: chunk.id,
          content: chunk.content,
          documentId: chunk.documents?.id,
          documentTitle: chunk.documents?.title,
          similarity: 1.0, // Mock similarity for historical citations
        });
      }
    }

    // Map details back to messages
    return messages.map((msg) => {
      const ids = msg['source_chunk_ids'] as string[] | undefined;
      return {
        ...msg,
        sourceChunks: ids
          ? ids.map((id: string) => chunkMap.get(id)).filter(Boolean)
          : [],
      };
    });
  }

  /**
   * Delete a conversation securely.
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!conv) throw new NotFoundException('Conversation not found');

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
  }

  /**
   * Aggregate token usage metrics for a user.
   */
  async getUsageMetrics(userId: string): Promise<UsageMetricsDto> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { count: conversationCount, error: convErr } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (convErr) throw new Error(`Failed to count conversations: ${convErr.message}`);

    const { data: userConvs, error: userConvsErr } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId);

    if (userConvsErr) throw new Error(`Failed to fetch conversations: ${userConvsErr.message}`);

    const convIds = (userConvs as Array<{ id: string }> ?? []).map((c) => c.id);

    if (convIds.length === 0) {
      return {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        conversationCount: 0,
        messageCount: 0,
      };
    }

    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('prompt_tokens, completion_tokens')
      .in('conversation_id', convIds);

    if (msgErr) throw new Error(`Failed to fetch messages: ${msgErr.message}`);

    let promptTokens = 0;
    let completionTokens = 0;
    const messageCount = messages?.length ?? 0;

    for (const msg of messages ?? []) {
      promptTokens += (msg.prompt_tokens as number) ?? 0;
      completionTokens += (msg.completion_tokens as number) ?? 0;
    }

    return {
      totalTokens: promptTokens + completionTokens,
      promptTokens,
      completionTokens,
      conversationCount: conversationCount ?? 0,
      messageCount,
    };
  }
}
