import { Module } from '@nestjs/common';

import { SupabaseConfigService } from '../config/supabase.config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseConfigService],
  exports: [AuthService, SupabaseConfigService],
})
export class AuthModule {}
