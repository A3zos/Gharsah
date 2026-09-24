import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../core/app_content.dart';
import '../../../core/app_scope.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/info_note.dart';
import '../../children/data/child_profile.dart';
import '../../quran/data/quran_audio_repository.dart';
import '../../student/data/child_session.dart';
import '../../student/data/student_repository.dart';
import '../agent/lesson_agent.dart';
import '../agent/lesson_state.dart';
import '../ai/interim/device_ai_teacher.dart';
import '../data/lesson_script.dart';
import '../playback/audioplayers_recitation_player.dart';
import '../recording/record_project_recorder.dart';
import 'lesson_view.dart';

/// Hosts one live lesson (frames 18–23): wires the [LessonAgent] to the
/// interim AI teacher, the reciter player, the recorder and Firestore, and
/// renders [LessonView]. The screen itself never plays audio or advances.
class LessonCallScreen extends StatefulWidget {
  const LessonCallScreen({
    super.key,
    required this.session,
    required this.lessonId,
    this.resume,
  });

  final ChildSession session;
  final String lessonId;
  final LessonProgress? resume;

  @override
  State<LessonCallScreen> createState() => _LessonCallScreenState();
}

class _LessonCallScreenState extends State<LessonCallScreen>
    implements LessonActions {
  LessonAgent? _agent;
  LessonPlanInfo _plan = const LessonPlanInfo();
  late final StudentRepository _repo = StudentRepository(widget.session);
  late final Stream<ChildProfile?> _child = _repo.watchChild();
  AppLifecycleListener? _life;
  final _teacher = DeviceAiTeacher();
  final _player = AudioplayersRecitationPlayer();
  final _recorder = RecordProjectRecorder();
  bool _started = false;
  bool _leaving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _start(AppScope.of(context).content);
  }

  Future<void> _start(AppContent content) async {
    final script = await LessonScript.load(widget.lessonId);
    final agent = LessonAgent(
      script: script,
      content: LessonContent(
        meta: content.meta,
        text: content.text,
        audio: QuranAudioRepository(
          meta: content.meta,
          manifest: content.manifest,
        ),
        hadith: content.hadith,
        projects: content.projects,
      ),
      teacher: _teacher,
      player: _player,
      recorder: _recorder,
      sink: _repo.sinkFor(widget.lessonId),
      childFirstName: widget.session.name,
      // Debug builds: tapping the teacher counts a repeat (design prototype).
      debugTapCountsRepeat: kDebugMode,
    );
    if (!mounted) return;
    setState(() {
      _agent = agent;
      _plan = _planOf(script, content);
    });
    agent.state.addListener(_onState);
    _life = AppLifecycleListener(
      onHide: () => agent.setForeground(false),
      onShow: () => agent.setForeground(true),
    );
    await agent.start(from: widget.resume);
  }

  static LessonPlanInfo _planOf(LessonScript script, AppContent content) {
    int? surah;
    String? hadith;
    var project = false;
    for (final s in script.steps) {
      switch (s) {
        case IntroStep(surah: final n):
          surah ??= n;
        case AyahLoopStep(:final ref):
          surah ??= ref.surah;
        case HadithLoopStep(:final hadithId):
          hadith ??= content.hadith.byId(hadithId).title;
        case ProjectAssignStep():
          project = true;
        default:
          break;
      }
    }
    return LessonPlanInfo(
      surahName: surah == null ? null : content.meta.surahName(surah),
      surahAyat: surah == null ? null : content.meta.ayahCount(surah),
      hadithTitle: hadith,
      hasProject: project,
    );
  }

  void _onState() {
    if (_agent?.state.value.screen == LessonScreen.ended) _leave();
  }

  void _leave() {
    if (_leaving || !mounted) return;
    _leaving = true;
    Navigator.of(context).maybePop();
  }

  @override
  void dispose() {
    _life?.dispose();
    final agent = _agent;
    agent?.state.removeListener(_onState);
    () async {
      await agent?.dispose();
      await _teacher.dispose();
      await _player.dispose();
      await _recorder.dispose();
    }();
    super.dispose();
  }

  // ── LessonActions → agent commands ──
  @override
  void tapTeacher() => _agent?.tapTeacher();
  @override
  void micTap() => _agent?.micTap();
  @override
  void continueTapped() => _agent?.continueTapped();
  @override
  void replayAyah() => _agent?.replayAyah();
  @override
  void play() => _agent?.play();
  @override
  void reRecord() => _agent?.reRecord();
  @override
  void endCall() => _agent == null ? _leave() : _agent!.endCall();
  @override
  void goHome() => endCall();

  @override
  Widget build(BuildContext context) {
    final agent = _agent;
    return PopScope(
      canPop: agent == null || agent.state.value.screen == LessonScreen.ended,
      onPopInvokedWithResult: (didPop, _) {
        // Android back = «إنهاء المكالمة» (checkpoint saved, resume later).
        if (!didPop) endCall();
      },
      child: agent == null
          ? const Scaffold(
              backgroundColor: AppColors.background,
              body: Center(child: CircularProgressIndicator()),
            )
          : StreamBuilder<ChildProfile?>(
              stream: _child,
              builder: (context, child) => ValueListenableBuilder<LessonState>(
                valueListenable: agent.state,
                builder: (context, s, _) {
                  if (s.screen == LessonScreen.loading ||
                      s.screen == LessonScreen.ended) {
                    return const Scaffold(
                      backgroundColor: AppColors.background,
                      body: Center(child: CircularProgressIndicator()),
                    );
                  }
                  if (s.screen == LessonScreen.failed) {
                    return _Failed(onBack: _leave);
                  }
                  return LessonView(
                    state: s,
                    plan: _plan,
                    glance: LessonCallScreenGlance.of(
                      child.data,
                      DateTime.now(),
                    ),
                    actions: this,
                    level: agent.level,
                  );
                },
              ),
            ),
    );
  }
}

/// TODO(design): lesson audio couldn't be prepared (offline, not bundled).
class _Failed extends StatelessWidget {
  const _Failed({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(LessonSizes.framePaddingH),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const InfoNote(
              tone: InfoNoteTone.gold,
              lineHeight: 1.8,
              text:
                  'لا يوجد اتصال لتحميل الحصة — اتصل بالإنترنت ثم حاول مجددًا.',
            ),
            const SizedBox(height: 18),
            FilledButton(onPressed: onBack, child: const Text('عودة للرئيسية')),
          ],
        ),
      ),
    ),
  );
}

/// The child's totals for frames 19 and 23, from the child doc.
abstract final class LessonCallScreenGlance {
  static ChildGlance of(ChildProfile? c, DateTime now) {
    final stats = c?.stats ?? const {};
    final streak = (stats['streak'] as num?)?.toInt() ?? 0;
    final days = c?.schedule?.days ?? const <WeekDay>{};
    // The last scheduled days of the streak, ending today («اليوم»).
    final labels = <String>['اليوم'];
    var d = now;
    for (var i = 0; i < 14 && labels.length < streak.clamp(1, 5); i++) {
      d = d.subtract(const Duration(days: 1));
      final w = WeekDay.values[(d.weekday + 1) % 7]; // Mon=1 → index 2 (sat=0)
      if (days.contains(w)) labels.insert(0, w.short);
    }
    return ChildGlance(
      surahsTotal: (stats['surahs'] as num?)?.toInt() ?? 0,
      streak: streak,
      streakDays: labels,
    );
  }
}
