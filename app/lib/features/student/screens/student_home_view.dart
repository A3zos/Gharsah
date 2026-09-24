import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../core/arabic_digits.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/decor_blob.dart';
import '../../lesson/widgets/live_widgets.dart';
import '../data/leaderboard.dart';

String _hex(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// «حصة اليوم» hero.
class TodayHero {
  const TodayHero({
    required this.chips,
    required this.doneSteps,
    required this.totalSteps,
    this.minutes = 15,
    this.finishedToday = false,
  });

  /// (label, isHadith)
  final List<(String, bool)> chips;
  final int doneSteps;
  final int totalSteps;
  final int minutes;

  /// TODO(design): no designed «done for today» state.
  final bool finishedToday;

  bool get started => doneSteps > 0 && !finishedToday;
}

class StudentHomeData {
  const StudentHomeData({
    required this.name,
    required this.avatarId,
    required this.stage,
    required this.streak,
    required this.surahs,
    required this.hadith,
    required this.projects,
    required this.hero,
    required this.leaders,
    required this.leaderNote,
    required this.daysLeftInWeek,
  });

  final String name;
  final String avatarId;

  /// «بذرة» / «غَرْسة» / «شجرة»
  final String stage;
  final int streak;
  final int surahs;
  final int hadith;
  final int projects;
  final TodayHero? hero;

  /// Anonymous board rows (see student/data/leaderboard.dart).
  final List<BoardRow> leaders;
  final String? leaderNote;
  final int daysLeftInWeek;
}

/// Frame 17 — the child's home (rendered from [data] only).
class StudentHomeView extends StatelessWidget {
  const StudentHomeView({super.key, required this.data, required this.onStart});

  final StudentHomeData data;
  final VoidCallback? onStart;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          DecorBlob(
            top: -160,
            left: -130,
            size: 360,
            color: AppColors.blobGreenStrong,
          ),
          SafeArea(
            bottom: false,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                20,
                28,
                20,
                110 - LessonSizes.studentNavHeight + 20,
              ),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: AppSizes.maxContentWidth,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _header(),
                        const SizedBox(height: 18),
                        _leaderboard(),
                        const SizedBox(height: 18),
                        if (data.hero != null) ...[
                          _hero(),
                          const SizedBox(height: 18),
                        ],
                        _shortcuts(),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: const _StudentNav(),
    );
  }

  Widget _chip(Color bg, Widget lead, String text, Color fg, double gap) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            lead,
            SizedBox(width: gap),
            Text(text, style: LessonText.chip.copyWith(color: fg)),
          ],
        ),
      );

  Widget _header() => Row(
    children: [
      PopIn(
        child: AppIcon.childAvatar(data.avatarId, size: LessonSizes.homeAvatar),
      ),
      const SizedBox(width: 13),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('مرحبًا ${data.name}', style: LessonText.greeting),
            const SizedBox(height: 7),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                _chip(
                  AppColors.greenTint,
                  SvgPicture.string(_sproutIcon, width: 15, height: 15),
                  'مرحلتك: ${data.stage}',
                  AppColors.deepGreen,
                  6,
                ),
                _chip(
                  AppColors.goldTint,
                  Looping(
                    duration: const Duration(milliseconds: 1800),
                    builder: (context, t, child) {
                      final w = 0.5 - 0.5 * math.cos(2 * math.pi * t);
                      return Transform.rotate(
                        angle: (-2 + 5 * w) * math.pi / 180,
                        child: Transform.scale(
                          scale: 1 + 0.12 * w,
                          child: child,
                        ),
                      );
                    },
                    child: SvgPicture.string(_flameIcon, width: 14, height: 14),
                  ),
                  '${data.streak.arabicDigits} ${_days(data.streak)} متتالية',
                  AppColors.warningText,
                  5,
                ),
              ],
            ),
          ],
        ),
      ),
      // TODO(design): «ملفّي» has no designed screen yet.
      Container(
        width: AppSizes.headerButton,
        height: AppSizes.headerButton,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(LessonRadii.profileButton),
          border: Border.all(color: AppColors.border),
        ),
        alignment: Alignment.center,
        child: SvgPicture.string(
          _personIcon(AppColors.textDark, 1.9),
          width: 21,
          height: 21,
        ),
      ),
    ],
  );

  static String _days(int n) => n >= 3 && n <= 10 ? 'أيام' : 'يوم';

  Widget _leaderboard() => Container(
    padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(LessonRadii.homeCard),
      boxShadow: AppShadows.card,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            SvgPicture.string(_trophyIcon, width: 22, height: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'المتصدّرون هذا الأسبوع',
                style: LessonText.cardTitle,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.borderSoft,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: Text(
                'يتبقّى ${data.daysLeftInWeek.arabicDigits} ${_days(data.daysLeftInWeek)}',
                style: LessonText.pillSmall,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < data.leaders.length; i++) ...[
          if (i > 0) const SizedBox(height: 7),
          _leaderRow(i, data.leaders[i]),
        ],
        if (data.leaderNote != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
            decoration: BoxDecoration(
              color: AppColors.greenTint,
              borderRadius: BorderRadius.circular(LessonRadii.leaderNote),
            ),
            child: Row(
              children: [
                SvgPicture.string(_starIcon, width: 20, height: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(data.leaderNote!, style: LessonText.leaderNote),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        Text(
          'تبدأ المنافسة من جديد كل أسبوع — فرصة جديدة للجميع.',
          textAlign: TextAlign.center,
          style: LessonText.tinyCenter,
        ),
      ],
    ),
  );

  Widget _leaderRow(int i, BoardRow r) {
    final (Color bg, Color fg) = switch (r.rank) {
      _ when r.me => (AppColors.deepGreen, AppColors.surface),
      1 => (AppColors.gold, AppColors.onGold),
      2 => (AppColors.medalSilver, AppColors.medalSilverText),
      3 => (AppColors.avatarSkinMid, AppColors.avatarFeatures),
      _ => (AppColors.borderSoft, AppColors.textMuted),
    };
    final ink = r.me ? AppColors.deepGreen : AppColors.textDark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: r.me ? AppColors.greenTint : AppColors.background,
        borderRadius: BorderRadius.circular(LessonRadii.leaderRow),
        border: Border.all(
          color: r.me ? AppColors.deepGreen : AppColors.borderSoft,
          width: r.me ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: LessonSizes.leaderMedal,
            height: LessonSizes.leaderMedal,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text(
              r.rank.arabicDigits,
              style: LessonText.medal.copyWith(color: fg),
            ),
          ),
          const SizedBox(width: 10),
          // The design's inline SVG leaves a 6px baseline gap under it.
          SizedBox(
            height: LessonSizes.leaderAvatar + 6,
            child: Align(
              alignment: Alignment.topCenter,
              // Other children never show a personal avatar — one generic one.
              child: r.avatarId == null
                  ? SvgPicture.string(
                      _genericAvatar,
                      width: LessonSizes.leaderAvatar,
                      height: LessonSizes.leaderAvatar,
                    )
                  : AppIcon.childAvatar(
                      r.avatarId!,
                      size: LessonSizes.leaderAvatar,
                      variant: AvatarVariant.row,
                    ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              r.me ? '${r.label} — أنت' : r.label,
              style: LessonText.leaderName.copyWith(
                color: ink,
                fontWeight: r.me ? FontWeight.w800 : FontWeight.w700,
              ),
            ),
          ),
          Text(
            r.points.arabicDigits,
            style: LessonText.leaderPoints.copyWith(color: ink),
          ),
        ],
      ),
    );
  }

  Widget _hero() {
    final h = data.hero!;
    final badge = h.finishedToday
        ? 'أكملت حصة اليوم'
        : h.started
        ? 'بدأتها اليوم'
        : 'جديدة';
    final progress = h.finishedToday || h.started
        ? 'أنجزت ${h.doneSteps.arabicDigits} من ${h.totalSteps.arabicDigits} خطوات'
        : '${h.totalSteps.arabicDigits} خطوات في انتظارك';
    final cta = h.finishedToday
        ? 'إلى اللقاء غدًا'
        : h.started
        ? 'أكمل الحصة'
        : 'ابدأ الحصة';
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.deepGreen,
        borderRadius: BorderRadius.circular(AppRadii.heroCard),
        boxShadow: AppShadows.hero,
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            top: -46,
            end: -36,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                color: AppColors.heroCircle,
                shape: BoxShape.circle,
              ),
            ),
          ),
          PositionedDirectional(
            bottom: -12,
            end: 4,
            child: Floating(
              period: const Duration(milliseconds: 3400),
              child: Opacity(
                opacity: 0.5,
                child: SvgPicture.string(_heroSprout, width: 112, height: 112),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text('حصة اليوم', style: LessonText.heroTitle),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.gold,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(badge, style: LessonText.heroBadge),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (label, hadith) in h.chips)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 13,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.heroChip,
                          borderRadius: BorderRadius.circular(
                            LessonRadii.heroChip,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SvgPicture.string(
                              hadith ? _bubbleIcon : _bookWhite,
                              width: 17,
                              height: 17,
                            ),
                            const SizedBox(width: 7),
                            Text(label, style: LessonText.heroChip),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text(progress, style: LessonText.heroProgress),
                    ),
                    Text(
                      'نحو ${h.minutes.arabicDigits} دقيقة',
                      style: LessonText.heroProgress.copyWith(
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 7),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: SizedBox(
                    height: AppSizes.progressHeight,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: ColoredBox(color: AppColors.heroTrack),
                        ),
                        FractionallySizedBox(
                          alignment: AlignmentDirectional.centerStart,
                          widthFactor: h.totalSteps == 0
                              ? 0
                              : h.doneSteps / h.totalSteps,
                          heightFactor: 1,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: AppColors.gold,
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Looping(
                  duration: const Duration(milliseconds: 2800),
                  builder: (context, t, child) => Transform.scale(
                    scale: h.finishedToday
                        ? 1
                        : 1 + 0.02 * (0.5 - 0.5 * math.cos(2 * math.pi * t)),
                    child: child,
                  ),
                  child: SizedBox(
                    height: LessonSizes.heroCtaHeight,
                    child: FilledButton(
                      onPressed: h.finishedToday ? null : onStart,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        disabledBackgroundColor: AppColors.gold.withValues(
                          alpha: 0.6,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadii.cta),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(cta, style: LessonText.heroCta),
                          if (!h.finishedToday) ...[
                            const SizedBox(width: 10),
                            SvgPicture.string(
                              _arrow(AppColors.onGold),
                              width: 24,
                              height: 24,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _shortcuts() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('تصفّح ومراجعة', style: LessonText.planTitle),
      const SizedBox(height: 11),
      // TODO(design): the three shortcuts have no designed destination yet.
      Row(
        children: [
          _shortcut(
            AppColors.greenTint,
            _bookGreen,
            'القرآن',
            '${data.surahs.arabicDigits} سور',
          ),
          const SizedBox(width: 10),
          _shortcut(
            AppColors.berryTint,
            _hadithBook,
            'الأحاديث',
            '${data.hadith.arabicDigits} أحاديث',
          ),
          const SizedBox(width: 10),
          _shortcut(
            AppColors.goldTint,
            _projectIcon,
            'المشاريع',
            '${data.projects.arabicDigits} منجزة',
          ),
        ],
      ),
    ],
  );

  Widget _shortcut(Color tint, String icon, String title, String meta) =>
      Expanded(
        child: Container(
          constraints: const BoxConstraints(
            minHeight: LessonSizes.shortcutMinHeight,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(LessonRadii.shortcut),
            border: Border.all(color: AppColors.border, width: 1.5),
            boxShadow: AppShadows.soft,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: LessonSizes.shortcutIcon,
                height: LessonSizes.shortcutIcon,
                decoration: BoxDecoration(
                  color: tint,
                  borderRadius: BorderRadius.circular(LessonRadii.shortcutIcon),
                ),
                alignment: Alignment.center,
                child: SvgPicture.string(icon, width: 28, height: 28),
              ),
              const SizedBox(height: 9),
              Text(title, style: LessonText.shortcutTitle),
              const SizedBox(height: 9),
              Text(meta, style: LessonText.shortcutMeta),
            ],
          ),
        ),
      );

  // ── design icons ──
  static String _arrow(Color c) =>
      '<svg viewBox="0 0 24 24" fill="none"><path d="M15 5 L8 12 L15 19" stroke="${_hex(c)}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  static String get _sproutIcon =>
      '''
<svg viewBox="0 0 76 76" fill="none"><path d="M38 62 V34" stroke="${_hex(AppColors.deepGreen)}" stroke-width="8" stroke-linecap="round"/>
<path d="M38 42 C28 42 22 36 22 27 C32 27 38 33 38 42 Z" fill="${_hex(AppColors.primary)}"/>
<path d="M38 47 C48 47 54 41 54 32 C44 32 38 38 38 47 Z" fill="${_hex(AppColors.softGreen)}"/></svg>''';
  static String get _flameIcon =>
      '''
<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5 C13.5 6.5 17.5 7.5 17.5 12.5 C17.5 16.6 15 19.5 12 19.5 C9 19.5 6.5 16.6 6.5 12.5 C6.5 9.5 8.5 8.5 9.5 6.5 C10 9 11 9.5 12 8 C12.5 6 12 4 12 2.5 Z" fill="${_hex(AppColors.gold)}"/>
<path d="M12 11.5 C12.8 13.2 14 14 14 15.8 C14 17.4 13 18.5 12 18.5 C11 18.5 10 17.4 10 15.8 C10 14.6 10.8 13.8 11.2 12.8 C11.5 13.6 11.7 13.8 12 13.2 Z" fill="${_hex(AppColors.berry)}"/></svg>''';
  static String _personIcon(Color c, double w) =>
      '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.6" stroke="${_hex(c)}" stroke-width="$w"/><path d="M5 19.5 C5 15.7 8.1 13.6 12 13.6 C15.9 13.6 19 15.7 19 19.5" stroke="${_hex(c)}" stroke-width="$w" stroke-linecap="round"/></svg>';
  static String get _trophyIcon =>
      '''
<svg viewBox="0 0 24 24" fill="none"><path d="M7 20 H17 M12 16.5 V20" stroke="${_hex(AppColors.goldDeep)}" stroke-width="2" stroke-linecap="round"/>
<path d="M7 3.5 H17 V9 C17 12 14.8 14.5 12 14.5 C9.2 14.5 7 12 7 9 Z" fill="${_hex(AppColors.gold)}"/>
<path d="M7 5.5 H4.5 V7 C4.5 8.9 5.6 10.3 7 10.7 M17 5.5 H19.5 V7 C19.5 8.9 18.4 10.3 17 10.7" stroke="${_hex(AppColors.goldDeep)}" stroke-width="1.8" stroke-linecap="round"/></svg>''';

  /// The one generic avatar for anonymous leaderboard rows.
  static String get _genericAvatar =>
      '''
<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="32" fill="${_hex(AppColors.borderSoft)}"/>
<circle cx="32" cy="26" r="10" fill="${_hex(AppColors.stageOffStem)}"/>
<path d="M14 54 C14 43 22 38 32 38 C42 38 50 43 50 54 Z" fill="${_hex(AppColors.stageOffStem)}"/></svg>''';
  static String get _starIcon =>
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.8 L14.3 9.2 L21 9.4 L15.7 13.5 L17.6 20 L12 16.2 L6.4 20 L8.3 13.5 L3 9.4 L9.7 9.2 Z" fill="${_hex(AppColors.primary)}"/></svg>';
  static String get _heroSprout =>
      '''
<svg viewBox="0 0 100 100" fill="none"><path d="M50 92 V46" stroke="${_hex(AppColors.softGreen)}" stroke-width="6" stroke-linecap="round"/>
<path d="M50 64 C34 64 24 55 24 40 C40 40 50 49 50 64 Z" fill="${_hex(AppColors.softGreen)}"/>
<path d="M50 56 C66 56 76 47 76 32 C60 32 50 41 50 56 Z" fill="${_hex(AppColors.leafLight)}"/></svg>''';
  static String get _bookWhite =>
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z" stroke="${_hex(AppColors.surface)}" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  static String get _bubbleIcon =>
      '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12.5 C20 16.4 16.4 19.5 12 19.5 C10.9 19.5 9.9 19.3 8.9 19 L4 20.5 L5.6 16.4 C4.6 15.3 4 14 4 12.5 C4 8.6 7.6 5.5 12 5.5 C16.4 5.5 20 8.6 20 12.5 Z" stroke="${_hex(AppColors.surface)}" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  static String get _bookGreen =>
      '''
<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9" stroke-linejoin="round"/>
<path d="M12 5.8 V18.8" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9"/></svg>''';
  static String get _hadithBook =>
      '''
<svg viewBox="0 0 24 24" fill="none"><path d="M7 4 H17 C18.7 4 20 5.3 20 7 V20 H9.5 C8 20 7 18.8 7 17.3 Z" stroke="${_hex(AppColors.berryDeep)}" stroke-width="1.9" stroke-linejoin="round"/>
<path d="M7 4 C5.3 4 4 5.3 4 7 C4 8.2 4.9 9 6 9 H7" stroke="${_hex(AppColors.berryDeep)}" stroke-width="1.9" stroke-linejoin="round"/>
<path d="M10.5 9.5 H16.5 M10.5 13 H16.5 M10.5 16.5 H14" stroke="${_hex(AppColors.berryDeep)}" stroke-width="1.7" stroke-linecap="round"/></svg>''';
  static String get _projectIcon =>
      '''
<svg viewBox="0 0 24 24" fill="none"><path d="M12 13.5 V8.5" stroke="${_hex(AppColors.deepGreen)}" stroke-width="2" stroke-linecap="round"/>
<path d="M12 10.5 C9 10.5 7.2 8.8 7.2 6 C10.2 6 12 7.7 12 10.5 Z" fill="${_hex(AppColors.primary)}"/>
<path d="M12 12 C15 12 16.8 10.3 16.8 7.5 C13.8 7.5 12 9.2 12 12 Z" fill="${_hex(AppColors.softGreen)}"/>
<path d="M3.5 15 C6 13.6 8.5 14.6 9.6 16.2 H14.4 C15.5 14.6 18 13.6 20.5 15 C19.4 18.6 16.2 20.5 12 20.5 C7.8 20.5 4.6 18.6 3.5 15 Z" fill="${_hex(AppColors.gold)}"/></svg>''';
}

/// الرئيسية / ملفّي.
class _StudentNav extends StatelessWidget {
  const _StudentNav();

  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      color: AppColors.surface,
      border: Border(top: BorderSide(color: AppColors.border)),
    ),
    child: SafeArea(
      top: false,
      child: SizedBox(
        height: LessonSizes.studentNavHeight,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _item(_homeIcon, 'الرئيسية', true),
              // TODO(design): «ملفّي» has no designed screen yet.
              _item(
                StudentHomeView._personIcon(AppColors.textMuted, 2.1),
                'ملفّي',
                false,
              ),
            ],
          ),
        ),
      ),
    ),
  );

  static String get _homeIcon =>
      '<svg viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4.5 L20 11 V19 C20 19.6 19.6 20 19 20 H5 C4.4 20 4 19.6 4 19 Z" stroke="${_hex(AppColors.deepGreen)}" stroke-width="2.3" stroke-linejoin="round"/></svg>';

  Widget _item(String icon, String label, bool active) => SizedBox(
    width: 100,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SvgPicture.string(icon, width: 26, height: 26),
          const SizedBox(height: 5),
          Text(
            label,
            style: LessonText.nav.copyWith(
              color: active ? AppColors.deepGreen : AppColors.textMuted,
              fontWeight: active ? FontWeight.w800 : FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}
