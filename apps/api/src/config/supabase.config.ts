import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { EnvConfig } from './env.validation';

@Injectable()
export class SupabaseConfigService {
  private readonly adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {
    const url = this.configService.get('SUPABASE_URL', { infer: true });
    const serviceKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });

    this.adminClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Returns a Supabase client authenticated with the service_role key.
   * Use for server-side operations that bypass RLS.
   */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * Returns a Supabase client scoped to a specific user's JWT.
   * RLS policies will be enforced based on the user's auth context.
   */
  getClientForUser(accessToken: string): SupabaseClient {
    const url = this.configService.get('SUPABASE_URL', { infer: true });
    const anonKey = this.configService.get('SUPABASE_ANON_KEY', { infer: true });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
