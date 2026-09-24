import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class GNavItem {
  const GNavItem({required this.label, required this.icon});

  final String label;
  final Widget Function(Color color) icon;
}

/// White 88px bottom bar with a top hairline (05-Packages / 12-Dashboard).
/// Items are laid out in reading order (RTL: first item on the right).
class GBottomNav extends StatelessWidget {
  const GBottomNav({
    super.key,
    required this.items,
    required this.selected,
    required this.onSelected,
  });

  final List<GNavItem> items;
  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Container(
      height: AppSizes.bottomNavHeight + bottomInset,
      padding: EdgeInsets.fromLTRB(20, 12, 20, bottomInset),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [for (var i = 0; i < items.length; i++) _item(i)],
      ),
    );
  }

  Widget _item(int i) {
    final on = i == selected;
    final color = on ? AppColors.deepGreen : AppColors.textMuted;
    return Semantics(
      selected: on,
      button: true,
      label: items[i].label,
      excludeSemantics: true,
      child: InkWell(
        onTap: () => onSelected(i),
        borderRadius: BorderRadius.circular(AppRadii.chip),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minWidth: 96,
            minHeight: AppSizes.minTouch,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                items[i].icon(color),
                const SizedBox(height: 5),
                Text(
                  items[i].label,
                  style: AppTextStyles.navLabel.copyWith(
                    color: color,
                    fontWeight: on ? FontWeight.w800 : FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
