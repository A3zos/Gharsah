// Pairing codes, parent side — issued/revoked ONLY by the Edge Functions
// create-pairing-code / revoke-pairing-code (codes live 10 minutes, single use).
import { callFunction, FunctionCallError } from '../supabase/functions';
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

export function pairingFailure(code: string): AuthFailure {
  if (code === 'no-active-subscription') {
    return new AuthFailure('فعّل اشتراكك أولًا لإصدار رمز الربط.', 'general', code);
  }
  if (code === 'child-not-found') return new AuthFailure('لم نجد بيانات هذا الابن.', 'general', code);
  if (code === 'no-free-code')
    return new AuthFailure('تعذّر إصدار رمز الآن — حاول بعد قليل.', 'general', code);
  if (code === 'network') return authFailure('network-request-failed');
  return authFailure('unavailable');
}
