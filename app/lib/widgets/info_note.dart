import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'app_icons.dart';

/// green = shield ✓ (login), greenInfo = (i) (add child), gold = (i) (child tab).
enum InfoNoteTone { green, greenInfo, gold }

/// Tinted note with a leading icon (frame 03: parent shield note / child info note).
class InfoNote extends StatelessWidget {
  const InfoNote({
    super.key,
    required this.text,
    this.tone = InfoNoteTone.green,
    this.lineHeight,
  });

  /// Overrides the text line height (AddChild uses 1.8).
  final double? lineHeight;

  final String text;
  final InfoNoteTone tone;

  @override
  Widget build(BuildContext context) {
    final green = tone != InfoNoteTone.gold;
    final style = Theme.of(context).textTheme.bodySmall!.copyWith(
      color: green ? AppColors.textDark : AppColors.onGold,
      height: lineHeight,
    );
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: green ? AppColors.greenTint : AppColors.goldTint,
        borderRadius: BorderRadius.circular(AppRadii.note),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: switch (tone) {
              InfoNoteTone.green => AppIcon.shieldCheck(),
              InfoNoteTone.greenInfo => AppIcon.infoGreen(),
              InfoNoteTone.gold => AppIcon.info(),
            },
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: style)),
        ],
      ),
    );
  }
}
