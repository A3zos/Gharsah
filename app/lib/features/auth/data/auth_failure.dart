/// Which form field an auth error belongs to, so the UI can show it inline.
enum AuthField { email, password, general }

/// A user-facing auth error with a friendly Arabic message.
class AuthFailure implements Exception {
  const AuthFailure(this.message, {this.field = AuthField.general, this.code});

  final String message;
  final AuthField field;

  /// The original Firebase error code, for logs/debugging only.
  final String? code;

  /// Maps a FirebaseAuth / Firestore error code to an Arabic message.
  factory AuthFailure.fromCode(String code) {
    switch (code) {
      case 'invalid-credential':
      case 'user-not-found':
      case 'wrong-password':
      case 'INVALID_LOGIN_CREDENTIALS':
        return AuthFailure(
          'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
          field: AuthField.password,
          code: code,
        );
      case 'email-already-in-use':
        return AuthFailure(
          'هذا البريد مسجّل مسبقًا — جرّب تسجيل الدخول.',
          field: AuthField.email,
          code: code,
        );
      case 'weak-password':
        return AuthFailure(
          'كلمة المرور ضعيفة — استخدم ٨ أحرف على الأقل.',
          field: AuthField.password,
          code: code,
        );
      case 'invalid-email':
      case 'missing-email':
        return AuthFailure(
          'صيغة البريد الإلكتروني غير صحيحة.',
          field: AuthField.email,
          code: code,
        );
      case 'too-many-requests':
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
      case 'permission-denied':
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
