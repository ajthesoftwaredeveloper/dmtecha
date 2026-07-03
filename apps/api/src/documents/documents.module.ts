import { Module } from '@nestjs/common';

import { SupabaseConfigService } from '../config/supabase.config';
import { RagModule } from '../rag/rag.module';

import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [RagModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, SupabaseConfigService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
