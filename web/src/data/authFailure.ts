// User-facing auth/Firestore errors in Arabic — same messages as
// app/lib/features/auth/data/auth_failure.dart.

export type AuthField = 'email' | 'password' | 'general';

export class AuthFailure extends Error {
  override name = 'AuthFailure';
  constructor(
    message: string,
    readonly field: AuthField = 'general',
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Firebase error codes arrive as `auth/…`, `functions/…` or bare. */
export const bareCode = (code: string): string => code.replace(/^[a-z]+\//, '');

export function authFailure(rawCode: string): AuthFailure {
  const code = bareCode(rawCode);
  switch (code) {
    case 'invalid-credential':
    case 'invalid-login-credentials':
    case 'user-not-found':
    case 'wrong-password':
    case 'INVALID_LOGIN_CREDENTIALS':
    case 'invalid_credentials':
      return new AuthFailure('البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'password', code);
    case 'email-already-in-use':
    case 'user_already_exists':
    case 'email_exists':
      return new AuthFailure('هذا البريد مسجّل مسبقًا — جرّب تسجيل الدخول.', 'email', code);
    case 'weak-password':
    case 'weak_password':
      return new AuthFailure('كلمة المرور ضعيفة — استخدم ٨ أحرف على الأقل.', 'password', code);
    case 'invalid-email':
    case 'missing-email':
    case 'email_address_invalid':
    case 'validation_failed':
      return new AuthFailure('صيغة البريد الإلكتروني غير صحيحة.', 'email', code);
    case 'too-many-requests':
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new AuthFailure('محاولات كثيرة — انتظر قليلًا ثم حاول مجددًا.', 'general', code);
    case 'network-request-failed':
    case 'unavailable':
      return new AuthFailure('تعذّر الاتصال بالإنترنت — تحقّق من الشبكة وحاول مجددًا.', 'general', code);
    case 'user-disabled':
      return new AuthFailure('هذا الحساب موقوف. تواصل معنا للمساعدة.', 'general', code);
    case 'operation-not-allowed':
      return new AuthFailure('تسجيل الدخول بالبريد غير مفعّل حاليًا.', 'general', code);
    case 'requires-recent-login':
      return new AuthFailure('لحماية حسابك: سجّل الخروج ثم ادخل من جديد، ثم أعد المحاولة.', 'general', code);
    case 'email_not_confirmed':
    case 'confirm-email':
      return new AuthFailure('افتح رابط التأكيد الذي أرسلناه إلى بريدك، ثم سجّل الدخول.', 'general', code);
    case 'plan-child-limit':
      return new AuthFailure('الباقة الشهرية لابن واحد — رقِّ إلى السنوية لإضافة ابن آخر.', 'general', code);
    case 'permission-denied':
    case '42501':
      return new AuthFailure('تعذّر حفظ بيانات الحساب — حاول مرة أخرى.', 'general', code);
    default:
      return new AuthFailure('حدث خطأ غير متوقع — حاول مرة أخرى.', 'general', code);
  }
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
