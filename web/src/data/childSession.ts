// The child device claims a pairing code (Edge Function claim-pairing-code).
// The browser caches nothing: the anonymous Supabase user + the server's
// child_sessions row ARE the session.
import { supabase } from '../supabase/client';
import { callFunction, FunctionCallError } from '../supabase/functions';

export type ClaimError = 'wrong' | 'tooManyAttempts' | 'offline' | 'unavailable';

export class ClaimFailure extends Error {
  override name = 'ClaimFailure';
  constructor(
    readonly error: ClaimError,
    /** The raw code, for debugging (never shown to the child). */
    readonly rawCode = '',
  ) {
    super(error);
  }
}

/**
 * Server/transport code → what the child sees. `wrong-code`/`bad-code` come from
 * the function for a wrong, expired or used code; `network` means the request
 * never arrived; anything else (function not deployed, anonymous sign-ins
 * disabled, internal errors) means the service is unavailable.
 */
export function claimErrorOf(code: string, online: boolean): ClaimError {
  if (code === 'wrong-code' || code === 'bad-code') return 'wrong';
  if (code === 'too-many-attempts') return 'tooManyAttempts';
  if (!online || code === 'network') return 'offline';
  return 'unavailable';
}

export interface ClaimedChild {
  parentId: string;
  childId: string;
  name: string;
  avatar: string;
  gender: string;
}

/** `code` = six Latin digits. Throws ClaimFailure. */
export async function claimCode(code: string): Promise<ClaimedChild> {
  // No network: say so at once.
  if (!navigator.onLine) throw new ClaimFailure('offline', 'navigator-offline');
  const auth = supabase().auth;
  let raw = '';
  try {
    const { data: s } = await auth.getSession();
    // A parent signed in on this browser is signed out first: one identity per device.
    if (s.session && !s.session.user.is_anonymous) await auth.signOut();
    const { data: s2 } = await auth.getSession();
    if (!s2.session) {
      const { error } = await auth.signInAnonymously();
      if (error) {
        // e.g. anonymous_provider_disabled → the service is off.
        raw = `auth/${error.code ?? error.status ?? 'error'}`;
        throw new FunctionCallError(error.status === 0 ? 'network' : 'unavailable');
      }
    }
    return await callFunction<ClaimedChild>('claim-pairing-code', { code });
  } catch (e) {
    const fc = e instanceof FunctionCallError ? e : new FunctionCallError('unavailable');
    raw ||= `${fc.code}${fc.status ? ` [${fc.status}]` : ''}`;
    // The raw code helps tell "function not deployed" / "anonymous auth disabled" apart.
    console.warn('[claim-pairing-code]', raw);
    throw new ClaimFailure(claimErrorOf(fc.code, navigator.onLine), raw);
  }
}

/** Forgets this device's pairing (signs the anonymous user out). */
export async function leaveChildDevice(): Promise<void> {
  const { data } = await supabase().auth.getSession();
  if (data.session?.user.is_anonymous) await supabase().auth.signOut();
}
