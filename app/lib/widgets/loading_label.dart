import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Button label that swaps to a small spinner while [loading].
class LoadingLabel extends StatelessWidget {
  const LoadingLabel({super.key, required this.loading, required this.label});

  final bool loading;
  final String label;

  @override
  Widget build(BuildContext context) {
    if (!loading) return Text(label);
    return Semantics(
      label: '$label — جارٍ التنفيذ',
      child: const SizedBox.square(
        dimension: AppSizes.iconLg,
        child: CircularProgressIndicator(
          strokeWidth: 2.4,
          color: AppColors.surface,
        ),
      ),
    );
  }
}
