// The ONE Supabase client of the web app (anon key only — never the service_role
// key). Import it only from routes that need data (never from the landing page),
// so the landing bundle stays small. Values come from web/.env.local
// (see web/.env.example); `npx supabase start` prints the local ones.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy web/.env.example to web/.env.local',
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** The signed-in user (after the stored session was restored). */
export async function currentUser(): Promise<User | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user ?? null;
}

export const isAnonymousUser = (u: User | null | undefined): boolean => u?.is_anonymous === true;
