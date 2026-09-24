import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A yes/no confirmation in the same bottom-sheet style as «نسيت كلمة المرور؟».
/// TODO(design): no designed confirm step exists yet — used for «إصدار رمز
/// جديد» (11) and deleting a recording (13).
Future<bool> showConfirmSheet(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  bool destructive = false,
}) async {
  final ok = await showModalBottomSheet<bool>(
    context: context,
    useSafeArea: true,
    showDragHandle: true,
    builder: (context) {
      final t = Theme.of(context).textTheme;
      return Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.screenPaddingH,
          0,
          AppSizes.screenPaddingH,
          24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: t.headlineSmall),
            const SizedBox(height: 6),
            Text(message, style: t.bodyMedium),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: destructive
                  ? FilledButton.styleFrom(backgroundColor: AppColors.berryDeep)
                  : null,
              child: Text(confirmLabel),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('إلغاء'),
            ),
          ],
        ),
      );
    },
  );
  return ok ?? false;
}
