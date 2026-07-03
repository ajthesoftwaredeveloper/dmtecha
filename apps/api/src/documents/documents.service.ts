import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  Document,
  CreateDocumentDto,
  UpdateDocumentDto,
  PaginatedResponse,
} from '@dmtecha/shared-types';

import { SupabaseConfigService } from '../config/supabase.config';
import { RagService } from '../rag/rag.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfigService,
    private readonly ragService: RagService,
  ) {}

  async create(userId: string, dto: CreateDocumentDto, accessToken: string): Promise<Document> {
    const supabase = this.supabaseConfig.getClientForUser(accessToken);

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title: dto.title,
        content: dto.content,
        tags: dto.tags ?? [],
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }

    const doc = this.mapToDocument(data);

    // Process document for RAG (chunk + embed) in background
    this.ragService.processDocument(doc.id, doc.content).catch((err: unknown) => {
      console.error(`Failed to process document ${doc.id} for RAG:`, err);
    });

    return doc;
  }

  async findAll(
    userId: string,
    accessToken: string,
    page = 1,
    pageSize = 20,
    tag?: string,
  ): Promise<PaginatedResponse<Document>> {
    const supabase = this.supabaseConfig.getClientForUser(accessToken);
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    const total = count ?? 0;

    return {
      items: (data ?? []).map((row) => this.mapToDocument(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(userId: string, documentId: string, accessToken: string): Promise<Document> {
    const supabase = this.supabaseConfig.getClientForUser(accessToken);

    const { data, error } = await supabase
      .from('documents')
      .select()
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    return this.mapToDocument(data);
  }

  async update(
    userId: string,
    documentId: string,
    dto: UpdateDocumentDto,
    accessToken: string,
  ): Promise<Document> {
    const supabase = this.supabaseConfig.getClientForUser(accessToken);

    await this.findOne(userId, documentId, accessToken);

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData['title'] = dto.title;
    if (dto.content !== undefined) updateData['content'] = dto.content;
    if (dto.tags !== undefined) updateData['tags'] = dto.tags;

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update document: ${error?.message ?? 'Unknown error'}`);
    }

    const doc = this.mapToDocument(data);

    // Re-process for RAG if content changed
    if (dto.content !== undefined) {
      this.ragService.processDocument(doc.id, doc.content).catch((err: unknown) => {
        console.error(`Failed to re-process document ${doc.id} for RAG:`, err);
      });
    }

    return doc;
  }

  async remove(userId: string, documentId: string, accessToken: string): Promise<void> {
    const supabase = this.supabaseConfig.getClientForUser(accessToken);

    await this.findOne(userId, documentId, accessToken);

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
    // Chunks are auto-deleted via CASCADE
  }

  private mapToDocument(row: Record<string, unknown>): Document {
    return {
      id: row['id'] as string,
      userId: row['user_id'] as string,
      title: row['title'] as string,
      content: row['content'] as string,
      tags: (row['tags'] as string[]) ?? [],
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }
}
