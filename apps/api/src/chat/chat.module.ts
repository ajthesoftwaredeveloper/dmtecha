import { Module } from '@nestjs/common';

import { SupabaseConfigService } from '../config/supabase.config';
import { RagModule } from '../rag/rag.module';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [RagModule],
  controllers: [ChatController],
  providers: [ChatService, SupabaseConfigService],
  exports: [ChatService],
})
export class ChatModule {}
