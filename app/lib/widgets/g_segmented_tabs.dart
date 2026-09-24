import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class GSegment {
  const GSegment({required this.label, required this.icon});

  final String label;

  /// Builds the icon in the given (selected / unselected) color.
  final Widget Function(Color color) icon;
}

/// Two-way segmented tab control (frame 03: «ولي الأمر» / «الطفل»).
class GSegmentedTabs extends StatelessWidget {
  const GSegmentedTabs({
    super.key,
    required this.segments,
    required this.selected,
    required this.onChanged,
  });

  final List<GSegment> segments;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.titleSmall!;
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: AppColors.borderSoft,
        borderRadius: BorderRadius.circular(AppRadii.tabTrack),
      ),
      child: Row(
        children: [
          for (var i = 0; i < segments.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(child: _tab(i, style)),
          ],
        ],
      ),
    );
  }

  Widget _tab(int i, TextStyle style) {
    final on = i == selected;
    final fg = on ? AppColors.deepGreen : AppColors.textMuted;
    return Semantics(
      selected: on,
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onChanged(i),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: AppSizes.tabHeight,
          decoration: BoxDecoration(
            color: on
                ? AppColors.surface
                : AppColors.borderSoft.withValues(alpha: 0),
            borderRadius: BorderRadius.circular(AppRadii.tab),
            boxShadow: on ? AppShadows.tab : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              segments[i].icon(fg),
              const SizedBox(width: 8),
              Text(segments[i].label, style: style.copyWith(color: fg)),
            ],
          ),
        ),
      ),
    );
  }
}
