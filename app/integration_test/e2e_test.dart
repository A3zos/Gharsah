// End-to-end test of the parent flow against a Supabase project (use the
// LOCAL stack: `npx supabase start`, email confirmation off in config.toml).
// Run from app/ (Android emulator running):
//   flutter drive --driver=test_driver/integration_test.dart \
//     --target=integration_test/e2e_test.dart -d emulator-5554 \
//     --dart-define-from-file=env/supabase.json
// Creates one test account gharsah.e2e+<timestamp>@example.com.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/core/supa.dart';
import 'package:gharsah/main.dart' as app;
import 'package:integration_test/integration_test.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('parent flow: signup → subscribe → add child → logout → login', (
    tester,
  ) async {
    final stamp = DateTime.now().millisecondsSinceEpoch;
    final email = 'gharsah.e2e+$stamp@example.com';
    const password = 'Gharsah2026!';
    const childName = 'Sara E2E';

    /// Pumps until [finder] matches (never pumpAndSettle: the growth timeline
    /// pulses forever). Fails with [what] after [timeout].
    Future<void> waitFor(
      Finder finder,
      String what, {
      Duration timeout = const Duration(seconds: 30),
    }) async {
      final end = DateTime.now().add(timeout);
      while (DateTime.now().isBefore(end)) {
        await tester.pump(const Duration(milliseconds: 250));
        if (finder.evaluate().isNotEmpty) return;
      }
      fail('Timed out waiting for: $what');
    }

    Future<void> tapText(String text) async {
      final f = find.text(text).hitTestable();
      await waitFor(f, '«$text»');
      await tester.tap(f.first);
      await tester.pump(const Duration(milliseconds: 300));
    }

    Future<void> scrollTo(Finder f, String what) async {
      await waitFor(f, what);
      await tester.ensureVisible(f.first);
      await tester.pump(const Duration(milliseconds: 300));
    }

    var shot = 0;
    Future<void> screenshot(String name) async {
      await tester.pump(const Duration(milliseconds: 500));
      shot++;
      await binding.takeScreenshot('${shot.toString().padLeft(2, '0')}-$name');
    }

    await app.main();
    await binding.convertFlutterSurfaceToImage();

    // ── Splash → Auth ──
    await waitFor(
      find.text('إنشاء حساب'),
      'Auth screen',
      timeout: const Duration(seconds: 40),
    );
    await screenshot('auth');

    // ── Signup ──
    await tapText('إنشاء حساب');
    await waitFor(find.text('إنشاء حساب وليّ الأمر'), 'Signup screen');
    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'E2E Parent');
    await tester.enterText(fields.at(1), email);
    await tester.enterText(fields.at(2), password);
    await tester.enterText(fields.at(3), password);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await screenshot('signup-filled');
    await scrollTo(find.text('إنشاء الحساب'), 'signup button');
    await tapText('إنشاء الحساب');

    // ── Lands on Packages; parent doc exists ──
    await waitFor(
      find.text('تغيير الباقة'),
      'Packages after signup',
      timeout: const Duration(seconds: 45),
    );
    final uid = supa.auth.currentUser!.id;
    debugPrint('E2E account: $email  uid: $uid');
    final parent = await supa
        .from('parents')
        .select('name, email')
        .eq('id', uid)
        .maybeSingle();
    expect(
      parent,
      isNotNull,
      reason: 'parents row should be created at signup',
    );
    expect(parent!['email'], email);
    await screenshot('packages-after-signup');

    // ── Subscribe (mock Play) ──
    await scrollTo(find.text('اشترك سنويًا'), 'annual subscribe button');
    await tapText('اشترك سنويًا');
    await waitFor(find.text('شاشة النظام'), 'Play sheet');
    await screenshot('play-confirm');
    await tapText('اشتراك');

    // ── Design flow continues to AddChild ──
    await waitFor(
      find.text('اسم الابن'),
      'AddChild after purchase',
      timeout: const Duration(seconds: 30),
    );
    final sub = await supa
        .from('subscriptions')
        .select('plan, provider')
        .eq('parent_id', uid)
        .maybeSingle();
    expect(sub, isNotNull, reason: 'the subscription should be saved');
    expect(sub!['plan'], 'annual');
    expect(sub['provider'], 'mock');
    await tester.enterText(find.byType(TextField).first, childName);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await screenshot('add-child');
    await scrollTo(find.text('التالي — جدول التعلّم'), 'AddChild next');
    await tapText('التالي — جدول التعلّم');

    // ── Schedule → Avatar → save ──
    await waitFor(find.text('جدول التعلّم'), 'Schedule screen');
    await screenshot('schedule');
    await scrollTo(find.text('التالي — اختيار الشخصية'), 'Schedule next');
    await tapText('التالي — اختيار الشخصية');
    await waitFor(find.text('اختر شخصية $childName'), 'AvatarPicker');
    await screenshot('avatar');
    await scrollTo(find.text('حفظ وإنشاء رمز الربط'), 'save button');
    await tapText('حفظ وإنشاء رمز الربط');

    // ── PairingCode; child doc exists ──
    await waitFor(
      find.text('تمت إضافة $childName'),
      'PairingCode screen',
      timeout: const Duration(seconds: 30),
    );
    final kids = await supa.from('children').select().eq('parent_id', uid);
    expect(kids, hasLength(1), reason: 'one child should be saved');
    final kid = kids.single;
    expect(kid['name'], childName);
    expect(kid['age'], 10);
    expect(kid['gender'], 'girl');
    expect(kid['avatar'], 'g1');
    expect(kid['session_duration'], 45);
    expect(kid['review_days'] as List, isNotEmpty);
    final pairing = await supa.rpc(
      'child_pairing',
      params: {'p_child': kid['id']},
    );
    expect((pairing as Map)['code'], matches(RegExp(r'^[0-9]{6}$')));
    debugPrint('E2E child: ${kid['id']}  code: ${pairing['code']}');
    await screenshot('pairing-code');

    // ── Back to Packages: the real child replaces the samples ──
    await tapText('تم — العودة إلى الباقات');
    await waitFor(find.text('تغيير الباقة'), 'Packages after adding child');
    await scrollTo(find.text(childName), 'child in «أبنائي»');
    expect(
      find.text('سارة'),
      findsNothing,
      reason: 'sample children hidden once a real child exists',
    );
    await screenshot('packages-with-child');

    // ── «الإنجازات» → Dashboard for that child ──
    await tapText('الإنجازات');
    await waitFor(find.text('لوحة التحكم').hitTestable(), 'Dashboard');
    expect(find.text(childName).hitTestable(), findsWidgets);
    await screenshot('dashboard-child');

    // ── Logout via the settings icon ──
    await tester.tap(find.bySemanticsLabel('الإعدادات').hitTestable().first);
    await tester.pump(const Duration(milliseconds: 500));
    await waitFor(find.text('تسجيل الخروج؟'), 'logout dialog');
    await tapText('تسجيل الخروج');
    await waitFor(find.text('تسجيل دخول'), 'Auth after logout');
    expect(supa.auth.currentUser, isNull);
    await screenshot('after-logout');

    // ── Login with the wrong password → Arabic error ──
    await tapText('تسجيل دخول');
    await waitFor(find.text('أهلًا بعودتك'), 'Login screen');
    await tester.enterText(find.byType(TextField).at(0), email);
    await tester.enterText(find.byType(TextField).at(1), 'wrong-password-1');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await scrollTo(find.text('تسجيل الدخول'), 'login button');
    await tapText('تسجيل الدخول');
    await waitFor(
      find.text('البريد الإلكتروني أو كلمة المرور غير صحيحة.'),
      'wrong-password Arabic error',
      timeout: const Duration(seconds: 30),
    );
    await screenshot('wrong-password');

    // ── Forgot password → reset email accepted by Supabase Auth ──
    await scrollTo(find.text('نسيت كلمة المرور؟'), 'forgot link');
    await tapText('نسيت كلمة المرور؟');
    await waitFor(find.text('استعادة كلمة المرور'), 'reset sheet');
    await tapText('إرسال الرابط');
    await waitFor(
      find.textContaining('فستصلك رسالة خلال دقائق'),
      'reset email sent',
      timeout: const Duration(seconds: 30),
    );
    await screenshot('reset-sent');
    await tapText('حسنًا');

    // ── Login with the right password → child still there ──
    await tester.enterText(find.byType(TextField).at(1), password);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tapText('تسجيل الدخول');
    await waitFor(
      find.text('تغيير الباقة'),
      'Packages after login',
      timeout: const Duration(seconds: 30),
    );
    await scrollTo(find.text(childName), 'child persisted after re-login');
    await screenshot('relogin-packages');
  });
}
