import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../core/arabic_digits.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_icons.dart';
import '../../../widgets/decor_blob.dart';
import '../../../widgets/info_note.dart';
import '../agent/lesson_state.dart';
import '../widgets/live_widgets.dart';
import '../widgets/teacher_character.dart';

String _hex(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// What the plan card (18) and the celebration screens (19, 23) need beyond
/// the agent's state.
class LessonPlanInfo {
  const LessonPlanInfo({
    this.surahName,
    this.surahAyat,
    this.hadithTitle,
    this.hasProject = false,
  });

  final String? surahName;
  final int? surahAyat;
  final String? hadithTitle;
  final bool hasProject;
}

/// The child's totals (server `stats`) for 19 and 23.
class ChildGlance {
  const ChildGlance({
    this.surahsTotal = 0,
    this.streak = 0,
    this.streakDays = const [],
  });

  final int surahsTotal;
  final int streak;

  /// Short labels of the scheduled days in the current streak, oldest first,
  /// the last one being today («اليوم»).
  final List<String> streakDays;
}

/// Every tap the lesson screens forward — the agent decides what happens.
abstract interface class LessonActions {
  void tapTeacher();
  void micTap();
  void continueTapped();
  void replayAyah();
  void play();
  void reRecord();
  void endCall();
  void goHome();
}

/// Frames 18–23: one live "call" screen, rendered from [state] only.
class LessonView extends StatelessWidget {
  const LessonView({
    super.key,
    required this.state,
    required this.plan,
    required this.glance,
    required this.actions,
    this.level,
  });

  final LessonState state;
  final LessonPlanInfo plan;
  final ChildGlance glance;
  final LessonActions actions;
  final ValueListenable<double>? level;

  LessonScreen get _screen => state.screen;
  LessonBeat get _beat => state.beat;

  bool get _compact =>
      _screen == LessonScreen.surahDone ||
      _screen == LessonScreen.projectAssign ||
      _screen == LessonScreen.projectReport;
  bool get _end => _screen == LessonScreen.lessonEnd;

  @override
  Widget build(BuildContext context) {
    final teacherSize = _end
        ? 164.0
        : _compact
        ? 170.0
        : LessonSizes.teacher;
    final teacherBox = _end
        ? 172.0
        : _compact
        ? 178.0
        : LessonSizes.teacherBox;
    final gap = _end ? 11.0 : LessonSizes.frameGap;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          ..._blobs(),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, box) {
                // Center the 520-wide column on tablets without loosening the
                // height constraint (the Spacer pins the mic to the bottom).
                final side = ((box.maxWidth - LessonSizes.maxWidth) / 2).clamp(
                  LessonSizes.framePaddingH,
                  double.infinity,
                );
                return SingleChildScrollView(
                  padding: EdgeInsets.fromLTRB(
                    side,
                    LessonSizes.framePaddingTop,
                    side,
                    LessonSizes.framePaddingBottom,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight:
                          box.maxHeight -
                          LessonSizes.framePaddingTop -
                          LessonSizes.framePaddingBottom,
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          LiveCallHeader(
                            elapsed: state.elapsed,
                            onEnd: actions.endCall,
                          ),
                          SizedBox(height: gap),
                          TeacherCharacter(
                            mood: state.teacherQuiet
                                ? TeacherMood.quiet
                                : state.teacherListening
                                ? TeacherMood.listening
                                : TeacherMood.speaking,
                            happy: state.happy,
                            size: teacherSize,
                            boxHeight: teacherBox,
                            onTap: actions.tapTeacher,
                          ),
                          SizedBox(height: gap),
                          ConstrainedBox(
                            constraints: const BoxConstraints(
                              minHeight: LessonSizes.captionMinHeight,
                            ),
                            child: Center(
                              child: Text(
                                state.caption,
                                textAlign: TextAlign.center,
                                style: LessonText.caption.copyWith(
                                  color: state.happy
                                      ? AppColors.deepGreen
                                      : AppColors.textDark,
                                ),
                              ),
                            ),
                          ),
                          ..._problems(gap),
                          SizedBox(height: gap),
                          ..._middle(gap),
                          SizedBox(height: gap),
                          const Spacer(),
                          _bottom(),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /// Each frame's background blobs (design values; CSS left/right are physical).
  List<Widget> _blobs() => switch (_screen) {
    LessonScreen.surahDone => [
      DecorBlob(top: -140, left: -120, size: 330, color: AppColors.blobGreen10),
      DecorBlob(
        bottom: -120,
        right: -100,
        size: 280,
        color: AppColors.blobGoldStrong,
      ),
    ],
    LessonScreen.hadith => [
      DecorBlob(
        bottom: -150,
        left: -120,
        size: 360,
        color: AppColors.blobGoldStrong,
      ),
    ],
    LessonScreen.projectAssign => [
      DecorBlob(
        bottom: -150,
        left: -120,
        size: 360,
        color: AppColors.blobGold14,
      ),
    ],
    LessonScreen.projectReport => [
      DecorBlob(top: -160, left: -130, size: 380, color: AppColors.blobGreen09),
    ],
    LessonScreen.lessonEnd => [
      DecorBlob(top: -150, left: -130, size: 350, color: AppColors.blobGreen10),
      DecorBlob(
        bottom: -130,
        right: -110,
        size: 300,
        color: AppColors.blobGoldStrong,
      ),
    ],
    _ => [
      DecorBlob(
        top: -170,
        left: -140,
        size: 400,
        color: AppColors.blobGreenStrong,
      ),
    ],
  };

  /// TODO(design): mic denied / offline / save failed have no designed state;
  /// shown with the existing info-note pattern.
  List<Widget> _problems(double gap) {
    final String? text = state.micDenied
        ? 'لا أسمعك — اطلب من بابا أو ماما السماح للتطبيق باستخدام الميكروفون.'
        : state.saveFailed
        ? 'لم يُحفظ صوتك بعد — تأكّد من الإنترنت ثم اضغط السهم.'
        : state.contentUnavailable
        ? 'لا يوجد اتصال لتحميل التلاوة — اتصل بالإنترنت وحاول مجددًا.'
        : null;
    if (text == null) return const [];
    return [
      SizedBox(height: gap),
      InfoNote(tone: InfoNoteTone.gold, lineHeight: 1.7, text: text),
    ];
  }

  // ── Middle (per frame) ────────────────────────────────────────────────────

  List<Widget> _middle(double gap) => switch (_screen) {
    LessonScreen.intro => [_box(_Plan(state: state, plan: plan))],
    LessonScreen.ayah => [
      _box(
        SwapIn(
          key: ValueKey(state.ayahRef),
          child: AyahCard(
            text: state.ayahText ?? '',
            reference: state.ayahReference ?? '',
            highlighted: _beat == LessonBeat.reciting,
            onTap: actions.replayAyah,
            onPlayFallback: state.playbackBlocked ? actions.play : null,
          ),
        ),
      ),
    ],
    LessonScreen.surahDone => _surahDone(gap),
    LessonScreen.hadith => [_box(_hadith())],
    LessonScreen.projectAssign => [_ProjectAssign(state: state)],
    LessonScreen.projectReport => [
      _ProjectReport(state: state, actions: actions),
    ],
    LessonScreen.lessonEnd => _lessonEnd(gap),
    _ => const [],
  };

  Widget _box(Widget child) => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: LessonSizes.middleMinHeight),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [child],
    ),
  );

  List<Widget> _surahDone(double gap) => [
    SizedBox(
      height: LessonSizes.doneArt,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          const PositionedDirectional(
            top: -6,
            start: 62,
            child: Sparkle(
              size: 26,
              color: AppColors.gold,
              delay: Duration(milliseconds: 100),
            ),
          ),
          const PositionedDirectional(
            top: 30,
            end: 54,
            child: Sparkle(
              size: 21,
              color: AppColors.sky,
              delay: Duration(milliseconds: 600),
            ),
          ),
          const PositionedDirectional(
            bottom: 2,
            start: 82,
            child: Sparkle(
              size: 17,
              color: AppColors.berry,
              delay: Duration(milliseconds: 1100),
            ),
          ),
          Floating(
            child: SvgPicture.string(_doneArt, width: LessonSizes.doneArt),
          ),
        ],
      ),
    ),
    SizedBox(height: gap),
    PopIn(
      child: Text(
        'أتممت سورة ${state.surahName ?? ''}!',
        textAlign: TextAlign.center,
        style: LessonText.doneTitle,
      ),
    ),
    SizedBox(height: gap),
    Row(
      children: [
        _stat(
          (state.surahAyahCount ?? 0).arabicDigits,
          'آيات اليوم',
          AppColors.deepGreen,
          600,
        ),
        const SizedBox(width: 10),
        _stat(
          glance.surahsTotal.arabicDigits,
          'سور مكتملة',
          AppColors.warningText,
          750,
        ),
        const SizedBox(width: 10),
        _stat(
          glance.streak.arabicDigits,
          'أيام متتالية',
          AppColors.berryDeep,
          900,
        ),
      ],
    ),
  ];

  static String get _doneArt =>
      '''
<svg viewBox="0 0 100 100" fill="none">
<circle cx="50" cy="50" r="46" fill="${_hex(AppColors.greenTint)}"/>
<path d="M50 80 V46" stroke="${_hex(AppColors.deepGreen)}" stroke-width="6" stroke-linecap="round"/>
<path d="M50 60 C36 60 27 52 27 39 C41 39 50 47 50 60 Z" fill="${_hex(AppColors.primary)}"/>
<path d="M50 54 C64 54 73 46 73 33 C59 33 50 41 50 54 Z" fill="${_hex(AppColors.softGreen)}"/>
<circle cx="50" cy="30" r="10" fill="${_hex(AppColors.primary)}"/>
<circle cx="50" cy="82" r="5" fill="${_hex(AppColors.gold)}"/>
<circle cx="72" cy="26" r="3.6" fill="${_hex(AppColors.gold)}"/>
<circle cx="28" cy="28" r="3" fill="${_hex(AppColors.gold)}"/>
</svg>''';

  Widget _stat(String n, String label, Color color, int delayMs) => Expanded(
    child: PopIn(
      delay: Duration(milliseconds: delayMs),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(LessonRadii.statCard),
          boxShadow: LessonShadows.statCard,
        ),
        child: Column(
          children: [
            Text(n, style: LessonText.statNumber.copyWith(color: color)),
            const SizedBox(height: 4),
            Text(label, style: LessonText.statLabel),
          ],
        ),
      ),
    ),
  );

  Widget _hadith() {
    final h = state.hadith;
    final topicOnly =
        _beat == LessonBeat.speaking && state.captionId == 'hadith.topic';
    if (h == null) return const SizedBox.shrink();
    if (topicOnly) {
      return SwapIn(
        key: const ValueKey('topic'),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(LessonRadii.ayahCard),
            border: Border.all(color: AppColors.border, width: 1.5),
            boxShadow: LessonShadows.ayahCard,
          ),
          child: Column(
            children: [
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  color: AppColors.berryTint,
                  borderRadius: BorderRadius.circular(22),
                ),
                alignment: Alignment.center,
                child: SvgPicture.string(_hadithIcon, width: 34, height: 34),
              ),
              const SizedBox(height: 14),
              Text(
                h.title,
                style: LessonText.hadithTopic,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              _badge('من كلام النبي ﷺ', LessonText.hadithBadge, 14, 7),
            ],
          ),
        ),
      );
    }
    return SwapIn(
      key: const ValueKey('hadith'),
      child: Semantics(
        button: true,
        label: 'أعد سماع الحديث',
        child: Material(
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(LessonRadii.ayahCard),
            side: BorderSide(
              color: _beat == LessonBeat.reciting
                  ? AppColors.primary
                  : AppColors.border,
              width: _beat == LessonBeat.reciting ? 2 : 1.5,
            ),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(LessonRadii.ayahCard),
            onTap: actions.replayAyah,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 24, 18, 20),
              child: Column(
                children: [
                  _badge(
                    'حديث شريف',
                    LessonText.chip.copyWith(color: AppColors.berryDeep),
                    13,
                    6,
                  ),
                  const SizedBox(height: 12),
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 100),
                    child: Center(
                      child: h.isApproved
                          // An approved hadith between « » (not ﴿ ﴾).
                          ? Text(
                              '«${h.displayText}»',
                              textAlign: TextAlign.center,
                              style: LessonText.hadithText,
                            )
                          : _DashedBox(text: h.displayText),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    h.displayTakhrij,
                    style: LessonText.takhrij,
                    textAlign: TextAlign.center,
                  ),
                  if (state.playbackBlocked) ...[
                    const SizedBox(height: 12),
                    PlayFallback(onTap: actions.play),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static String get _hadithIcon =>
      '''
<svg viewBox="0 0 24 24" fill="none">
<path d="M7 4 H17 C18.7 4 20 5.3 20 7 V20 H9.5 C8 20 7 18.8 7 17.3 Z" stroke="${_hex(AppColors.berryDeep)}" stroke-width="1.9" stroke-linejoin="round"/>
<path d="M7 4 C5.3 4 4 5.3 4 7 C4 8.2 4.9 9 6 9 H7" stroke="${_hex(AppColors.berryDeep)}" stroke-width="1.9" stroke-linejoin="round"/>
</svg>''';

  List<Widget> _lessonEnd(double gap) => [
    PopIn(
      delay: const Duration(milliseconds: 100),
      child: Text(
        'أكملت حصة اليوم!',
        textAlign: TextAlign.center,
        style: LessonText.doneTitle.copyWith(fontSize: 28),
      ),
    ),
    SizedBox(height: gap),
    _DoneCard(),
    SizedBox(height: gap),
    _StreakCard(glance: glance),
  ];

  // ── Bottom (mic / arrows / hint) ──────────────────────────────────────────

  Widget _bottom() {
    final size = _end ? 112.0 : LessonSizes.mic;
    final glyph = _end ? 48.0 : LessonSizes.micGlyph;
    final bars = _end ? 16.0 : LessonSizes.voiceBarsHeight;
    MicControl mic(
      MicLook look,
      String label, {
      VoidCallback? onTap,
      bool prompt = false,
      bool dim = false,
      bool voice = false,
    }) => MicControl(
      look: look,
      semanticLabel: label,
      onTap: onTap,
      prompt: prompt,
      dim: dim,
      level: level,
      voiceActive: voice,
      size: size,
      glyph: glyph,
      barsHeight: bars,
    );

    final Widget control = switch (_beat) {
      LessonBeat.listening => mic(
        MicLook.live,
        'كتم الميكروفون',
        onTap: actions.micTap,
        voice: true,
      ),
      LessonBeat.counted || LessonBeat.nudging => mic(
        MicLook.live,
        'كتم الميكروفون',
        onTap: actions.micTap,
      ),
      LessonBeat.hearingAnswer => mic(
        MicLook.live,
        _screen == LessonScreen.intro ? 'قلت نعم' : 'كتم الميكروفون',
        onTap: actions.micTap,
        voice: true,
      ),
      LessonBeat.recording => mic(
        MicLook.live,
        'أنهيت كلامي',
        onTap: actions.micTap,
        voice: true,
      ),
      LessonBeat.praising => mic(MicLook.idle, 'الميكروفون'),
      LessonBeat.awaitContinue => mic(
        MicLook.finish,
        'تابع بعد إتمام السورة',
        onTap: actions.continueTapped,
      ),
      LessonBeat.advancing || LessonBeat.recorded => mic(
        MicLook.goNext,
        _screen == LessonScreen.projectReport ? 'ابدأ حديث اليوم' : 'تابع',
        onTap: actions.continueTapped,
      ),
      LessonBeat.awaitMic => mic(
        MicLook.closed,
        _screen == LessonScreen.projectReport
            ? 'افتح الميكروفون واحكِ للمعلّم'
            : 'افتح الميكروفون',
        onTap: actions.micTap,
        prompt: _screen != LessonScreen.intro,
      ),
      LessonBeat.done => mic(MicLook.closed, 'الميكروفون'),
      LessonBeat.speaking || LessonBeat.reciting => mic(
        MicLook.closed,
        'الميكروفون',
        dim: _beat == LessonBeat.reciting || _screen != LessonScreen.intro,
      ),
    };
    final hint = _hint();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        control,
        SizedBox(height: _end ? 7 : 10),
        SizedBox(
          height: _end ? 17 : LessonSizes.hintHeight,
          child: Text(
            hint,
            textAlign: TextAlign.center,
            style: LessonText.hint.copyWith(
              color: _hintWarm ? AppColors.warningText : AppColors.textMuted,
            ),
          ),
        ),
        if (_end) ...[
          const SizedBox(height: 7),
          _HomeButton(onTap: actions.goHome),
        ],
      ],
    );
  }

  bool get _hintWarm => switch (_beat) {
    LessonBeat.listening ||
    LessonBeat.counted ||
    LessonBeat.nudging ||
    LessonBeat.hearingAnswer ||
    LessonBeat.recording => true,
    LessonBeat.awaitMic => _screen != LessonScreen.intro,
    _ => false,
  };

  String _hint() {
    final question =
        state.captionId?.endsWith('ask') == true ||
        state.captionId == 'intro.ready' ||
        state.captionId == 'surah.next_hadith';
    switch (_screen) {
      case LessonScreen.intro:
        return switch (_beat) {
          LessonBeat.speaking => 'اضغط المعلّم ليكمل',
          LessonBeat.awaitMic => 'أجب بصوتك: اضغط الميكروفون',
          LessonBeat.hearingAnswer => 'قل: نعم',
          _ => '',
        };
      case LessonScreen.ayah:
      case LessonScreen.hadith:
        return switch (_beat) {
          LessonBeat.speaking => 'اضغط المعلّم ليكمل',
          LessonBeat.awaitMic => 'اضغط الميكروفون مرة واحدة ويبقى مفتوحًا',
          LessonBeat.listening => 'الميكروفون مفتوح — لا تضغط شيئًا',
          LessonBeat.counted ||
          LessonBeat.nudging => 'الميكروفون ما زال مفتوحًا',
          LessonBeat.awaitContinue => 'اضغط لتكمل مع المعلّم',
          LessonBeat.advancing => 'ننتقل…',
          _ => '',
        };
      case LessonScreen.surahDone:
        return switch (_beat) {
          LessonBeat.awaitMic when question => 'أجب بصوتك: اضغط الميكروفون',
          LessonBeat.hearingAnswer => 'قل: نعم',
          LessonBeat.advancing => 'ننتقل الآن…',
          _ => '',
        };
      case LessonScreen.projectAssign:
        return switch (_beat) {
          LessonBeat.awaitMic => 'أجب بصوتك: اضغط الميكروفون',
          LessonBeat.hearingAnswer => 'قل: إن شاء الله',
          LessonBeat.advancing => 'ننهي حصتنا…',
          _ => '',
        };
      case LessonScreen.projectReport:
        return switch (_beat) {
          LessonBeat.awaitMic => 'اضغط الميكروفون واحكِ بصوتك',
          LessonBeat.recording => 'اضغط مرة أخرى حين تنتهي',
          LessonBeat.recorded => 'أو أعد التسجيل إن أحببت',
          LessonBeat.advancing => 'ننتقل للحديث…',
          _ => '',
        };
      case LessonScreen.lessonEnd:
        return switch (_beat) {
          LessonBeat.awaitMic => 'أجب بصوتك: اضغط الميكروفون',
          LessonBeat.hearingAnswer => 'قل: أبشر',
          LessonBeat.done => 'إلى اللقاء غدًا',
          _ => '',
        };
      default:
        return '';
    }
  }
}

Widget _badge(
  String text,
  TextStyle style,
  double h,
  double v, {
  Color bg = AppColors.berryTint,
}) => Container(
  padding: EdgeInsets.symmetric(horizontal: h, vertical: v),
  decoration: BoxDecoration(
    color: bg,
    borderRadius: BorderRadius.circular(AppRadii.pill),
  ),
  child: Text(text, style: style),
);

class _DashedBox extends StatelessWidget {
  const _DashedBox({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => CustomPaint(
    foregroundPainter: _Dash(),
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.hadithPlaceholderBg,
        borderRadius: BorderRadius.circular(LessonRadii.hadithDash),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: LessonText.hadithPlaceholder,
      ),
    ),
  );
}

class _Dash extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(LessonRadii.hadithDash),
    ).deflate(0.75);
    final paint = Paint()
      ..color = AppColors.hadithDash
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    for (final m in (Path()..addRRect(rrect)).computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 9) {
        canvas.drawPath(m.extractPath(d, d + 5), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_Dash old) => false;
}

// ── 18 · plan ───────────────────────────────────────────────────────────────

class _Plan extends StatelessWidget {
  const _Plan({required this.state, required this.plan});

  final LessonState state;
  final LessonPlanInfo plan;

  @override
  Widget build(BuildContext context) {
    // Lines: 0 greet · 1 plan · 2 surah · 3 count · 4 ready (no Makki/Madani).
    final i = state.lineIndex;
    final surahLit = i >= 1 && i <= 3;
    final restLit = i == 1;
    return SwapIn(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('خطة اليوم', style: LessonText.planTitle),
          const SizedBox(height: 9),
          if (plan.surahName != null)
            _row(
              lit: surahLit,
              icon: _bookIcon,
              iconColor: AppColors.deepGreen,
              title: 'سورة ${plan.surahName}',
              meta: '${(plan.surahAyat ?? 0).arabicDigits} آيات',
              extra: i >= 3
                  ? Padding(
                      padding: const EdgeInsetsDirectional.only(
                        start: 52,
                        top: 8,
                      ),
                      child: Row(
                        children: [
                          PopIn(
                            child: _badge(
                              '${(plan.surahAyat ?? 0).arabicDigits} آيات قصيرة',
                              LessonText.chip.copyWith(
                                color: AppColors.skyText,
                              ),
                              12,
                              6,
                              bg: AppColors.skyTint,
                            ),
                          ),
                        ],
                      ),
                    )
                  : null,
            ),
          if (plan.hadithTitle != null) ...[
            const SizedBox(height: 8),
            _row(
              lit: restLit,
              icon: _hadithIcon,
              title: plan.hadithTitle!,
              meta: 'حديث واحد',
            ),
          ],
          if (plan.hasProject) ...[
            const SizedBox(height: 8),
            _row(
              lit: restLit,
              icon: _leafIcon,
              title: 'مشروع الأسبوع',
              meta: 'في البيت',
            ),
          ],
        ],
      ),
    );
  }

  Widget _row({
    required bool lit,
    required String icon,
    required String title,
    required String meta,
    Color iconColor = AppColors.deepGreen,
    Widget? extra,
  }) => AnimatedContainer(
    duration: const Duration(milliseconds: 300),
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
    decoration: BoxDecoration(
      color: lit ? AppColors.greenTint : AppColors.surface,
      borderRadius: BorderRadius.circular(LessonRadii.planRow),
      border: Border.all(
        color: lit ? AppColors.primary : AppColors.border,
        width: lit ? 2 : 1.5,
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              width: LessonSizes.planIcon,
              height: LessonSizes.planIcon,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(LessonRadii.planIcon),
              ),
              alignment: Alignment.center,
              child: SvgPicture.string(icon, width: 21, height: 21),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: LessonText.planRow)),
            Text(meta, style: LessonText.planMeta),
          ],
        ),
        ?extra,
      ],
    ),
  );

  static String get _bookIcon =>
      '''
<svg viewBox="0 0 24 24" fill="none">
<path d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9" stroke-linejoin="round"/>
<path d="M12 5.8 V18.8" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9"/>
</svg>''';
  static String get _hadithIcon => LessonView._hadithIcon;
  static String get _leafIcon =>
      '''
<svg viewBox="0 0 24 24" fill="none">
<path d="M12 20 C12 15.5 14.8 12.5 19 12 C19 16.5 16.2 19.6 12 20 Z" fill="${_hex(AppColors.goldDeep)}"/>
<path d="M12 20 C12 15.5 9.2 12.5 5 12 C5 16.5 7.8 19.6 12 20 Z" fill="${_hex(AppColors.goldMid)}"/>
</svg>''';
}

// ── 21 · project assign ─────────────────────────────────────────────────────

String get _projectArt =>
    '''
<svg viewBox="0 0 64 64" fill="none">
<path d="M32 38 V18" stroke="${_hex(AppColors.deepGreen)}" stroke-width="3.4" stroke-linecap="round"/>
<path d="M32 28 C24 28 19 23 19 15 C27 15 32 20 32 28 Z" fill="${_hex(AppColors.primary)}"/>
<path d="M32 24 C40 24 45 19 45 11 C37 11 32 16 32 24 Z" fill="${_hex(AppColors.softGreen)}"/>
<path d="M6 38 C6 50 17 58 32 58 C47 58 58 50 58 38 C58 34 54 32 51 34 L40 41 L24 41 L13 34 C10 32 6 34 6 38 Z" fill="${_hex(AppColors.gold)}"/>
<path d="M24 41 C24 37 28 35 32 35 C36 35 40 37 40 41 Z" fill="${_hex(AppColors.goldMid)}"/>
</svg>''';

class _ProjectAssign extends StatelessWidget {
  const _ProjectAssign({required this.state});

  final LessonState state;

  @override
  Widget build(BuildContext context) {
    final p = state.project;
    if (p == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PopIn(
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 22, 18, 18),
                decoration: BoxDecoration(
                  color: AppColors.goldTint,
                  borderRadius: BorderRadius.circular(LessonRadii.projectCard),
                  border: Border.all(color: AppColors.goldBorder, width: 2),
                ),
                child: Column(
                  children: [
                    Padding(
                      // inline-SVG baseline gap in the design
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Floating(
                        period: const Duration(milliseconds: 3200),
                        child: SvgPicture.string(
                          _projectArt,
                          width: 62,
                          height: 62,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      p.title,
                      textAlign: TextAlign.center,
                      style: LessonText.projectTitle,
                    ),
                  ],
                ),
              ),
              PositionedDirectional(
                top: -13,
                start: 24,
                child: _badge(
                  'مشروع هذا الأسبوع',
                  LessonText.chip.copyWith(color: AppColors.onGold),
                  14,
                  6,
                  bg: AppColors.gold,
                ),
              ),
            ],
          ),
        ),
        if (state.lineIndex >= 1) ...[
          const SizedBox(height: 9),
          for (var i = 0; i < p.hints.length; i++) ...[
            if (i > 0) const SizedBox(height: 7),
            _Step(n: i + 1, text: p.hints[i], last: i == p.hints.length - 1),
          ],
        ],
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.text, required this.last});

  final int n;
  final String text;
  final bool last;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(LessonRadii.stepRow),
      border: last ? Border.all(color: AppColors.goldBorder, width: 1.5) : null,
      boxShadow: LessonShadows.stepRow,
    ),
    child: Row(
      children: [
        Container(
          width: LessonSizes.stepNumber,
          height: LessonSizes.stepNumber,
          decoration: BoxDecoration(
            color: last ? AppColors.goldTint : AppColors.greenTint,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            n.arabicDigits,
            style: LessonText.stepNumber.copyWith(
              color: last ? AppColors.warningText : AppColors.deepGreen,
            ),
          ),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Text(
            text,
            style: LessonText.stepText.copyWith(
              color: last ? AppColors.warningText : AppColors.textDark,
            ),
          ),
        ),
      ],
    ),
  );
}

// ── 22 · project report ─────────────────────────────────────────────────────

class _ProjectReport extends StatelessWidget {
  const _ProjectReport({required this.state, required this.actions});

  final LessonState state;
  final LessonActions actions;

  String _clock(Duration d) =>
      '${d.inMinutes.arabicDigits}:${(d.inSeconds % 60).toString().padLeft(2, '0').arabicDigits}';

  @override
  Widget build(BuildContext context) {
    final p = state.project;
    final recording = state.beat == LessonBeat.recording;
    final saved =
        state.beat == LessonBeat.recorded ||
        (state.beat == LessonBeat.advancing && state.recordedDuration != null);
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: LessonSizes.reportMinHeight),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PopIn(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(18, 22, 18, 18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(
                      LessonRadii.projectCard,
                    ),
                    border: Border.all(
                      color: recording
                          ? AppColors.gold
                          : saved
                          ? AppColors.primary
                          : AppColors.border,
                      width: recording || saved ? 2 : 1.5,
                    ),
                    boxShadow: LessonShadows.reportCard,
                  ),
                  child: Column(
                    children: [
                      Padding(
                        // inline-SVG baseline gap in the design
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Floating(
                          period: const Duration(milliseconds: 3200),
                          child: SvgPicture.string(
                            _projectArt,
                            width: 58,
                            height: 58,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        p?.title ?? '',
                        textAlign: TextAlign.center,
                        style: LessonText.projectTitle.copyWith(
                          fontSize: 23,
                          color: AppColors.textDark,
                        ),
                      ),
                      if (recording) ...[
                        const SizedBox(height: 10),
                        PopIn(
                          child: _pill(
                            AppColors.berryTint,
                            Looping(
                              duration: const Duration(milliseconds: 1100),
                              builder: (context, t, child) => Opacity(
                                opacity: t < 0.5
                                    ? 1 - 1.5 * t
                                    : 0.25 + 1.5 * (t - 0.5),
                                child: child,
                              ),
                              child: Container(
                                width: 9,
                                height: 9,
                                decoration: const BoxDecoration(
                                  color: AppColors.berry,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                            'جارٍ التسجيل · ${_clock(state.recordingElapsed)}',
                            LessonText.recChip,
                          ),
                        ),
                      ],
                      if (saved) ...[
                        const SizedBox(height: 10),
                        PopIn(
                          child: _pill(
                            AppColors.greenTint,
                            AppIcon.tick(
                              size: 15,
                              stroke: 3.4,
                              color: AppColors.deepGreen,
                            ),
                            'حُفظ صوتك · ${_clock(state.recordedDuration ?? Duration.zero)}',
                            LessonText.recChip.copyWith(
                              color: AppColors.deepGreen,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                PositionedDirectional(
                  top: -13,
                  start: 24,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.goldTint,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                      border: Border.all(color: AppColors.goldBorder),
                    ),
                    child: Text(
                      'مشروع الأمس',
                      style: LessonText.chip.copyWith(
                        color: AppColors.warningText,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (saved) ...[
            const SizedBox(height: 9),
            Text(
              'يصل إلى لوحة والدك — لا يُنشر لأحد غيره.',
              textAlign: TextAlign.center,
              style: LessonText.note,
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: LessonSizes.reRecordHeight,
              child: OutlinedButton.icon(
                onPressed: state.beat == LessonBeat.recorded
                    ? actions.reRecord
                    : null,
                icon: SvgPicture.string(_redoIcon, width: 18, height: 18),
                label: Text('أعِد التسجيل', style: LessonText.reRecord),
                style: OutlinedButton.styleFrom(
                  backgroundColor: AppColors.surface,
                  side: const BorderSide(
                    color: AppColors.inputBorder,
                    width: 1.5,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(LessonRadii.reRecord),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _pill(Color bg, Widget lead, String text, TextStyle style) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            lead,
            const SizedBox(width: 8),
            Text(text, style: style),
          ],
        ),
      );

  static String get _redoIcon =>
      '''
<svg viewBox="0 0 24 24" fill="none">
<path d="M4.5 12 A7.5 7.5 0 1 1 7.4 17.9" stroke="${_hex(AppColors.textMuted)}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M4.5 7 V12 H9.5" stroke="${_hex(AppColors.textMuted)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''';
}

// ── 23 · lesson end ─────────────────────────────────────────────────────────

class _DoneCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(LessonRadii.doneCard),
      boxShadow: LessonShadows.doneCard,
    ),
    child: Stack(
      clipBehavior: Clip.none,
      children: [
        const PositionedDirectional(
          top: -10,
          end: 48,
          child: Sparkle(
            size: 17,
            color: AppColors.gold,
            delay: Duration(milliseconds: 200),
          ),
        ),
        Row(
          children: [
            // Inline SVG in the design leaves a 6px baseline gap under the art.
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Floating(
                child: SvgPicture.string(_treeArt, width: 92, height: 92),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 30,
                        height: 30,
                        decoration: const BoxDecoration(
                          color: AppColors.greenTint,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: AppIcon.tick(
                          size: 17,
                          stroke: 3.4,
                          color: AppColors.deepGreen,
                        ),
                      ),
                      const SizedBox(width: 9),
                      Text('أكملت درس اليوم', style: LessonText.doneRow),
                    ],
                  ),
                  const SizedBox(height: 9),
                  _badge(
                    'غرستك كبرت خطوة',
                    LessonText.chip.copyWith(
                      fontSize: 12.5,
                      color: AppColors.deepGreen,
                    ),
                    14,
                    7,
                    bg: AppColors.greenTint,
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    ),
  );

  static String get _treeArt =>
      '''
<svg viewBox="0 0 100 100" fill="none">
<circle cx="50" cy="50" r="46" fill="${_hex(AppColors.greenTint)}"/>
<path d="M50 84 V40" stroke="${_hex(AppColors.deepGreen)}" stroke-width="6.5" stroke-linecap="round"/>
<path d="M50 62 C34 62 24 53 24 38 C40 38 50 47 50 62 Z" fill="${_hex(AppColors.primary)}"/>
<path d="M50 54 C66 54 76 45 76 30 C60 30 50 39 50 54 Z" fill="${_hex(AppColors.softGreen)}"/>
<circle cx="50" cy="26" r="13" fill="${_hex(AppColors.primary)}"/>
<circle cx="38" cy="34" r="8" fill="${_hex(AppColors.leafLight)}"/>
<circle cx="62" cy="34" r="8" fill="${_hex(AppColors.leafLight)}"/>
<circle cx="44" cy="21" r="3.6" fill="${_hex(AppColors.gold)}"/>
<circle cx="58" cy="30" r="3" fill="${_hex(AppColors.gold)}"/>
<circle cx="50" cy="86" r="5" fill="${_hex(AppColors.gold)}"/>
</svg>''';
}

class _StreakCard extends StatelessWidget {
  const _StreakCard({required this.glance});

  final ChildGlance glance;

  @override
  Widget build(BuildContext context) {
    final days = glance.streakDays.isEmpty
        ? const ['اليوم']
        : glance.streakDays;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(LessonRadii.doneCard),
        boxShadow: LessonShadows.doneCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('أيامك المتتالية', style: LessonText.streakTitle),
              _badge(
                '${glance.streak.arabicDigits} ${glance.streak >= 3 && glance.streak <= 10 ? 'أيام' : 'يوم'}',
                LessonText.chip.copyWith(
                  fontSize: 12.5,
                  color: AppColors.warningText,
                ),
                12,
                6,
                bg: AppColors.goldTint,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (var i = 0; i < days.length; i++) ...[
                if (i > 0) const SizedBox(width: 7),
                Expanded(
                  child: Container(
                    height: LessonSizes.streakDayHeight,
                    decoration: BoxDecoration(
                      color: i == days.length - 1
                          ? AppColors.gold
                          : AppColors.greenTint,
                      borderRadius: BorderRadius.circular(
                        LessonRadii.streakDay,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      days[i],
                      style: LessonText.streakDay.copyWith(
                        color: i == days.length - 1
                            ? AppColors.onGold
                            : AppColors.deepGreen,
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _HomeButton extends StatelessWidget {
  const _HomeButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(AppRadii.cta),
      boxShadow: LessonShadows.homeButton,
    ),
    child: SizedBox(
      width: double.infinity,
      height: LessonSizes.homeButtonHeight,
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.deepGreen,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.cta),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('عودة للرئيسية', style: LessonText.homeButton),
            const SizedBox(width: 10),
            SvgPicture.string(
              '<svg viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4.5 L20 11 V19 C20 19.6 19.6 20 19 20 H5 C4.4 20 4 19.6 4 19 Z" stroke="${_hex(AppColors.surface)}" stroke-width="2.1" stroke-linejoin="round"/></svg>',
              width: 22,
              height: 22,
            ),
          ],
        ),
      ),
    ),
  );
}
