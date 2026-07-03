import { Injectable } from '@nestjs/common';

import { AiService } from '../ai/ai.service';
import { SupabaseConfigService } from '../config/supabase.config';

import { ChunkingService } from './chunking.service';

export interface VectorSearchResult {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  documentTitle: string;
}

/**
 * RAG pipeline service.
 *
 * Handles the full pipeline:
 * 1. Chunk documents into smaller pieces
 * 2. Generate embeddings via the AI service
 * 3. Store chunks + embeddings in Supabase (pgvector)
 * 4. Perform vector similarity search for retrieval
 */
@Injectable()
export class RagService {
  constructor(
    private readonly aiService: AiService,
    private readonly chunkingService: ChunkingService,
    private readonly supabaseConfig: SupabaseConfigService,
  ) {}

  /**
   * Process a document: chunk it, generate embeddings, store in DB.
   * Uses the admin client (service_role) to bypass RLS for chunk writes.
   */
  async processDocument(documentId: string, content: string): Promise<number> {
    const supabase = this.supabaseConfig.getAdminClient();

    // 1. Delete existing chunks for this document (for re-processing)
    await supabase.from('document_chunks').delete().eq('document_id', documentId);

    // 2. Chunk the content
    const chunks = this.chunkingService.chunk(content);
    if (chunks.length === 0) return 0;

    // 3. Generate embeddings in batches
    const batchSize = 20;
    let totalInserted = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const embeddingResult = await this.aiService.generateEmbeddings({
        input: batch,
      });

      // 4. Prepare rows for insertion
      const rows = batch.map((chunkContent, idx) => ({
        document_id: documentId,
        content: chunkContent,
        embedding: JSON.stringify(embeddingResult.embeddings[idx]),
        chunk_index: i + idx,
      }));

      const { error } = await supabase.from('document_chunks').insert(rows);

      if (error) {
        console.error(`Failed to insert chunk batch starting at index ${String(i)}:`, error);
        throw new Error(`Failed to store document chunks: ${error.message}`);
      }

      totalInserted += batch.length;
    }

    return totalInserted;
  }

  /**
   * Search for similar document chunks using vector similarity.
   */
  async searchSimilarChunks(
    query: string,
    userId: string,
    options: { matchThreshold?: number; matchCount?: number } = {},
  ): Promise<VectorSearchResult[]> {
    const { matchThreshold = 0.7, matchCount = 5 } = options;

    // 1. Generate embedding for the query
    const queryEmbedding = await this.aiService.generateEmbedding(query);

    // 2. Call the vector similarity search function
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: matchThreshold,
      match_count: matchCount,
      p_user_id: userId,
    });

    if (error) {
      console.error('Vector search failed:', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
      id: row['id'] as string,
      documentId: row['document_id'] as string,
      content: row['content'] as string,
      chunkIndex: row['chunk_index'] as number,
      similarity: row['similarity'] as number,
      documentTitle: row['document_title'] as string,
    }));
  }
}
