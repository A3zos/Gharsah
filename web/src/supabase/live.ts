// Live queries: load once, then reload whenever Realtime reports a change on one
// of the watched tables (RLS applies to Realtime too, so only readable rows
// notify). Replaces Firestore onSnapshot; the watch* functions keep their API.
import { supabase } from './client';

export interface Watched {
  table: string;
  /** Realtime filter, e.g. `child_id=eq.<uuid>`. */
  filter?: string;
}

let seq = 0;

export function watch<T>(
  tables: Watched[],
  load: () => Promise<T>,
  next: (value: T) => void,
  error?: (e: unknown) => void,
): () => void {
  let stopped = false;
  let running: Promise<void> | null = null;
  let again = false;
  const run = () => {
    if (running) {
      again = true;
      return;
    }
    running = load()
      .then((v) => {
        if (!stopped) next(v);
      })
      .catch((e: unknown) => {
        if (!stopped) error?.(e);
      })
      .finally(() => {
        running = null;
        if (again && !stopped) {
          again = false;
          run();
        }
      });
  };
  run();
  const channel = supabase().channel(`live-${++seq}-${tables.map((t) => t.table).join('-')}`);
  for (const t of tables) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
      run,
    );
  }
  channel.subscribe();
  return () => {
    stopped = true;
    void supabase().removeChannel(channel);
  };
}

/** Postgres/PostgREST error code of a failed call (e.g. '42501' = not allowed). */
export const pgCode = (e: unknown): string => String((e as { code?: unknown })?.code ?? '');
