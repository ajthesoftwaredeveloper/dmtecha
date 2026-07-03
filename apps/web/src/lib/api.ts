import type { ApiResponse } from '@dmtecha/shared-types';

import { supabase } from './supabase';

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

/**
 * Authenticated API client.
 * Automatically attaches the Supabase access token to requests.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as ApiResponse<T> | null;
    return {
      success: false,
      error: errorBody?.error ?? {
        code: 'API_ERROR',
        message: `Request failed with status ${String(response.status)}`,
      },
    };
  }

  return (await response.json()) as ApiResponse<T>;
}
