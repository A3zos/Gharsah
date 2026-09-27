import 'package:supabase_flutter/supabase_flutter.dart';

/// Which form field an auth error belongs to, so the UI can show it inline.
enum AuthField { email, password, general }

/// A user-facing auth error with a friendly Arabic message.
class AuthFailure implements Exception {
  const AuthFailure(this.message, {this.field = AuthField.general, this.code});

  final String message;
  final AuthField field;

  /// The original error code (Supabase Auth / Postgres), for logs/debugging only.
  final String? code;

  /// Maps a Supabase Auth / Postgres error code to an Arabic message.
  factory AuthFailure.fromCode(String code) {
    switch (code) {
      case 'invalid-credential':
      case 'user-not-found':
      case 'wrong-password':
      case 'INVALID_LOGIN_CREDENTIALS':
      case 'invalid_credentials':
        return AuthFailure(
          'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
          field: AuthField.password,
          code: code,
        );
      case 'email-already-in-use':
      case 'user_already_exists':
      case 'email_exists':
        return AuthFailure(
          'هذا البريد مسجّل مسبقًا — جرّب تسجيل الدخول.',
          field: AuthField.email,
          code: code,
        );
      case 'weak-password':
      case 'weak_password':
        return AuthFailure(
          'كلمة المرور ضعيفة — استخدم ٨ أحرف على الأقل.',
          field: AuthField.password,
          code: code,
        );
      case 'invalid-email':
      case 'missing-email':
      case 'email_address_invalid':
      case 'validation_failed':
        return AuthFailure(
          'صيغة البريد الإلكتروني غير صحيحة.',
          field: AuthField.email,
          code: code,
        );
      case 'too-many-requests':
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return AuthFailure(
          'محاولات كثيرة — انتظر قليلًا ثم حاول مجددًا.',
          code: code,
        );
      case 'network-request-failed':
      case 'unavailable':
        return AuthFailure(
          'تعذّر الاتصال بالإنترنت — تحقّق من الشبكة وحاول مجددًا.',
          code: code,
        );
      case 'user-disabled':
        return AuthFailure(
          'هذا الحساب موقوف. تواصل معنا للمساعدة.',
          code: code,
        );
      case 'operation-not-allowed':
        return AuthFailure(
          'تسجيل الدخول بالبريد غير مفعّل حاليًا.',
          code: code,
        );
      case 'email_not_confirmed':
      case 'confirm-email':
        return AuthFailure(
          'افتح رابط التأكيد الذي أرسلناه إلى بريدك، ثم سجّل الدخول.',
          code: code,
        );
      case 'plan-child-limit':
        return AuthFailure(
          'الباقة الشهرية لابن واحد — رقِّ إلى السنوية لإضافة ابن آخر.',
          code: code,
        );
      case 'permission-denied':
      case '42501':
        return AuthFailure(
          'تعذّر حفظ بيانات الحساب — حاول مرة أخرى.',
          code: code,
        );
      default:
        return AuthFailure('حدث خطأ غير متوقع — حاول مرة أخرى.', code: code);
    }
  }

  @override
  String toString() => 'AuthFailure($code): $message';
}

/// Any Supabase failure (auth, database, network) → [AuthFailure].
AuthFailure authFailureOf(Object e) {
  if (e is AuthFailure) return e;
  final text = e.toString();
  // Our SQL triggers raise named exceptions (monthly plan = one child).
  if (text.contains('plan-child-limit')) {
    return AuthFailure.fromCode('plan-child-limit');
  }
  final code = _codeOf(e);
  if (code != null && code.isNotEmpty) return AuthFailure.fromCode(code);
  if (text.contains('SocketException') ||
      text.contains('ClientException') ||
      text.contains('Failed host lookup')) {
    return AuthFailure.fromCode('network-request-failed');
  }
  return AuthFailure.fromCode('unknown');
}

String? _codeOf(Object e) => switch (e) {
  AuthException(:final code) => code,
  PostgrestException(:final code) => code,
  _ => null,
};
