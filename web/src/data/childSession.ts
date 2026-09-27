// The child device claims a pairing code (server-side, claimPairingCode).
// Port of FirebaseChildSessionRepository.claim — the browser caches nothing:
// the anonymous Firebase user + the server's childSessions/{uid} ARE the session.
import { signInAnonymously, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { firebase } from '../firebase/app';
import { bareCode } from './authFailure';

export type ClaimError = 'wrong' | 'tooManyAttempts' | 'offline' | 'unavailable';

export class ClaimFailure extends Error {
  override name = 'ClaimFailure';
  constructor(
    readonly error: ClaimError,
    /** The raw Firebase code, for debugging (never shown to the child). */
    readonly rawCode = '',
  ) {
    super(error);
  }
}

/**
 * Firebase error → what the child sees. The server answers a wrong/expired code
 * with not-found + message `wrong-code`; a not-found WITHOUT that message means
 * the callable itself isn't reachable (not deployed). A disabled anonymous
 * sign-in (auth/admin-restricted-operation) also means the service is off.
 */
export function claimErrorOf(rawCode: string, message: string, online: boolean): ClaimError {
  const c = bareCode(rawCode);
  if (c === 'invalid-argument' || (c === 'not-found' && /wrong-code/.test(message))) return 'wrong';
  if (c === 'resource-exhausted') return 'tooManyAttempts';
  if (!online || c === 'network-request-failed') return 'offline';
  return 'unavailable';
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
  // No network: say so at once (Firebase would retry for several seconds first).
  if (!navigator.onLine) throw new ClaimFailure('offline', 'navigator-offline');
  const { auth, functions } = firebase();
  try {
    await auth.authStateReady();
    // A parent signed in on this browser is signed out first: one identity per device.
    if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
    if (!auth.currentUser) await signInAnonymously(auth);
    const r = await httpsCallable<{ code: string }, ClaimedChild>(functions, 'claimPairingCode')({ code });
    return r.data;
  } catch (e) {
    const raw = String((e as { code?: string }).code ?? '');
    const message = String((e as { message?: string }).message ?? '');
    const error = claimErrorOf(raw, message, navigator.onLine);
    // The raw code helps tell "functions not deployed" / "anonymous auth disabled" apart.
    console.warn('[claimPairingCode]', raw || 'no-code', message);
    throw new ClaimFailure(error, raw);
  }
}

/** Forgets this device's link (signs the anonymous user out). */
export async function leaveChildDevice(): Promise<void> {
  const { auth } = firebase();
  if (auth.currentUser?.isAnonymous) await signOut(auth);
}
