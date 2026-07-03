import { Module } from '@nestjs/common';

import { SupabaseConfigService } from '../config/supabase.config';

import { ChunkingService } from './chunking.service';
import { RagService } from './rag.service';

@Module({
  providers: [RagService, ChunkingService, SupabaseConfigService],
  exports: [RagService, ChunkingService],
})
export class RagModule {}
