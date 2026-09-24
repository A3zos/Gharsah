import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/decor_blob.dart';
import '../../../widgets/growth_timeline.dart';
import '../../../widgets/screen_frame.dart';
import 'login_screen.dart';
import 'signup_screen.dart';

/// Frame 02 — welcome with the two entry paths.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late final TapGestureRecognizer _terms = TapGestureRecognizer()
    ..onTap = _soon;
  late final TapGestureRecognizer _privacy = TapGestureRecognizer()
    ..onTap = _soon;

  // TODO(phase-e): real terms & privacy pages (incl. Tanzil attribution).
  void _soon() => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(const SnackBar(content: Text('ستتوفر هذه الصفحة قريبًا.')));

  @override
  void dispose() {
    _terms.dispose();
    _privacy.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final link = t.labelSmall!.copyWith(
      color: AppColors.deepGreen,
      fontWeight: FontWeight.w700,
      decoration: TextDecoration.underline,
      decorationColor: AppColors.deepGreen,
    );

    return ScreenFrame(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.screenPaddingH,
        76,
        AppSizes.screenPaddingH,
        40,
      ),
      blobs: [
        DecorBlob(top: -170, right: -140, size: 400, color: AppColors.blobSky),
      ],
      child: TopBottom(
        minGap: 26,
        top: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Column(
              children: [
                AppIcon.logo(size: AppSizes.logoAuth),
                const SizedBox(height: 8),
                Text('غَرْسة', style: t.displayLarge),
                const SizedBox(height: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 270),
                  child: Text(
                    'حساب وليّ الأمر — تتابع منه رحلة أبنائك مع القرآن.',
                    style: t.bodyLarge,
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 26),
            Container(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.timelineCard),
                boxShadow: AppShadows.card,
              ),
              child: const GrowthTimeline(),
            ),
          ],
        ),
        bottom: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FilledButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
              ),
              child: const Text('تسجيل دخول'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const SignupScreen()),
              ),
              child: const Text('إنشاء حساب'),
            ),
            const SizedBox(height: 12 + 6),
            Text.rich(
              TextSpan(
                style: t.labelSmall,
                children: [
                  const TextSpan(text: 'بالمتابعة فإنك توافق على '),
                  TextSpan(
                    text: 'شروط الاستخدام',
                    style: link,
                    recognizer: _terms,
                  ),
                  const TextSpan(text: ' و'),
                  TextSpan(
                    text: 'سياسة الخصوصية',
                    style: link,
                    recognizer: _privacy,
                  ),
                  const TextSpan(text: '.'),
                ],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
