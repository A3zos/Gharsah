// Shared helpers for the غَرْسة Edge Functions (Deno). The service-role client
// lives ONLY here, server-side (Supabase injects SUPABASE_SERVICE_ROLE_KEY into
// the Edge runtime); clients use the anon key.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim());

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allow =
    ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin) ? origin || '*' : ALLOWED_ORIGINS[0]!;
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** JSON answer; errors are { error: 'wrong-code' | … } for the clients to map. */
export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The caller from its Authorization header (verified by Supabase Auth). */
export async function caller(req: Request): Promise<User | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}

/** Maps an exception raised by our SQL functions to an HTTP answer. */
export function sqlError(req: Request, message: string): Response {
  const known: Record<string, number> = {
    'bad-code': 400,
    'wrong-code': 404,
    'too-many-attempts': 429,
    'child-not-found': 404,
    'no-active-subscription': 412,
    'no-free-code': 503,
  };
  const key = Object.keys(known).find((k) => message.includes(k));
  return key ? json(req, known[key]!, { error: key }) : json(req, 500, { error: 'internal' });
}

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** create-pairing-code and revoke-pairing-code share this (a parent, own child). */
export function pairingHandler(revoke: boolean) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
    if (req.method !== 'POST') return json(req, 405, { error: 'method-not-allowed' });
    const user = await caller(req);
    if (!user || user.is_anonymous) return json(req, 401, { error: 'unauthenticated' });
    const body = await req.json().catch(() => ({}));
    if (!isUuid(body?.childId)) return json(req, 400, { error: 'invalid-argument' });
    const { data, error } = await admin().rpc('issue_pairing_code', {
      p_parent: user.id,
      p_child: body.childId,
      p_revoke: revoke,
    });
    if (error) return sqlError(req, error.message);
    return json(req, 200, data);
  };
}
