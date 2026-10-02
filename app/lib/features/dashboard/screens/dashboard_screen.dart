import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';

import '../../../core/arabic_digits.dart';
import '../../../core/mock_data.dart';
import '../../../core/time_format.dart';
import '../../../widgets/info_note.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/child_avatar.dart';
import '../../../widgets/g_page_header.dart';
import '../../../core/app_scope.dart';
import '../../children/data/child_profile.dart';
import '../data/dashboard_data.dart';
import '../data/submissions_repository.dart';
import '../data/plan_progress.dart';
import '../widgets/detail_panels.dart';
import '../widgets/plan_timeline.dart';

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
        final children = snap.data ?? const <ChildProfile>[];
        if (children.isEmpty) {
          return _NoChildren(
            onSettings: widget.onSettings,
            loading: snap.connectionState == ConnectionState.waiting,
          );
        }
        final child = children.firstWhere(
          (c) => c.id == _selectedId,
          orElse: () => children.first,
        );
        final content = AppScope.of(context).content;
        final data = DashboardData.fromChild(
          child,
          meta: content.meta,
          hadith: content.hadith,
          projects: content.projects,
        );
        final stats = data.stats;
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
              // The design's sample numbers stand in until the child's first
              // lesson — clearly marked for a real child.
              if (data.isSample && !child.isMock) ...[
                const SizedBox(height: 14),
                // TODO(design): marker for sample data (no designed state).
                InfoNote(
                  tone: InfoNoteTone.greenInfo,
                  lineHeight: 1.7,
                  text:
                      'بيانات توضيحية — تظهر إنجازات ${child.name} الحقيقية بعد أول حصة.',
                ),
              ],
              const SizedBox(height: 18),
              PlanCard(
                child: child,
                progress: PlanProgress.of(content.pilot, child),
              ),
              const SizedBox(height: 18),
              _StatGrid(stats: stats, open: open, onTap: _toggle),
              const SizedBox(height: 18),
              switch (open) {
                null => Text(
                  'اضغط أي بطاقة لعرض تفاصيلها.',
                  style: AppTextStyles.caption,
                  textAlign: TextAlign.center,
                ),
                DashCard.projects => _Projects(
                  child: child,
                  data: data,
                  onHide: _hide,
                ),
                DashCard.surahs => SurahsPanel(data: data, onHide: _hide),
                DashCard.hadith => HadithPanel(
                  childName: child.name,
                  data: data,
                  onHide: _hide,
                ),
                DashCard.ayat => AyatPanel(data: data, onHide: _hide),
              },
            ],
          ),
        );
      },
    );
  }
}

/// 13 — the child's real recordings (Storage, parent-only), or the design's
/// sample while the child has no progress yet.
class _Projects extends StatelessWidget {
  const _Projects({
    required this.child,
    required this.data,
    required this.onHide,
  });

  final ChildProfile child;
  final DashboardData data;
  final VoidCallback onHide;

  static const _sampleAudio = 'audio/placeholder_recording.wav';

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final repo = scope.submissions;
    return StreamBuilder<List<ProjectSubmission>>(
      stream: repo.watch(child.id),
      builder: (context, snap) {
        final subs = snap.data ?? const <ProjectSubmission>[];
        final List<ProjectEntry> entries;
        if (subs.isEmpty && data.isSample) {
          entries = [
            for (final p in MockData.projects)
              ProjectEntry(
                title: p.title,
                date: p.date,
                note: p.note,
                duration: Duration(seconds: p.seconds),
                loadAudio: () async => AssetSource(_sampleAudio),
              ),
          ];
        } else {
          entries = [
            for (final s in subs)
              ProjectEntry(
                title: _title(scope, s.projectId),
                date: 'اكتمل في ${formatHijriDayMonth(s.createdAt)}',
                duration: s.duration,
                // A 10-minute signed URL (private bucket, parent only).
                loadAudio: () async => UrlSource(
                  await repo.signedUrl(s),
                  mimeType: s.storagePath.endsWith('.wav')
                      ? 'audio/wav'
                      : 'audio/mp4',
                ),
                onDelete: () => repo.delete(child.id, s),
              ),
          ];
        }
        return ProjectsPanel(
          childName: child.name,
          entries: entries,
          pendingProject: data.pendingProject,
          onHide: onHide,
        );
      },
    );
  }

  static String _title(AppScope scope, String projectId) {
    try {
      return scope.content.projects.byId(projectId).title;
    } on StateError {
      return projectId;
    }
  }
}

/// TODO(design): no designed "no children yet" state for the dashboard.
class _NoChildren extends StatelessWidget {
  const _NoChildren({required this.onSettings, required this.loading});

  final VoidCallback onSettings;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.pagePaddingH,
        30 - GPageHeader.targetExtra,
        AppSizes.pagePaddingH,
        22,
      ),
      children: [
        GPageHeader(title: 'لوحة التحكم', onSettings: onSettings),
        const SizedBox(height: 18),
        if (!loading)
          const InfoNote(
            tone: InfoNoteTone.greenInfo,
            lineHeight: 1.8,
            text: 'أضف ابنك من تبويب «الباقات» لتظهر إنجازاته هنا.',
          ),
      ],
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
                ChildAvatar(child.avatarId, size: AppSizes.chipAvatar),
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
