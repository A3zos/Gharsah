// Pairing codes, parent side — issued/revoked ONLY by Cloud Functions
// (createPairingCode / revokePairingCode). Port of pairing_repository.dart.
import { httpsCallable } from 'firebase/functions';

import { firebase } from '../firebase/app';
import { AuthFailure, authFailure, bareCode } from './authFailure';
import type { PairingInfo } from './children';

async function call(name: 'createPairingCode' | 'revokePairingCode', childId: string): Promise<PairingInfo> {
  try {
    const r = await httpsCallable<{ childId: string }, { code: string; expiresAt: number }>(
      firebase().functions,
      name,
    )({ childId });
    return { code: r.data.code, expiresAt: new Date(r.data.expiresAt), status: 'active' };
  } catch (e) {
    throw pairingFailure(String((e as { code?: string }).code ?? ''), (e as Error).message);
  }
}

/** The child's valid code, or a freshly issued one (24 h). */
export const issueCode = (childId: string) => call('createPairingCode', childId);

/** «إصدار رمز جديد»: the old code dies, the linked device is unlinked, a new code is issued. */
export const revokeAndReissue = (childId: string) => call('revokePairingCode', childId);

export function pairingFailure(rawCode: string, message?: string): AuthFailure {
  const code = bareCode(rawCode);
  // The web SDK appends the HTTP status to the message («no-active-subscription [400]»).
  if (code === 'failed-precondition' && message?.startsWith('no-active-subscription')) {
    return new AuthFailure('فعّل اشتراكك أولًا لإصدار رمز الربط.', 'general', code);
  }
  if (code === 'not-found') return new AuthFailure('لم نجد بيانات هذا الابن.', 'general', code);
  if (code === 'resource-exhausted')
    return new AuthFailure('تعذّر إصدار رمز الآن — حاول بعد قليل.', 'general', code);
  return authFailure(code === 'internal' ? 'unavailable' : code);
}
