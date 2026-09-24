import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'app_icons.dart';

/// Parent tab header (05-Packages / 12-Dashboard): title (+ optional logo) and
/// the 44px settings button, which sits in a 48px tap target.
class GPageHeader extends StatelessWidget {
  const GPageHeader({
    super.key,
    required this.title,
    required this.onSettings,
    this.showLogo = false,
  });

  final String title;
  final VoidCallback onSettings;
  final bool showLogo;

  /// Extra height per side from the 48px tap target around the 44px button;
  /// pages subtract it from the gaps above and below the header.
  static const double targetExtra =
      (AppSizes.minTouch - AppSizes.headerButton) / 2;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (showLogo) ...[AppIcon.logoSmall(), const SizedBox(width: 10)],
        Expanded(child: Text(title, style: AppTextStyles.pageTitle)),
        Semantics(
          button: true,
          label: 'الإعدادات',
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onSettings,
            child: SizedBox.square(
              dimension: AppSizes.minTouch,
              child: Center(
                child: Material(
                  color: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.headerButton),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: onSettings,
                    child: SizedBox.square(
                      dimension: AppSizes.headerButton,
                      child: Center(child: AppIcon.settings()),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
