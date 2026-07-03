import { Injectable } from '@nestjs/common';

import type { ChatResponseDto, Message } from '@dmtecha/shared-types';
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
   * 5. Store messages in DB
   * 6. Return response with source citations
   */
  async chat(
    userId: string,
    message: string,
    conversationId?: string,
    accessToken?: string,
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
      matchThreshold: 0.5,
      matchCount: 5,
    });

    // 4. Build context-augmented prompt
    const contextText = sourceChunks.length > 0
      ? sourceChunks
          .map((chunk, i) => `[Source ${String(i + 1)}: ${chunk.documentTitle}]\n${chunk.content}`)
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

    const history: ChatMessage[] = ((historyData as Array<Record<string, unknown>>) ?? []).map((m) => ({
      role: m['role'] as 'user' | 'assistant' | 'system',
      content: m['content'] as string,
    }));

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    // 6. Generate AI response
    const aiResult = await this.aiService.chatCompletion({ messages, temperature: 0.3 });

    // 7. Store assistant response
    const sourceChunkIds = sourceChunks.map((c) => c.id);
    const { data: savedMessage, error: saveError } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        role: 'assistant',
        content: aiResult.content,
        source_chunk_ids: sourceChunkIds,
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
   * Get all conversations for a user.
   */
  async getConversations(userId: string) {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);
    return data ?? [];
  }

  /**
   * Get messages for a conversation.
   */
  async getMessages(conversationId: string, userId: string) {
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
    return data ?? [];
  }
}
