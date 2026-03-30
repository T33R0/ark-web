import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
}

function getAnonKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
}

// Client-side singleton (for realtime subscriptions)
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(getUrl(), getAnonKey());
  }
  return _client;
}

// Re-export as `supabase` for convenience — lazy initialized
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Server-side (for writes via API routes)
export function createServerClient(): SupabaseClient {
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return createClient(getUrl(), serviceRoleKey);
}
