// Pairing codes, parent side — issued/revoked ONLY by the Edge Functions
// create-pairing-code / revoke-pairing-code (codes live 10 minutes, single use).
import { callFunction, FunctionCallError } from '../supabase/functions';
import { MESSAGES } from '../i18n/i18n';
import { AuthFailure, authFailure } from './authFailure';
import type { PairingInfo } from './children';

async function call(
  name: 'create-pairing-code' | 'revoke-pairing-code',
  childId: string,
): Promise<PairingInfo> {
  try {
    const r = await callFunction<{ code: string; expiresAt: string }>(name, { childId });
    return { code: r.code, expiresAt: new Date(r.expiresAt), status: 'active' };
  } catch (e) {
    throw pairingFailure(e instanceof FunctionCallError ? e.code : 'unavailable');
  }
}

/** The child's valid code, or a freshly issued one (10 minutes). */
export const issueCode = (childId: string) => call('create-pairing-code', childId);

/** «إصدار رمز جديد»: the old code dies, the paired device is unpaired, a new code is issued. */
export const revokeAndReissue = (childId: string) => call('revoke-pairing-code', childId);

/**
 * The failure carries the Arabic message (parent.json → errors) and its code; the parent
 * pages show it in the UI language by the code (components/parent/parentText failureText).
 */
export function pairingFailure(code: string): AuthFailure {
  const t = MESSAGES.ar.parent.errors;
  if (code === 'no-active-subscription' || code === 'child-not-found' || code === 'no-free-code') {
    return new AuthFailure(t[code], 'general', code);
  }
  if (code === 'network') return authFailure('network-request-failed');
  return authFailure('unavailable');
}
