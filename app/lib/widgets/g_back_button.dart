import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'app_icons.dart';

/// 46px white rounded back button (frames 03/04). Sits at the start (right in RTL).
class GBackButton extends StatelessWidget {
  const GBackButton({super.key, this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        button: true,
        label: 'رجوع',
        excludeSemantics: true,
        child: Material(
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.backButton),
            side: const BorderSide(color: AppColors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed ?? () => Navigator.of(context).maybePop(),
            child: SizedBox.square(
              dimension: AppSizes.backButton,
              child: Center(child: AppIcon.back()),
            ),
          ),
        ),
      ),
    );
  }
}
