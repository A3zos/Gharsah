import 'package:flutter/material.dart';

import '../../../core/arabic_digits.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';

/// «البيانات — الجدول — الشخصية» (frames 07, 08–10). Steps before [current]
/// show the green ✓, the current step is highlighted, later steps are muted.
class AddChildStepper extends StatelessWidget {
  const AddChildStepper({super.key, required this.current});

  final int current;

  static const _labels = ['البيانات', 'الجدول', 'الشخصية'];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < _labels.length; i++) ...[
          if (i > 0)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Container(
                  height: 2,
                  decoration: BoxDecoration(
                    color: AppColors.borderStrong,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          _pill(i),
        ],
      ],
    );
  }

  Widget _pill(int i) {
    final on = i == current;
    final done = i < current;
    final Widget badge;
    if (done) {
      badge = Container(
        width: AppSizes.stepNumber,
        height: AppSizes.stepNumber,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.primary,
          shape: BoxShape.circle,
        ),
        child: AppIcon.tick(size: 12),
      );
    } else {
      badge = Container(
        width: AppSizes.stepNumber,
        height: AppSizes.stepNumber,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? AppColors.deepGreen : AppColors.borderStrong,
          shape: BoxShape.circle,
        ),
        child: Text(
          (i + 1).arabicDigits,
          style: AppTextStyles.stepNumber.copyWith(
            color: on ? AppColors.surface : AppColors.textMuted,
            height: 1,
          ),
        ),
      );
    }
    return Semantics(
      label:
          'الخطوة ${(i + 1).arabicDigits}: ${_labels[i]}${done ? ' — مكتملة' : ''}',
      selected: on,
      excludeSemantics: true,
      child: Container(
        height: AppSizes.stepPillHeight,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: on ? AppColors.greenTint : AppColors.borderSoft,
          borderRadius: BorderRadius.circular(AppRadii.stepPill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            badge,
            const SizedBox(width: 7),
            Text(
              _labels[i],
              style: AppTextStyles.stepLabel.copyWith(
                color: on ? AppColors.deepGreen : AppColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
