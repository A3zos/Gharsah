// The child device claims a pairing code (server-side, claimPairingCode).
// Port of FirebaseChildSessionRepository.claim — the browser caches nothing:
// the anonymous Firebase user + the server's childSessions/{uid} ARE the session.
import { signInAnonymously, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { firebase } from '../firebase/app';
import { bareCode } from './authFailure';

export type ClaimError = 'wrong' | 'tooManyAttempts' | 'offline' | 'unknown';

export class ClaimFailure extends Error {
  override name = 'ClaimFailure';
  constructor(readonly error: ClaimError) {
    super(error);
  }
}

export interface ClaimedChild {
  parentUid: string;
  childId: string;
  name: string;
  avatar: string;
  gender: string;
}

/** `code` = six Latin digits. Throws ClaimFailure. */
export async function claimCode(code: string): Promise<ClaimedChild> {
  const { auth, functions } = firebase();
  try {
    await auth.authStateReady();
    // A parent signed in on this browser is signed out first: one identity per device.
    if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
    if (!auth.currentUser) await signInAnonymously(auth);
    const r = await httpsCallable<{ code: string }, ClaimedChild>(functions, 'claimPairingCode')({ code });
    return r.data;
  } catch (e) {
    const c = bareCode(String((e as { code?: string }).code ?? ''));
    if (!navigator.onLine) throw new ClaimFailure('offline');
    throw new ClaimFailure(
      c === 'not-found' || c === 'invalid-argument'
        ? 'wrong'
        : c === 'resource-exhausted'
          ? 'tooManyAttempts'
          : c === 'unavailable' || c === 'deadline-exceeded' || c === 'network-request-failed'
            ? 'offline'
            : 'unknown',
    );
  }
}

/** Forgets this device's link (signs the anonymous user out). */
export async function leaveChildDevice(): Promise<void> {
  const { auth } = firebase();
  if (auth.currentUser?.isAnonymous) await signOut(auth);
}
