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
      return new AuthFailure('البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'password', code);
    case 'email-already-in-use':
      return new AuthFailure('هذا البريد مسجّل مسبقًا — جرّب تسجيل الدخول.', 'email', code);
    case 'weak-password':
      return new AuthFailure('كلمة المرور ضعيفة — استخدم ٨ أحرف على الأقل.', 'password', code);
    case 'invalid-email':
    case 'missing-email':
      return new AuthFailure('صيغة البريد الإلكتروني غير صحيحة.', 'email', code);
    case 'too-many-requests':
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
    case 'permission-denied':
      return new AuthFailure('تعذّر حفظ بيانات الحساب — حاول مرة أخرى.', 'general', code);
    default:
      return new AuthFailure('حدث خطأ غير متوقع — حاول مرة أخرى.', 'general', code);
  }
}

export function toAuthFailure(e: unknown): AuthFailure {
  if (e instanceof AuthFailure) return e;
  const code = (e as { code?: unknown })?.code;
  return authFailure(typeof code === 'string' ? code : 'unknown');
}
