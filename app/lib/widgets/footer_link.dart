import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// «ليس لديك حساب؟ إنشاء حساب» — the whole line is one ≥48px tap target.
class FooterLink extends StatelessWidget {
  const FooterLink({
    super.key,
    required this.prompt,
    required this.action,
    required this.onTap,
  });

  /// Extra height the 48px tap target adds above and below the design's
  /// 14px text line; callers subtract it from the surrounding gaps.
  static const double targetExtra =
      (AppSizes.minTouch - 14 * AppFonts.cairoNormal) / 2;

  final String prompt;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final link = AppTextStyles.footer.copyWith(
      color: AppColors.deepGreen,
      fontWeight: FontWeight.w700,
      decoration: TextDecoration.underline,
      decorationColor: AppColors.deepGreen,
    );
    return Semantics(
      link: true,
      label: '$prompt $action',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.chip),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSizes.minTouch),
          child: Center(
            child: Text.rich(
              TextSpan(
                style: AppTextStyles.footer,
                children: [
                  TextSpan(text: '$prompt '),
                  TextSpan(text: action, style: link),
                ],
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
