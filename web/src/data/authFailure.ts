// User-facing auth/Firestore errors — same messages as
// app/lib/features/auth/data/auth_failure.dart. `message` stays Arabic (other code and
// tests read it); a page in another language shows authFailureMessage(lang, failure),
// looked up by the failure's `key` in src/i18n/<lang>/auth.json → errors.
import { MESSAGES, type Messages, type UiLanguage } from '../i18n/i18n';

export type AuthField = 'email' | 'password' | 'general';
export type AuthErrorKey = keyof Messages['auth']['errors'];

export class AuthFailure extends Error {
  override name = 'AuthFailure';
  constructor(
    message: string,
    readonly field: AuthField = 'general',
    readonly code?: string,
    /** The translatable message (auth.json → errors); none = `message` in every language. */
    readonly key?: AuthErrorKey,
  ) {
    super(message);
  }
}

/** Firebase error codes arrive as `auth/…`, `functions/…` or bare. */
export const bareCode = (code: string): string => code.replace(/^[a-z]+\//, '');

/** A (bare) error code → its message key and field. */
function classify(code: string): [AuthErrorKey, AuthField] {
  switch (code) {
    case 'invalid-credential':
    case 'invalid-login-credentials':
    case 'user-not-found':
    case 'wrong-password':
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'invalid_credentials':
      return ['wrongCredentials', 'password'];
    case 'email-already-in-use':
    case 'user_already_exists':
    case 'email_exists':
      return ['emailInUse', 'email'];
    case 'weak-password':
    case 'weak_password':
      return ['weakPassword', 'password'];
    case 'invalid-email':
    case 'missing-email':
    case 'email_address_invalid':
    case 'validation_failed':
      return ['invalidEmail', 'email'];
    case 'too-many-requests':
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return ['tooMany', 'general'];
    case 'network-request-failed':
    case 'unavailable':
      return ['network', 'general'];
    case 'user-disabled':
      return ['userDisabled', 'general'];
    case 'operation-not-allowed':
      return ['notAllowed', 'general'];
    case 'requires-recent-login':
      return ['recentLogin', 'general'];
    case 'email_not_confirmed':
    case 'confirm-email':
      return ['emailNotConfirmed', 'general'];
    case 'plan-child-limit':
      return ['planChildLimit', 'general'];
    case 'permission-denied':
    case '42501':
      return ['saveFailed', 'general'];
    default:
      return ['unexpected', 'general'];
  }
}

export function authFailure(rawCode: string): AuthFailure {
  const code = bareCode(rawCode);
  const [key, field] = classify(code);
  return new AuthFailure(MESSAGES.ar.auth.errors[key], field, code, key);
}

/**
 * A failure's message in the UI language: Arabic = its `message` as before; English /
 * Indonesian = by its key (a failure without one keeps its own message).
 */
export function authFailureMessage(lang: UiLanguage, err: unknown): string {
  const f = err as { message?: unknown; key?: unknown } | null;
  const message = typeof f?.message === 'string' ? f.message : MESSAGES.ar.auth.errors.unexpected;
  if (lang === 'ar') return message;
  const errors = MESSAGES[lang].auth.errors;
  if (typeof f?.key === 'string' && f.key in errors) return errors[f.key as AuthErrorKey];
  return err instanceof AuthFailure ? message : errors.unexpected;
}

export function toAuthFailure(e: unknown): AuthFailure {
  if (e instanceof AuthFailure) return e;
  const err = e as { code?: unknown; name?: unknown; status?: unknown; message?: unknown } | null;
  const message = String(err?.message ?? '');
  // Supabase: a network failure has no code (AuthRetryableFetchError / fetch TypeError).
  if (
    err?.name === 'AuthRetryableFetchError' ||
    err?.status === 0 ||
    /Failed to fetch|NetworkError/i.test(message)
  ) {
    return authFailure('network-request-failed');
  }
  // Our SQL triggers raise named exceptions (e.g. monthly plan = one child).
  if (/plan-child-limit/.test(message)) return authFailure('plan-child-limit');
  const code = err?.code;
  return authFailure(typeof code === 'string' && code ? code : 'unknown');
}
