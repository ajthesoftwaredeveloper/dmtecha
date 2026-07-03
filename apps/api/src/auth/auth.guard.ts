import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import type { EnvConfig } from '../config/env.validation';

export interface AuthenticatedUser {
  id: string;
  email: string;
  accessToken: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { headers: Record<string, string | undefined> }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const supabase = createClient(
        this.configService.get('SUPABASE_URL', { infer: true }),
        this.configService.get('SUPABASE_ANON_KEY', { infer: true }),
      );

      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      request.user = {
        id: data.user.id,
        email: data.user.email ?? '',
        accessToken: token,
      };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
