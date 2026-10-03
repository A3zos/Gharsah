import { AuthFailure, authFailure, authFailureMessage, toAuthFailure } from './authFailure';

test('the Arabic messages and fields are unchanged', () => {
  expect(authFailure('auth/wrong-password')).toMatchObject({
    message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    field: 'password',
    code: 'wrong-password',
  });
  expect(authFailure('user_already_exists')).toMatchObject({
    message: 'هذا البريد مسجّل مسبقًا — جرّب تسجيل الدخول.',
    field: 'email',
  });
  expect(authFailure('weak_password').message).toBe('كلمة المرور ضعيفة — استخدم ٨ أحرف على الأقل.');
  expect(authFailure('whatever').message).toBe('حدث خطأ غير متوقع — حاول مرة أخرى.');
  expect(toAuthFailure({ name: 'AuthRetryableFetchError' }).message).toBe(
    'تعذّر الاتصال بالإنترنت — تحقّق من الشبكة وحاول مجددًا.',
  );
});

test('authFailureMessage: Arabic as before, English / Indonesian by key', () => {
  const f = authFailure('email_not_confirmed');
  expect(authFailureMessage('ar', f)).toBe(f.message);
  expect(authFailureMessage('en', f)).toBe('Open the confirmation link we sent to your email, then sign in.');
  expect(authFailureMessage('id', f)).toBe(
    'Buka tautan konfirmasi yang kami kirim ke email Anda, lalu masuk.',
  );
  // a failure without a key keeps its own message; anything else → «unexpected»
  expect(authFailureMessage('en', new AuthFailure('رسالة خاصة'))).toBe('رسالة خاصة');
  expect(authFailureMessage('en', new Error('boom'))).toBe('Something went wrong — please try again.');
});
