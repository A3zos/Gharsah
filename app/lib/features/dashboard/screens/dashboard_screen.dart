import 'package:flutter/material.dart';

import '../../../core/arabic_digits.dart';
import '../../../core/mock_data.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/decor_blob.dart';
import '../../../widgets/g_page_header.dart';
import '../../../widgets/growth_timeline.dart';
import '../../../core/app_scope.dart';
import '../../children/data/child_profile.dart';
import '../../children/data/children_repository.dart';
import '../widgets/detail_panels.dart';

/// Frames 12–16 — «لوحة التحكم» (view-only): child switcher, growth hero and
/// four stat cards. The cards are an accordion inside this screen: one open
/// at a time, its panel appears under the grid (13–16). [openCard] is owned
/// by the shell so Android back can collapse it first.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({
    super.key,
    this.childId,
    required this.openCard,
    required this.onSettings,
  });

  /// Child to show (from «الإنجازات»); defaults to the first child.
  final String? childId;
  final ValueNotifier<DashCard?> openCard;
  final VoidCallback onSettings;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late String? _selectedId = widget.childId;
  Stream<List<ChildProfile>>? _children;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _children ??= AppScope.of(context).children.watchChildren();
  }

  @override
  void didUpdateWidget(DashboardScreen old) {
    super.didUpdateWidget(old);
    if (widget.childId != null && widget.childId != old.childId) {
      _selectedId = widget.childId!;
    }
  }

  void _toggle(DashCard card) =>
      widget.openCard.value = widget.openCard.value == card ? null : card;

  void _hide() => widget.openCard.value = null;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<ChildProfile>>(
      stream: _children,
      builder: (context, snap) {
        // Real children replace the design's samples as soon as one exists.
        final children = childrenOrSample(snap.data);
        final child = children.firstWhere(
          (c) => c.id == _selectedId,
          orElse: () => children.first,
        );
        // TODO(phase-d): per-child stats from Firestore; design sample until then.
        const stats = MockData.stats;
        // As in the design, the selected child's chip comes first.
        final ordered = [child, ...children.where((c) => c.id != child.id)];

        return ValueListenableBuilder<DashCard?>(
          valueListenable: widget.openCard,
          builder: (context, open, _) => ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.pagePaddingH,
              30 - GPageHeader.targetExtra,
              AppSizes.pagePaddingH,
              22,
            ),
            children: [
              GPageHeader(title: 'لوحة التحكم', onSettings: widget.onSettings),
              const SizedBox(height: 18 - GPageHeader.targetExtra),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final c in ordered) ...[
                      if (c != ordered.first) const SizedBox(width: 10),
                      _ChildChip(
                        child: c,
                        selected: c.id == child.id,
                        onTap: () => setState(() => _selectedId = c.id),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _GrowthHero(name: child.name, stats: stats),
              const SizedBox(height: 18),
              _StatGrid(stats: stats, open: open, onTap: _toggle),
              const SizedBox(height: 18),
              switch (open) {
                null => Text(
                  'اضغط أي بطاقة لعرض تفاصيلها.',
                  style: AppTextStyles.caption,
                  textAlign: TextAlign.center,
                ),
                DashCard.projects => ProjectsPanel(
                  childName: child.name,
                  onHide: _hide,
                ),
                DashCard.surahs => SurahsPanel(onHide: _hide),
                DashCard.hadith => HadithPanel(
                  childName: child.name,
                  onHide: _hide,
                ),
                DashCard.ayat => AyatPanel(total: stats.ayat, onHide: _hide),
              },
            ],
          ),
        );
      },
    );
  }
}

class _ChildChip extends StatelessWidget {
  const _ChildChip({
    required this.child,
    required this.selected,
    required this.onTap,
  });

  final ChildProfile child;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: child.name,
      excludeSemantics: true,
      child: Material(
        color: selected ? AppColors.deepGreen : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.childChip),
          side: selected
              ? BorderSide.none
              : const BorderSide(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Container(
            height: AppSizes.childChipHeight,
            // Design: padding 0 16px 0 10px → start 16, end 10 in RTL.
            padding: const EdgeInsetsDirectional.only(start: 10, end: 16),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppIcon.childAvatar(
                  child.avatarId,
                  size: AppSizes.chipAvatar,
                  variant: AvatarVariant.chip,
                ),
                const SizedBox(width: 8),
                Text(
                  child.name,
                  style: AppTextStyles.chipLabel.copyWith(
                    color: selected ? AppColors.surface : AppColors.textDark,
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

class _GrowthHero extends StatelessWidget {
  const _GrowthHero({required this.name, required this.stats});

  final String name;
  final ChildStats stats;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final stage = GrowthTimeline.stageOf(stats.yearProgress);
    const stageNames = ['بذرة', 'غَرْسة', 'شجرة'];
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        boxShadow: AppShadows.card,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          DecorBlob(
            top: -80,
            left: -70,
            size: 230,
            color: AppColors.blobGreenFaint,
          ),
          DecorBlob(
            bottom: -60,
            right: -50,
            size: 160,
            color: AppColors.blobGoldFaint,
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(name, style: t.headlineSmall)),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.borderSoft,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        'الشهر ${stats.month.arabicDigits} · الأسبوع ${stats.week.arabicDigits}',
                        style: AppTextStyles.chip.copyWith(
                          color: AppColors.textDark,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Center(child: AppIcon.growthArt(stage)),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text.rich(
                        TextSpan(
                          text: 'المرحلة الحالية: ',
                          style: AppTextStyles.priceUnit,
                          children: [
                            TextSpan(
                              text: stageNames[stage],
                              style: const TextStyle(
                                color: AppColors.deepGreen,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${stats.yearProgress.arabicDigits}٪',
                      style: AppTextStyles.percent,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Semantics(
                  label: 'التقدّم في الخطة السنوية',
                  value: '${stats.yearProgress.arabicDigits}٪',
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.progress),
                    child: SizedBox(
                      height: AppSizes.progressHeight,
                      child: Stack(
                        children: [
                          const Positioned.fill(
                            child: ColoredBox(color: AppColors.borderSoft),
                          ),
                          FractionallySizedBox(
                            alignment: AlignmentDirectional.centerStart,
                            widthFactor: stats.yearProgress / 100,
                            heightFactor: 1,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(
                                  AppRadii.progress,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text('من الخطة السنوية', style: AppTextStyles.tiny),
                const SizedBox(height: 14),
                GrowthTimeline(progress: stats.yearProgress, topPadding: 6),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({
    required this.stats,
    required this.open,
    required this.onTap,
  });

  final ChildStats stats;
  final DashCard? open;
  final ValueChanged<DashCard> onTap;

  @override
  Widget build(BuildContext context) {
    Widget row(Widget a, Widget b) => IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: a),
          const SizedBox(width: 12),
          Expanded(child: b),
        ],
      ),
    );
    Widget card(DashCard c, Widget icon, Color tint, int value, String label) =>
        _StatCard(
          icon: icon,
          tint: tint,
          value: value,
          label: label,
          open: open == c,
          onTap: () => onTap(c),
        );
    return Column(
      children: [
        row(
          card(
            DashCard.surahs,
            AppIcon.statSurahs(),
            AppColors.greenTint,
            stats.surahs,
            'السور المنجزة',
          ),
          card(
            DashCard.ayat,
            AppIcon.statAyat(),
            AppColors.skyTint,
            stats.ayat,
            'الآيات المحفوظة',
          ),
        ),
        const SizedBox(height: 12),
        row(
          card(
            DashCard.hadith,
            AppIcon.statHadith(),
            AppColors.berryTint,
            stats.hadith,
            'الأحاديث',
          ),
          card(
            DashCard.projects,
            AppIcon.statProjects(),
            AppColors.goldTint,
            stats.projects,
            'المشاريع المنجزة',
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.tint,
    required this.value,
    required this.label,
    required this.open,
    required this.onTap,
  });

  final Widget icon;
  final Color tint;
  final int value;
  final String label;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppRadii.statCard),
      side: BorderSide(
        color: open ? AppColors.deepGreen : AppColors.border,
        width: open ? AppSizes.selectedBorderWidth : AppSizes.borderWidth,
      ),
    );
    return Semantics(
      button: true,
      expanded: open,
      label: '$label: ${value.arabicDigits}',
      excludeSemantics: true,
      child: Material(
        color: open ? AppColors.greenTint : AppColors.surface,
        shape: shape,
        child: InkWell(
          onTap: onTap,
          customBorder: shape,
          child: Container(
            constraints: const BoxConstraints(
              minHeight: AppSizes.statCardMinHeight,
            ),
            padding: const EdgeInsets.all(16),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: AppSizes.statIcon,
                      height: AppSizes.statIcon,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        // As in the design, a green-tint icon box turns white
                        // on the open (green-tint) card so it stays visible.
                        color: open && tint == AppColors.greenTint
                            ? AppColors.surface
                            : tint,
                        borderRadius: BorderRadius.circular(AppRadii.statIcon),
                      ),
                      child: icon,
                    ),
                    const SizedBox(height: 6),
                    Text(value.arabicDigits, style: AppTextStyles.statNumber),
                    const SizedBox(height: 6),
                    Text(
                      label,
                      style: open
                          ? AppTextStyles.priceUnit.copyWith(
                              color: AppColors.deepGreen,
                              fontWeight: FontWeight.w800,
                            )
                          : AppTextStyles.priceUnit,
                    ),
                  ],
                ),
                // Design: chevron at top 18 / left 16 of the card (padding is 16).
                PositionedDirectional(
                  top: 2,
                  end: 0,
                  child: open
                      ? AppIcon.chevronUp(color: AppColors.deepGreen)
                      : AppIcon.chevronDown(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
