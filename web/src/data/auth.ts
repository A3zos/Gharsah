// The parent account (email/password). Port of
// app/lib/features/auth/data/auth_repository.dart — the only module that
// talks to Firebase Auth for parents. Every function throws AuthFailure.
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebase } from '../firebase/app';
import { AuthFailure, bareCode, toAuthFailure } from './authFailure';

export const MIN_PASSWORD_LENGTH = 8;

export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

/** Creates the parent: Auth user → display name → parents/{uid} → verification email. */
export async function signUp(name: string, email: string, password: string): Promise<void> {
  const { auth, db } = firebase();
  let user: User;
  try {
    user = (await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password)).user;
  } catch (e) {
    throw toAuthFailure(e);
  }
  try {
    await updateProfile(user, { displayName: name.trim() });
    await setDoc(doc(db, 'parents', user.uid), {
      name: name.trim(),
      email: user.email,
      createdAt: serverTimestamp(),
      role: 'parent',
    });
  } catch (e) {
    // Roll back so the parent can retry with the same email.
    await deleteUser(user).catch(() => fbSignOut(auth));
    throw toAuthFailure(e);
  }
  try {
    auth.languageCode = 'ar';
    await sendEmailVerification(user);
  } catch (e) {
    // Not fatal: the parent area offers a resend.
    console.warn('sendEmailVerification failed', e);
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  try {
    const user = (await signInWithEmailAndPassword(firebase().auth, email.trim(), password)).user;
    if (user.isAnonymous) throw new AuthFailure('حدث خطأ غير متوقع — حاول مرة أخرى.');
  } catch (e) {
    throw toAuthFailure(e);
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { auth } = firebase();
  try {
    auth.languageCode = 'ar';
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    // Never reveal whether an email has an account.
    if (bareCode(String((e as { code?: string }).code ?? '')) === 'user-not-found') return;
    throw toAuthFailure(e);
  }
}

export async function resendEmailVerification(): Promise<void> {
  const { auth } = firebase();
  if (!auth.currentUser) return;
  try {
    auth.languageCode = 'ar';
    await sendEmailVerification(auth.currentUser);
  } catch (e) {
    throw toAuthFailure(e);
  }
}

export async function signOut(): Promise<void> {
  await fbSignOut(firebase().auth);
}

/** Password strength for the Signup meter (0–3 bars; design shows 2 = «جيدة»). */
export function passwordStrength(pw: string): { bars: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { bars: 0, label: '' };
  if (pw.length < MIN_PASSWORD_LENGTH) return { bars: 1, label: 'قصيرة' };
  const kinds = [/[a-z]/i, /\d/, /[^a-z\d]/i].filter((r) => r.test(pw)).length;
  if (kinds >= 3 || (kinds >= 2 && pw.length >= 12)) return { bars: 3, label: 'قوية' };
  return { bars: 2, label: 'جيدة' };
}
