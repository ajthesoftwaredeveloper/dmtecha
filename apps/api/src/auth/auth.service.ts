import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';

import type { AuthResponseDto } from '@dmtecha/shared-types';

import { SupabaseConfigService } from '../config/supabase.config';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseConfig: SupabaseConfigService) {}

  async signUp(email: string, password: string, fullName?: string): Promise<AuthResponseDto> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? '' },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new ConflictException('A user with this email already exists');
      }
      throw new UnauthorizedException(error.message);
    }

    // Sign in immediately to get tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      throw new UnauthorizedException('Account created but sign-in failed. Please try signing in.');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        fullName: (data.user.user_metadata?.['full_name'] as string) ?? '',
      },
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
    };
  }

  async signIn(email: string, password: string): Promise<AuthResponseDto> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        fullName: (data.user.user_metadata?.['full_name'] as string) ?? '',
      },
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async signOut(accessToken: string): Promise<void> {
    const supabase = this.supabaseConfig.getAdminClient();

    const { data: userData } = await supabase.auth.getUser(accessToken);
    if (userData.user) {
      await supabase.auth.admin.signOut(userData.user.id);
    }
  }
}
