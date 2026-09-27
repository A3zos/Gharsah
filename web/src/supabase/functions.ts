// Calls our Edge Functions and normalizes their errors to a short code:
// the function's own `{ error: 'wrong-code' | … }`, 'network' when the request
// never arrived, or 'unavailable' when the function isn't reachable (not deployed).
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { supabase } from './client';

export class FunctionCallError extends Error {
  override name = 'FunctionCallError';
  constructor(
    /** 'wrong-code', 'too-many-attempts', … | 'network' | 'unavailable' */
    readonly code: string,
    readonly status = 0,
  ) {
    super(code);
  }
}

export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke<T>(name, { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const payload = (await res.json().catch(() => null)) as { error?: unknown } | null;
    const code = typeof payload?.error === 'string' ? payload.error : 'unavailable';
    throw new FunctionCallError(code, res.status);
  }
  if (error instanceof FunctionsFetchError) throw new FunctionCallError('network');
  if (error instanceof FunctionsRelayError) throw new FunctionCallError('unavailable');
  throw new FunctionCallError('unavailable');
}
