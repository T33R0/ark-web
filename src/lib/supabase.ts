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

const ALLOWED_TABLES = new Set([
    "ark_groups",
    "ark_sessions",
    "ark_questions",
    "ark_messages",
    "conn_state",
    "conn_task_queue",
]);

const ALLOWED_RPCS = new Set<string>([]);

function createRestrictedClient(client: SupabaseClient): SupabaseClient {
    return new Proxy(client, {
        get(target, prop, receiver) {
            if (prop === "from") {
                return (table: string) => {
                    if (!ALLOWED_TABLES.has(table)) {
                        throw new Error(
                            `[ARK GUARD] Access denied: table "${table}" is not whitelisted.`
                        );
                    }
                    return target.from(table);
                };
            }
            if (prop === "rpc") {
                return (fn: string, ...args: unknown[]) => {
                    if (!ALLOWED_RPCS.has(fn)) {
                        throw new Error(
                            `[ARK GUARD] Access denied: RPC "${fn}" is not whitelisted.`
                        );
                    }
                    return target.rpc(fn, ...args);
                };
            }
            return Reflect.get(target, prop, receiver);
        },
    }) as SupabaseClient;
}

// Server-side (for writes via API routes)
export function createServerClient(): SupabaseClient {
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const raw = createClient(getUrl(), serviceRoleKey);
  return createRestrictedClient(raw);
}
