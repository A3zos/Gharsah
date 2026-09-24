import 'dart:async';
import 'dart:math' as math;

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';

import '../../../core/arabic_digits.dart';
import '../../../widgets/confirm_sheet.dart';
import '../data/dashboard_data.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/info_note.dart';

/// The four accordion cards of the dashboard (frames 13–16).
/// Right column (first in RTL): surahs, hadith. Left column: ayat, projects.
enum DashCard { surahs, ayat, hadith, projects }

extension DashCardSide on DashCard {
  /// True when the card sits in the left column (the caret points left).
  bool get inLeftColumn => this == DashCard.ayat || this == DashCard.projects;
}

/// White panel under the grid with a caret pointing at the open card.
class DetailPanel extends StatelessWidget {
  const DetailPanel({
    super.key,
    required this.card,
    required this.title,
    this.subtitle,
    required this.onHide,
    required this.children,
  });

  final DashCard card;
  final String title;
  final String? subtitle;
  final VoidCallback onHide;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        // Design: caret at 24% from the card's outer edge, 9px above the panel.
        final caretOffset = box.maxWidth * 0.24;
        return Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.detailPanel),
                border: Border.all(
                  color: AppColors.border,
                  width: AppSizes.borderWidth,
                ),
                boxShadow: AppShadows.childCard,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: AppTextStyles.cardTitleSmall),
                            if (subtitle != null) ...[
                              const SizedBox(height: 3),
                              Text(subtitle!, style: AppTextStyles.small),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      _HideButton(onTap: onHide),
                    ],
                  ),
                  for (final c in children) ...[const SizedBox(height: 14), c],
                ],
              ),
            ),
            Positioned(
              top: -9,
              left: card.inLeftColumn ? caretOffset : null,
              right: card.inLeftColumn ? null : caretOffset,
              child: Transform.rotate(
                angle: -math.pi / 4,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    border: Border(
                      top: BorderSide(
                        color: AppColors.border,
                        width: AppSizes.borderWidth,
                      ),
                      right: BorderSide(
                        color: AppColors.border,
                        width: AppSizes.borderWidth,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _HideButton extends StatelessWidget {
  const _HideButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // 40px pill (design) inside a 48px tap target.
    return Semantics(
      button: true,
      label: 'إخفاء التفاصيل',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          height: AppSizes.minTouch,
          child: Center(
            child: Container(
              height: AppSizes.hideButtonHeight,
              padding: const EdgeInsets.symmetric(horizontal: 13),
              decoration: BoxDecoration(
                color: AppColors.borderSoft,
                borderRadius: BorderRadius.circular(AppRadii.hideButton),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('إخفاء', style: AppTextStyles.priceUnit),
                  const SizedBox(width: 6),
                  AppIcon.chevronUp(
                    size: AppSizes.iconSm,
                    color: AppColors.textMuted,
                    stroke: 2.4,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Small rounded status chip («مكتمل ✓», «تم الحفظ», «قيد التنفيذ»…).
class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.text,
    this.gold = false,
    this.onWhite = false,
    this.check = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
  });

  final String text;
  final bool gold;
  final bool onWhite;
  final bool check;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final fg = gold ? AppColors.warningText : AppColors.deepGreen;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: onWhite
            ? AppColors.surface
            : gold
            ? AppColors.goldTint
            : AppColors.greenTint,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (check) ...[
            AppIcon.tick(size: 12, color: AppColors.deepGreen),
            const SizedBox(width: 5),
          ],
          Text(text, style: AppTextStyles.statusChip.copyWith(color: fg)),
        ],
      ),
    );
  }
}

/// «سورة الناس ... ١٤ رجب [تم الحفظ]» rows (14, 15).
class DoneRow extends StatelessWidget {
  const DoneRow({
    super.key,
    required this.name,
    required this.date,
    required this.chip,
  });

  final String name;
  final String date;
  final String chip;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppRadii.listRow),
      ),
      child: Row(
        children: [
          Container(
            width: AppSizes.listCheck,
            height: AppSizes.listCheck,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.greenTint,
              shape: BoxShape.circle,
            ),
            child: AppIcon.tick(
              size: 15,
              color: AppColors.deepGreen,
              stroke: 3.4,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(child: Text(name, style: AppTextStyles.chipLabel)),
          const SizedBox(width: 11),
          Text(date, style: AppTextStyles.tiny),
          const SizedBox(width: 11),
          StatusChip(
            text: chip,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────── 13 · Projects ─────────────────────────────

/// One finished project in 13: the child's own recording (real) or the
/// design sample.
class ProjectEntry {
  const ProjectEntry({
    required this.title,
    required this.date,
    required this.duration,
    required this.loadAudio,
    this.note,
    this.onDelete,
  });

  final String title;
  final String date;
  final Duration duration;

  /// The child's words as text — only in the design sample; real reports
  /// are voice only (never transcribed).
  final String? note;
  final Future<Source> Function() loadAudio;

  /// Parent deletes the recording (null for samples).
  final Future<void> Function()? onDelete;
}

class ProjectsPanel extends StatefulWidget {
  const ProjectsPanel({
    super.key,
    required this.childName,
    required this.entries,
    required this.pendingProject,
    required this.onHide,
  });

  final String childName;
  final List<ProjectEntry> entries;
  final String? pendingProject;
  final VoidCallback onHide;

  @override
  State<ProjectsPanel> createState() => _ProjectsPanelState();
}

class _ProjectsPanelState extends State<ProjectsPanel> {
  final AudioPlayer _player = AudioPlayer();
  final List<StreamSubscription<Object?>> _subs = [];
  int _playing = -1;
  Duration _position = Duration.zero;
  Duration? _duration;

  @override
  void initState() {
    super.initState();
    _subs
      ..add(
        _player.onPositionChanged.listen((p) => setState(() => _position = p)),
      )
      ..add(
        _player.onDurationChanged.listen((d) => setState(() => _duration = d)),
      )
      ..add(
        _player.onPlayerComplete.listen(
          (_) => setState(() {
            _playing = -1;
            _position = Duration.zero;
          }),
        ),
      );
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle(int i) async {
    if (_playing == i) {
      await _player.pause();
      setState(() => _playing = -1);
      return;
    }
    setState(() {
      _playing = i;
      _position = Duration.zero;
      _duration = null;
    });
    await _player.stop();
    try {
      await _player.play(await widget.entries[i].loadAudio());
    } catch (e) {
      debugPrint('Recording not playable: $e');
      if (mounted) setState(() => _playing = -1);
    }
  }

  Future<void> _delete(int i) async {
    final entry = widget.entries[i];
    final ok = await showConfirmSheet(
      context,
      title: 'حذف التسجيل',
      message:
          'سيُحذف تسجيل ${widget.childName} لمشروع «${entry.title}» نهائيًا.',
      confirmLabel: 'حذف',
      destructive: true,
    );
    if (!ok) return;
    if (_playing == i) {
      await _player.stop();
      if (mounted) setState(() => _playing = -1);
    }
    await entry.onDelete!();
  }

  @override
  Widget build(BuildContext context) {
    final projects = widget.entries;
    final pending = widget.pendingProject;
    return DetailPanel(
      card: DashCard.projects,
      title: 'المشاريع العملية',
      subtitle:
          '${projects.length.arabicDigits} منجزة · ${(pending == null ? 0 : 1).arabicDigits} قيد التنفيذ',
      onHide: widget.onHide,
      children: [
        for (var i = 0; i < projects.length; i++)
          _ProjectCard(
            project: projects[i],
            childName: widget.childName,
            playing: _playing == i,
            fraction: _playing == i && (_duration?.inMilliseconds ?? 0) > 0
                ? _position.inMilliseconds / _duration!.inMilliseconds
                : 0,
            position: _playing == i ? _position : Duration.zero,
            duration: _playing == i ? _duration : null,
            onToggle: () => _toggle(i),
            onDelete: projects[i].onDelete == null ? null : () => _delete(i),
          ),
        if (pending != null)
          _PendingProject(title: pending, childName: widget.childName),
        const InfoNote(
          tone: InfoNoteTone.greenInfo,
          lineHeight: 1.8,
          text: 'التسجيلات للاستماع فقط — تبقى داخل حسابك ولا تُنشر.',
        ),
      ],
    );
  }
}

String _clock(Duration d) {
  final s = d.inSeconds;
  return '${(s ~/ 60).arabicDigits}:${(s % 60).toString().padLeft(2, '0').arabicDigits}';
}

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({
    required this.project,
    required this.childName,
    required this.playing,
    required this.fraction,
    required this.position,
    required this.duration,
    required this.onToggle,
    this.onDelete,
  });

  final ProjectEntry project;
  final String childName;
  final bool playing;
  final double fraction;
  final Duration position;
  final Duration? duration;
  final VoidCallback onToggle;
  final VoidCallback? onDelete;

  // Waveform bar heights from the design.
  static const _bars = [
    8,
    14,
    21,
    27,
    18,
    11,
    23,
    30,
    24,
    16,
    10,
    19,
    26,
    22,
    13,
    20,
    28,
    17,
    12,
    16,
    25,
    30,
    21,
    14,
    9,
    18,
    23,
    16,
    11,
    8,
  ];

  @override
  Widget build(BuildContext context) {
    final played = (fraction * _bars.length).round();
    final total = duration ?? project.duration;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(AppRadii.projectCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(project.title, style: AppTextStyles.itemTitle),
              ),
              const SizedBox(width: 10),
              const StatusChip(text: 'مكتمل', check: true),
            ],
          ),
          const SizedBox(height: 10),
          Text(project.date, style: AppTextStyles.small),
          const SizedBox(height: 10),
          if (project.note != null) ...[
            Text(
              project.note!,
              style: AppTextStyles.body13.copyWith(
                color: AppColors.textDark,
                height: 1.8,
              ),
            ),
            const SizedBox(height: 10),
          ],
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.player),
              border: Border.all(
                color: AppColors.border,
                width: AppSizes.borderWidth,
              ),
            ),
            child: Row(
              children: [
                Semantics(
                  button: true,
                  label:
                      '${playing ? 'إيقاف' : 'تشغيل'} تسجيل ${project.title}',
                  excludeSemantics: true,
                  child: Material(
                    color: AppColors.deepGreen,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: onToggle,
                      child: SizedBox.square(
                        dimension: AppSizes.playButton,
                        child: Center(
                          child: playing
                              ? AppIcon.pauseWhite()
                              : AppIcon.playWhite(),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        height: AppSizes.waveHeight,
                        child: Row(
                          children: [
                            for (var j = 0; j < _bars.length; j++) ...[
                              if (j > 0) const SizedBox(width: 3),
                              Container(
                                width: 3,
                                height: _bars[j].toDouble(),
                                decoration: BoxDecoration(
                                  color: j < played
                                      ? AppColors.primary
                                      : AppColors.stageOffLeaf,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 7),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _clock(position),
                            style: AppTextStyles.tiny.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text('بصوت $childName', style: AppTextStyles.tiny),
                          Text(
                            _clock(total),
                            style: AppTextStyles.tiny.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (onDelete != null)
            // TODO(design): no designed delete control for a recording yet.
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton(
                onPressed: onDelete,
                child: Text(
                  'حذف التسجيل',
                  style: AppTextStyles.linkSmall.copyWith(
                    color: AppColors.berryDeep,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PendingProject extends StatelessWidget {
  const _PendingProject({required this.title, required this.childName});

  final String title;
  final String childName;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      // Drawn over the card's fill so the dashes stay visible.
      foregroundPainter: _DashedRRectPainter(
        color: AppColors.borderStrong,
        radius: AppRadii.projectCard,
        strokeWidth: AppSizes.borderWidth,
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(AppRadii.projectCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: AppTextStyles.itemTitle.copyWith(
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                const StatusChip(text: 'قيد التنفيذ', gold: true),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                AppIcon.mic(),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'لم يُسجّل بعد — يظهر تسجيل $childName هنا فور إتمام المشروع.',
                    style: AppTextStyles.caption.copyWith(height: 1.7),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 1.5px dashed rounded border (the design's `border: dashed`).
class _DashedRRectPainter extends CustomPainter {
  _DashedRRectPainter({
    required this.color,
    required this.radius,
    required this.strokeWidth,
  });

  final Color color;
  final double radius;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    final rrect = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(strokeWidth / 2),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    const dash = 5.0, gap = 4.0;
    for (final metric in path.computeMetrics()) {
      for (double d = 0; d < metric.length; d += dash + gap) {
        canvas.drawPath(metric.extractPath(d, d + dash), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRRectPainter old) =>
      old.color != color || old.radius != radius;
}

// ───────────────────────────── 14 · Surahs ─────────────────────────────

class SurahsPanel extends StatelessWidget {
  const SurahsPanel({super.key, required this.data, required this.onHide});

  final DashboardData data;
  final VoidCallback onHide;

  @override
  Widget build(BuildContext context) {
    final done = data.surahsDone;
    final current = data.surahInProgress;
    return DetailPanel(
      card: DashCard.surahs,
      title: 'السور',
      subtitle:
          '${done.length.arabicDigits} مكتملة · ${(current == null ? 0 : 1).arabicDigits} قيد الحفظ',
      onHide: onHide,
      children: [
        if (current != null)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.goldTint,
              borderRadius: BorderRadius.circular(AppRadii.projectCard),
              border: Border.all(
                color: AppColors.goldBorder,
                width: AppSizes.borderWidth,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      width: AppSizes.clockBadge,
                      height: AppSizes.clockBadge,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: AppColors.surface,
                        shape: BoxShape.circle,
                      ),
                      child: AppIcon.clock(
                        size: AppSizes.iconXs,
                        color: AppColors.warningText,
                      ),
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(
                        current.name,
                        style: AppTextStyles.actionLabel.copyWith(
                          color: AppColors.textDark,
                        ),
                      ),
                    ),
                    const SizedBox(width: 11),
                    const StatusChip(
                      text: 'قيد الحفظ',
                      gold: true,
                      onWhite: true,
                    ),
                  ],
                ),
                const SizedBox(height: 11),
                Row(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadii.miniBar),
                        child: SizedBox(
                          height: AppSizes.miniBarHeight,
                          child: Stack(
                            children: [
                              const Positioned.fill(
                                child: ColoredBox(color: AppColors.surface),
                              ),
                              FractionallySizedBox(
                                alignment: AlignmentDirectional.centerStart,
                                widthFactor: current.percent / 100,
                                heightFactor: 1,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: AppColors.gold,
                                    borderRadius: BorderRadius.circular(
                                      AppRadii.miniBar,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${current.percent.arabicDigits}٪',
                      style: AppTextStyles.small.copyWith(
                        color: AppColors.warningText,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsetsDirectional.only(start: 4),
          child: Text(
            'مكتملة',
            style: AppTextStyles.small.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        Column(
          children: [
            for (final s in done) ...[
              if (s != done.first) const SizedBox(height: 8),
              DoneRow(name: s.name, date: s.date, chip: 'تم الحفظ'),
            ],
          ],
        ),
      ],
    );
  }
}

// ───────────────────────────── 15 · Hadith ─────────────────────────────

class HadithPanel extends StatelessWidget {
  const HadithPanel({
    super.key,
    required this.childName,
    required this.data,
    required this.onHide,
  });

  final String childName;
  final DashboardData data;
  final VoidCallback onHide;

  @override
  Widget build(BuildContext context) {
    final done = data.hadithDone;
    return DetailPanel(
      card: DashCard.hadith,
      title: 'الأحاديث',
      subtitle: '${done.length.arabicDigits} أحاديث مكتملة',
      onHide: onHide,
      children: [
        Column(
          children: [
            for (final h in done) ...[
              if (h != done.first) const SizedBox(height: 8),
              DoneRow(name: h.name, date: h.date, chip: 'تم'),
            ],
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
          decoration: BoxDecoration(
            color: AppColors.berryTint,
            borderRadius: BorderRadius.circular(AppRadii.note),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: AppIcon.leaves(),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'كل حديث يقابله مشروع عملي يطبّقه $childName في بيته أو حيّه.',
                  style: Theme.of(context).textTheme.bodySmall!
                      .copyWith(height: 1.8),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ───────────────────────────── 16 · Ayat ─────────────────────────────

class AyatPanel extends StatelessWidget {
  const AyatPanel({super.key, required this.data, required this.onHide});

  final DashboardData data;
  final VoidCallback onHide;

  @override
  Widget build(BuildContext context) {
    final latest = data.ayatLatest;
    final surahCount =
        data.ayatSurahs.length + (data.ayatInProgress == null ? 0 : 1);
    Widget chip(String text, {bool gold = false}) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
      decoration: BoxDecoration(
        color: gold ? AppColors.goldTint : AppColors.background,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(
          color: gold ? AppColors.goldBorder : AppColors.border,
        ),
      ),
      child: Text(
        text,
        style: AppTextStyles.caption.copyWith(
          fontWeight: FontWeight.w700,
          color: gold ? AppColors.warningText : AppColors.textDark,
        ),
      ),
    );
    return DetailPanel(
      card: DashCard.ayat,
      title: 'الآيات المحفوظة',
      onHide: onHide,
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.skyTint,
            borderRadius: BorderRadius.circular(AppRadii.summaryCard),
          ),
          child: Row(
            children: [
              Text(
                data.stats.ayat.arabicDigits,
                style: AppTextStyles.summaryNumber,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('آية محفوظة', style: AppTextStyles.optionLabel),
                    const SizedBox(height: 4),
                    Text(
                      'موزّعة على ${surahCount.arabicDigits} سور قصيرة',
                      style: AppTextStyles.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final s in data.ayatSurahs) chip(s),
            if (data.ayatInProgress != null)
              chip('${data.ayatInProgress} · قيد الحفظ', gold: true),
          ],
        ),
        if (latest != null)
          Row(
            children: [
              AppIcon.sproutTiny(),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  'آخر إضافة: ${latest.count.arabicDigits} آيات هذا الأسبوع من سورة ${latest.surah}.',
                  style: AppTextStyles.caption.copyWith(height: 1.7),
                ),
              ),
            ],
          ),
      ],
    );
  }
}
