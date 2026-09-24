import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

import { claimCode } from './claim';
import { issueCode, requireId } from './pairing';

// Same region as Firestore (nam5 → us-central1).
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
initializeApp();

/** A signed-in parent (email/password) — never an anonymous child device. */
function requireParent(req: CallableRequest): string {
  const auth = req.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'sign-in-required');
  if (auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'parent-only');
  }
  return auth.uid;
}

/** Frame 11 — the child's pairing code (existing valid one, or a new one). */
export const createPairingCode = onCall(async (req) => {
  const uid = requireParent(req);
  const childId = requireId(req.data?.childId, 'childId');
  return issueCode(getFirestore(), uid, childId, { revoke: false });
});

/** Frame 11 «إصدار رمز جديد» — old code dies, linked device unlinked, new code. */
export const revokePairingCode = onCall(async (req) => {
  const uid = requireParent(req);
  const childId = requireId(req.data?.childId, 'childId');
  return issueCode(getFirestore(), uid, childId, { revoke: true });
});

/**
 * Login «الطفل» tab — an anonymous child device claims its code. Rate-limited
 * per device; links the device to the child and returns only the child's
 * first name + avatar. Frame 03 states: wrong → `not-found`.
 */
export const claimPairingCode = onCall(async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'sign-in-required');
  if (auth.token.firebase?.sign_in_provider !== 'anonymous') {
    throw new HttpsError('permission-denied', 'child-device-only');
  }
  return claimCode(getFirestore(), auth.uid, req.data?.code);
});
