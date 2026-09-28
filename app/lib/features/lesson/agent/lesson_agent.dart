import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/arabic_digits.dart';
import '../../quran/data/quran_audio_repository.dart';
import '../../quran/data/quran_ref.dart';
import '../../quran/data/quran_text_repository.dart';
import '../ai/ai_teacher.dart';
import '../ai/teacher_lines.dart';
import '../data/hadith_repository.dart';
import '../data/lesson_script.dart';
import '../data/project_repository.dart';
import '../playback/recitation_player.dart';
import '../recording/project_recorder.dart';
import 'lesson_state.dart';

/// Verified content the agent reads from (all local assets).
class LessonContent {
  const LessonContent({
    required this.meta,
    required this.text,
    required this.audio,
    required this.hadith,
    required this.projects,
  });

  final QuranMeta meta;
  final QuranTextRepository text;
  final QuranAudioRepository audio;
  final HadithRepository hadith;
  final ProjectRepository projects;
}

/// Where the lesson's results go (Supabase database/storage in the app, a fake in tests).
abstract interface class LessonProgressSink {
  /// After every step and when the child leaves the call.
  Future<void> checkpoint(LessonProgress progress);

  /// When frame 23 is reached.
  Future<void> completed(LessonProgress progress);

  /// Uploads the project report. Throws if it couldn't be saved.
  Future<void> saveReport(String projectId, RecordedAudio audio);
}

class LessonTimings {
  const LessonTimings({
    this.silence = const Duration(seconds: 7),
    this.echoGuard = const Duration(milliseconds: 300),
    this.maxNudges = 2,
    this.recordedAutoAdvance = const Duration(milliseconds: 3200),
    this.maxRecording = const Duration(minutes: 3),
  });

  /// Silence while the mic is open before a nudge («باقي مرة، هيا…»).
  final Duration silence;

  /// Mic stays deaf this long after the teacher/reciter stops (room echo).
  final Duration echoGuard;

  /// Nudges before the ayah is replayed once; after that the agent just waits.
  final int maxNudges;

  /// Frame 22: «حُفظ صوتك» → moves on unless the child re-records.
  final Duration recordedAutoAdvance;
  final Duration maxRecording;
}

/// The single brain of the live lesson (frames 18–23).
///
/// Runs a [LessonScript] as a state machine. Screens only render [state] and
/// forward taps as commands; they never play audio or advance steps.
///
/// Rules enforced here:
/// * the recitation starts by itself when an ayah appears; the teacher is
///   silenced while the reciter plays;
/// * the mic never listens during recitation or teacher speech (+ an echo
///   guard), so neither is ever counted as the child;
/// * muting the mic pauses counting, not the lesson;
/// * backgrounding pauses everything; returning resumes the same moment;
/// * autoplay blocked → [LessonState.playbackBlocked] (small fallback play);
/// * silence → nudge; after [LessonTimings.maxNudges] nudges the ayah is
///   replayed once, then the agent waits.
class LessonAgent {
  LessonAgent({
    required this.script,
    required this.content,
    required this.teacher,
    required this.player,
    required this.recorder,
    required this.sink,
    required this.childFirstName,
    this.timings = const LessonTimings(),
    this.lineBank = const TeacherLineBank(),
    DateTime Function()? now,
    this.debugTapCountsRepeat = false,
  }) : _now = now ?? DateTime.now,
       _progress = LessonProgress(lessonId: script.lessonId);

  final LessonScript script;
  final LessonContent content;
  final AiTeacher teacher;
  final RecitationPlayer player;
  final ProjectRecorder recorder;
  final LessonProgressSink sink;
  final String childFirstName;
  final LessonTimings timings;
  final TeacherLineBank lineBank;
  final DateTime Function() _now;

  /// Debug builds only: tapping the teacher counts a repeat (to walk the flow
  /// on a device/browser without a working mic — the design prototype's tap).
  final bool debugTapCountsRepeat;

  final ValueNotifier<LessonState> state = ValueNotifier(const LessonState());

  /// Child's live voice level (0..1) for the voice bars — never stored.
  final ValueNotifier<double> level = ValueNotifier(0);

  LessonProgress _progress;
  LessonProgress get progress => _progress;

  // Every beat change bumps the generation; stale async work checks it and stops.
  int _gen = 0;
  VoidCallback? _resume;
  VoidCallback? _skip;
  Timer? _beatTimer;
  Timer? _clock;
  Timer? _recClock;
  bool _userPaused = false;
  bool _background = false;
  bool _pauseApplied = false;
  bool _listening = false;
  bool _disposed = false;
  final List<StreamSubscription<Object?>> _subs = [];

  // Per-step
  int _nudges = 0;
  bool _autoReplayed = false;
  _Question? _question;
  RecordedAudio? _recorded;
  bool _saving = false;

  LessonState get _s => state.value;
  void _set(LessonState s) {
    if (!_disposed) state.value = s;
  }

  void _setLevel(double v) {
    if (!_disposed) level.value = v;
  }

  bool get _paused => _userPaused || _background;
  LessonStep get _step => script.steps[_s.stepIndex];

  // ═══ Lifecycle ═════════════════════════════════════════════════════════════

  /// Starts at [from]'s step (resume from a checkpoint) or at the beginning.
  Future<void> start({LessonProgress? from}) async {
    if (from != null && from.lessonId == script.lessonId && !from.completed) {
      _progress = from;
    }
    try {
      script.validate(content.meta);
      await content.audio.prefetch(script.quranRefs);
    } catch (e) {
      debugPrint('Lesson content not available: $e');
      _set(_s.copyWith(screen: LessonScreen.failed, contentUnavailable: true));
      return;
    }
    _subs
      ..add(teacher.actions.listen(_onAction))
      ..add(
        teacher.inputLevel.listen((v) {
          if (_listening) _setLevel(v);
        }),
      )
      ..add(
        recorder.level.listen((v) {
          if (_s.beat == LessonBeat.recording) _setLevel(v);
        }),
      )
      ..add(player.completed.listen((_) => _onRecitationComplete()));
    teacher.onEvent(LessonStarted(script.lessonId, childFirstName));
    _startClock();
    _enterStep(_progress.stepIndex.clamp(0, script.steps.length - 1));
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _gen++;
    _cancelTimers();
    _clock?.cancel();
    for (final s in _subs) {
      await s.cancel();
    }
    _disposed = true;
    await Future.wait([
      player.stop(),
      teacher.stopSpeaking(),
      if (_listening) teacher.stopListening(),
      if (_recorded != null) recorder.discard(_recorded!),
    ]);
    state.dispose();
    level.dispose();
  }

  /// App went to the background / came back.
  void setForeground(bool foreground) {
    _background = !foreground;
    foreground ? _maybeResume() : _applyPause();
  }

  // ═══ Commands (from the UI) ════════════════════════════════════════════════

  /// Plays the current ayah's recitation — also the fallback play control
  /// when autoplay was blocked. With [ref], jumps to that ayah's step first.
  void play([QuranRef? ref]) {
    if (_paused) return;
    if (ref != null && ref != _s.ayahRef) {
      final i = script.steps.indexWhere(
        (s) => s is AyahLoopStep && s.ref == ref,
      );
      if (i >= 0) _enterStep(i);
      return;
    }
    if (_s.screen == LessonScreen.ayah ||
        (_s.screen == LessonScreen.hadith && _s.hadith?.canPlay == true)) {
      _startRecitation();
    }
  }

  void pause() {
    _userPaused = true;
    _applyPause();
  }

  void resume() {
    _userPaused = false;
    _maybeResume();
  }

  /// Stops the reciter; the child can repeat straight away.
  void stop() {
    if (_s.beat == LessonBeat.reciting) {
      unawaited(player.stop());
      _promptRepeat(fromRecitation: false);
    }
  }

  /// Card tap (frames 18/20): hear the ayah again; repeats already counted stay.
  void replayAyah() {
    const allowed = {
      LessonBeat.reciting,
      LessonBeat.awaitMic,
      LessonBeat.listening,
      LessonBeat.counted,
      LessonBeat.nudging,
    };
    if (_paused || !allowed.contains(_s.beat)) return;
    play();
  }

  void nextAyah() => _jumpAyah(1);
  void previousAyah() => _jumpAyah(-1);

  Future<void> setVolume(double volume) async {
    final v = volume.clamp(0.0, 1.0);
    await Future.wait([player.setVolume(v), teacher.setVolume(v)]);
  }

  /// The one persistent mic control.
  void micTap() {
    if (_paused) return;
    switch (_s.beat) {
      case LessonBeat.awaitMic:
        if (_s.screen == LessonScreen.projectReport) {
          _startRecording();
        } else if (_question != null) {
          _enterHearingAnswer();
        } else {
          teacher.onEvent(const MicOpened());
          _enterListening();
        }
      case LessonBeat.listening || LessonBeat.counted || LessonBeat.nudging:
        // Muting pauses counting only; repeats so far are kept.
        teacher.onEvent(const MicMuted());
        _enter(
          _s.copyWith(
            beat: LessonBeat.awaitMic,
            captionId: 'ayah.repeat_now',
            caption: lineBank.resolve(_repeatNow),
            teacherSpeaking: false,
          ),
          resume: () {},
        );
      case LessonBeat.hearingAnswer:
        if (_s.screen == LessonScreen.intro) {
          // Frame 18: the live mic reads «قلت نعم» — the design's tap fallback.
          tapFallback(AnswerIntent.yes);
        } else {
          _enter(
            _s.copyWith(beat: LessonBeat.awaitMic, teacherSpeaking: false),
            resume: () {},
          );
        }
      case LessonBeat.recording:
        _stopRecording();
      default:
        break;
    }
  }

  /// Tap on the teacher: skip the current line / recitation (as in the design).
  void tapTeacher() {
    if (_paused) return;
    switch (_s.beat) {
      case LessonBeat.reciting:
        stop();
      case LessonBeat.hearingAnswer:
        tapFallback(AnswerIntent.yes);
      case LessonBeat.listening || LessonBeat.nudging
          when debugTapCountsRepeat && kDebugMode:
        _countRepeat();
      case LessonBeat.recorded:
        continueTapped();
      default:
        _skip?.call();
    }
  }

  /// The child tapped instead of speaking a short answer.
  void tapFallback(AnswerIntent answer) {
    if (_paused || _question == null) return;
    teacher.onEvent(TapFallback(answer));
    _onAnswer(answer);
  }

  /// Gold arrow / «تابع» moments.
  void continueTapped() {
    if (_paused) return;
    switch (_s.beat) {
      case LessonBeat.awaitContinue:
        _enterStep(_s.stepIndex + 1);
      case LessonBeat.recorded:
        _saveReport();
      case LessonBeat.advancing:
        _skip?.call();
      default:
        break;
    }
  }

  /// Frame 22 «أعِد التسجيل».
  void reRecord() {
    if (_paused || _s.beat != LessonBeat.recorded || _saving) return;
    final old = _recorded;
    _recorded = null;
    if (old != null) unawaited(recorder.discard(old));
    _startRecording();
  }

  /// «إنهاء المكالمة» — saves a checkpoint so «أكمل الحصة» resumes here.
  Future<void> endCall() async {
    if (_s.screen == LessonScreen.ended) return;
    final finished = _progress.completed;
    _gen++;
    _cancelTimers();
    _clock?.cancel();
    await _stopListening();
    await Future.wait([player.stop(), teacher.stopSpeaking()]);
    final live = _s.beat == LessonBeat.recording ? await recorder.stop() : null;
    if (live != null) await recorder.discard(live);
    final rec = _recorded;
    _recorded = null;
    if (rec != null) await recorder.discard(rec);
    _set(
      _s.copyWith(
        screen: LessonScreen.ended,
        endedByUser: !finished,
        teacherSpeaking: false,
      ),
    );
    if (!finished) {
      await _checkpoint(_progress.copyWith(stepIndex: _s.stepIndex));
    }
  }

  // ═══ Steps ═════════════════════════════════════════════════════════════════

  void _enterStep(int i) {
    if (i >= script.steps.length) return;
    _nudges = 0;
    _autoReplayed = false;
    _question = null;
    _progress = _progress.copyWith(stepIndex: i);
    _set(
      _s.copyWith(
        stepIndex: i,
        lineIndex: 0,
        happy: false,
        repeatsDone: 0,
        playbackBlocked: false,
        contentUnavailable: false,
      ),
    );
    teacher.onEvent(StepShown(i));
    final step = script.steps[i];
    if (step is! LessonEndStep) unawaited(_checkpoint(_progress));
    switch (step) {
      case IntroStep():
        _set(
          _s.copyWith(
            screen: LessonScreen.intro,
            surahName: content.meta.surahName(step.surah),
            surahAyahCount: content.meta.ayahCount(step.surah),
          ),
        );
        _sayLines(
          step.lines,
          question: step.lines.isEmpty ? null : step.lines.last,
          onYes: _next,
        );
      case AyahLoopStep():
        final r = step.ref;
        final surah = content.meta.surahName(r.surah);
        _set(
          _s.copyWith(
            screen: LessonScreen.ayah,
            ayahRef: r,
            ayahText: content.text.text(r),
            ayahReference: 'سورة $surah · الآية ${r.ayah.arabicDigits}',
            surahName: surah,
            surahAyahCount: content.meta.ayahCount(r.surah),
            repeatsTarget: step.repeats,
          ),
        );
        _startRecitation();
      case SurahDoneStep():
        _set(_s.copyWith(screen: LessonScreen.surahDone));
        _sayLines(
          [...step.lines, step.question],
          question: step.question,
          happyLines: true,
          onYes: () => _say(
            const TeacherLine('surah.go_hadith'),
            beat: LessonBeat.advancing,
            happy: true,
            then: _next,
          ),
        );
      case HadithLoopStep():
        final h = content.hadith.byId(step.hadithId);
        _set(
          _s.copyWith(
            screen: LessonScreen.hadith,
            hadith: h,
            repeatsTarget: step.repeats,
          ),
        );
        _say(
          _line('hadith.topic'),
          beat: LessonBeat.speaking,
          then: h.canPlay
              ? _startRecitation
              : () => _promptRepeat(fromRecitation: false),
        );
      case ProjectAssignStep():
        _set(
          _s.copyWith(
            screen: LessonScreen.projectAssign,
            project: content.projects.byId(step.projectId),
          ),
        );
        _progress = _progress.copyWith(projectAssigned: step.projectId);
        _sayLines(
          [...step.lines, step.question],
          question: step.question,
          expect: AnswerIntent.understood,
          onYes: () => _say(
            _line('project.bye'),
            beat: LessonBeat.advancing,
            happy: true,
            then: _next,
          ),
        );
      case ProjectReportStep():
        _set(
          _s.copyWith(
            screen: LessonScreen.projectReport,
            project: content.projects.byId(step.projectId),
            recordingElapsed: Duration.zero,
            clearRecorded: true,
            saveFailed: false,
          ),
        );
        _say(
          _line(
            _now().hour < 12 ? 'report.greet.morning' : 'report.greet.evening',
          ),
          beat: LessonBeat.speaking,
          happy: true,
          then: () => _say(
            _line(step.question),
            beat: LessonBeat.awaitMic,
            lineIndex: 1,
          ),
        );
      case LessonEndStep():
        _progress = _progress.copyWith(completed: true, stepIndex: i);
        unawaited(_safe(() => sink.completed(_progress)));
        _set(_s.copyWith(screen: LessonScreen.lessonEnd));
        void bye() => _say(
          _line('end.bye'),
          beat: LessonBeat.done,
          happy: true,
          then: _stopClock,
        );
        if (step.question == null) {
          _sayLines(step.lines, happyFirst: true, onDone: bye);
        } else {
          _sayLines(
            [...step.lines, step.question!],
            question: step.question,
            happyFirst: true,
            onYes: bye,
          );
        }
    }
  }

  void _next() => _enterStep(_s.stepIndex + 1);

  void _jumpAyah(int dir) {
    if (_paused) return;
    for (
      var i = _s.stepIndex + dir;
      i >= 0 && i < script.steps.length;
      i += dir
    ) {
      if (script.steps[i] is AyahLoopStep) {
        _enterStep(i);
        return;
      }
    }
  }

  // ═══ Recitation → repeats ═════════════════════════════════════════════════

  Future<void> _startRecitation() async {
    final isHadith = _s.screen == LessonScreen.hadith;
    final g = _enter(
      _s.copyWith(
        beat: LessonBeat.reciting,
        captionId: isHadith ? 'ui.listen_hadith' : 'ui.listen_ayah',
        caption: lineBank.resolve(
          TeacherLine(isHadith ? 'ui.listen_hadith' : 'ui.listen_ayah'),
        ),
        teacherSpeaking: false,
        playbackBlocked: false,
        happy: false,
      ),
      resume: () {
        if (!_s.playbackBlocked) unawaited(player.resume());
      },
      skip: stop,
    );
    await teacher
        .stopSpeaking(); // the teacher is silent while the reciter plays
    final RecitationAudio audio;
    try {
      audio = isHadith
          ? AssetRecitation(_s.hadith!.audioAsset!)
          : await content.audio.resolve(_s.ayahRef!);
    } on RecitationNotAvailable {
      if (g != _gen) return;
      _set(_s.copyWith(contentUnavailable: true));
      _promptRepeat(fromRecitation: false);
      return;
    }
    if (g != _gen) return;
    final ref = isHadith ? null : _s.ayahRef;
    teacher.onEvent(RecitationStarted(ref));
    try {
      await player.start(audio);
    } on PlaybackBlocked {
      if (g != _gen) return;
      teacher.onEvent(PlaybackBlockedEvent(ref));
      _set(_s.copyWith(playbackBlocked: true));
      return;
    }
    if (g != _gen || _paused) await player.pause();
  }

  void _onRecitationComplete() {
    if (_s.beat != LessonBeat.reciting || _paused) return;
    teacher.onEvent(
      RecitationFinished(_s.screen == LessonScreen.hadith ? null : _s.ayahRef),
    );
    _promptRepeat(fromRecitation: true);
  }

  /// «الآن ردّد بصوتك… ثلاث مرات.» with the mic's gold ring.
  void _promptRepeat({required bool fromRecitation}) =>
      _say(_repeatNow, beat: LessonBeat.awaitMic);

  /// «الآن ردّد بصوتك… ثلاث مرات.» — the bank line now takes the count
  /// (`{times}`, shared with the web v0.2 agent; the full 3-stage port follows).
  TeacherLine get _repeatNow => TeacherLine('ayah.repeat_now', {
    'times': switch (_s.repeatsTarget) {
      1 => 'مرة واحدة',
      2 => 'مرتين',
      3 => 'ثلاث مرات',
      4 => 'أربع مرات',
      5 => 'خمس مرات',
      final n => '$n مرات',
    },
  });

  void _enterListening() {
    final isHadith = _s.screen == LessonScreen.hadith;
    final id = _s.repeatsDone == 0
        ? (isHadith ? 'ui.hearing_hadith' : 'ui.hearing_ayah')
        : 'ui.hearing';
    final g = _enter(
      _s.copyWith(
        beat: LessonBeat.listening,
        captionId: id,
        caption: lineBank.resolve(TeacherLine(id)),
        teacherSpeaking: false,
        micDenied: false,
      ),
      resume: _enterListening,
      keepListening: true,
    );
    unawaited(teacher.stopSpeaking());
    _listen(ListenMode.repeats, g).then((ok) {
      if (ok && g == _gen) _armSilence(g);
    });
  }

  void _armSilence(int g) {
    _beatTimer?.cancel();
    _beatTimer = Timer(timings.silence, () {
      if (g == _gen && !_paused && _s.beat == LessonBeat.listening) {
        _onSilence();
      }
    });
  }

  void _onSilence() {
    _nudges++;
    if (_nudges > timings.maxNudges) {
      final canReplay =
          _s.screen == LessonScreen.ayah || _s.hadith?.canPlay == true;
      if (!_autoReplayed && canReplay) {
        _autoReplayed = true;
        _nudges = 0;
        _startRecitation();
      }
      // Already replayed once: keep listening quietly.
      return;
    }
    final remaining = _s.repeatsTarget - _s.repeatsDone;
    _say(
      TeacherLine(switch (remaining) {
        1 => 'nudge.one_left',
        2 => 'nudge.two_left',
        _ => 'nudge.start',
      }),
      beat: LessonBeat.nudging,
      then: _enterListening,
    );
  }

  void _countRepeat() {
    final n = _s.repeatsDone + 1;
    _nudges = 0; // the child is repeating again — nudges start over
    _set(_s.copyWith(repeatsDone: n));
    final remaining = _s.repeatsTarget - n;
    if (remaining <= 0) {
      _praise();
      return;
    }
    _say(
      remaining == 1
          ? const TeacherLine('count.one_left')
          : remaining == 2
          ? const TeacherLine('count.two_left')
          : TeacherLine('count.more', {'remaining': remaining.arabicDigits}),
      beat: LessonBeat.counted,
      then: _enterListening,
    );
  }

  void _praise() {
    if (_s.screen == LessonScreen.hadith) {
      _progress = _progress.copyWith(
        hadithDone: {..._progress.hadithDone, _s.hadith!.id},
      );
      final toProject =
          _s.stepIndex + 1 < script.steps.length &&
          script.steps[_s.stepIndex + 1] is ProjectAssignStep;
      _say(
        _line('hadith.praise'),
        beat: LessonBeat.praising,
        happy: true,
        then: toProject
            ? () => _say(
                const TeacherLine('hadith.to_project'),
                beat: LessonBeat.advancing,
                happy: true,
                then: _next,
              )
            : _next,
      );
      return;
    }
    final ref = _s.ayahRef!;
    final done = {..._progress.doneRefs, ref};
    _progress = _progress.copyWith(doneRefs: done);
    final nextStep = _s.stepIndex + 1 < script.steps.length
        ? script.steps[_s.stepIndex + 1]
        : null;
    final nextRef = nextStep is AyahLoopStep && nextStep.ref.surah == ref.surah
        ? nextStep.ref
        : null;
    if (nextRef == null) {
      final count = content.meta.ayahCount(ref.surah);
      final whole = [for (var a = 1; a <= count; a++) QuranRef(ref.surah, a)]
          .every(done.contains);
      if (whole) {
        _progress = _progress.copyWith(
          surahsCompleted: {..._progress.surahsCompleted, ref.surah},
        );
      }
      _say(
        const TeacherLine('praise.all_done'),
        beat: LessonBeat.praising,
        happy: true,
        then: () => _say(
          _line('surah.complete'),
          beat: LessonBeat.awaitContinue,
          happy: true,
        ),
      );
      return;
    }
    final isLastNext =
        !(_s.stepIndex + 2 < script.steps.length &&
            script.steps[_s.stepIndex + 2] is AyahLoopStep &&
            (script.steps[_s.stepIndex + 2] as AyahLoopStep).ref.surah ==
                ref.surah);
    final firstOfRun =
        !(_s.stepIndex > 0 &&
            script.steps[_s.stepIndex - 1] is AyahLoopStep &&
            (script.steps[_s.stepIndex - 1] as AyahLoopStep).ref.surah ==
                ref.surah);
    final id = isLastNext
        ? 'praise.last_left'
        : firstOfRun
        ? 'praise.first'
        : 'praise.next';
    _say(
      _line(id, {'ordinal': TeacherLineBank.ordinal(nextRef.ayah)}),
      beat: LessonBeat.praising,
      happy: true,
      then: _next,
    );
  }

  // ═══ Questions («جاهز؟» / «إن شاء الله» / «أبشر») ════════════════════════

  /// Says [lines] in order; if [question] is the last one, waits for the answer.
  void _sayLines(
    List<String> lines, {
    String? question,
    AnswerIntent expect = AnswerIntent.yes,
    VoidCallback? onYes,
    VoidCallback? onDone,
    bool happyLines = false,
    bool happyFirst = false,
    int from = 0,
  }) {
    if (from >= lines.length) {
      onDone?.call();
      return;
    }
    final id = lines[from];
    final isQuestion = question != null && from == lines.length - 1;
    if (isQuestion) {
      _question = _Question(TeacherLine(id), expect, onYes ?? () {});
      _say(_line(id), beat: LessonBeat.awaitMic, lineIndex: from);
      return;
    }
    _say(
      _line(id),
      beat: LessonBeat.speaking,
      lineIndex: from,
      happy: happyLines || (happyFirst && from == 0),
      then: () => _sayLines(
        lines,
        question: question,
        expect: expect,
        onYes: onYes,
        onDone: onDone,
        happyLines: happyLines,
        happyFirst: happyFirst,
        from: from + 1,
      ),
    );
  }

  void _enterHearingAnswer() {
    teacher.onEvent(const MicOpened());
    final g = _enter(
      _s.copyWith(
        beat: LessonBeat.hearingAnswer,
        captionId: 'ui.hearing',
        caption: lineBank.resolve(const TeacherLine('ui.hearing')),
        teacherSpeaking: false,
        micDenied: false,
      ),
      resume: _enterHearingAnswer,
      keepListening: true,
    );
    unawaited(teacher.stopSpeaking());
    unawaited(_listen(ListenMode.answer, g));
  }

  void _onAnswer(AnswerIntent intent) {
    final q = _question;
    if (q == null) return;
    final accepted =
        intent == q.expect ||
        (intent == AnswerIntent.yes && q.expect == AnswerIntent.understood) ||
        (intent == AnswerIntent.understood && q.expect == AnswerIntent.yes);
    if (!accepted) {
      // Ask again, kindly — the mic closes until the child opens it.
      _say(_line(q.line.id), beat: LessonBeat.awaitMic);
      return;
    }
    _question = null;
    unawaited(_stopListening());
    q.onYes();
  }

  // ═══ Project report (frame 22) ════════════════════════════════════════════

  Future<void> _startRecording() async {
    final g = _enter(
      _s.copyWith(
        beat: LessonBeat.recording,
        captionId: 'ui.hearing_report',
        caption: lineBank.resolve(const TeacherLine('ui.hearing_report')),
        teacherSpeaking: false,
        recordingElapsed: Duration.zero,
        clearRecorded: true,
        micDenied: false,
        saveFailed: false,
      ),
      resume: () {
        unawaited(recorder.resume());
        _startRecClock();
      },
    );
    await teacher.stopSpeaking();
    try {
      await recorder.start();
    } on MicPermissionDenied {
      if (g != _gen) return;
      _enter(
        _s.copyWith(beat: LessonBeat.awaitMic, micDenied: true),
        resume: () {},
      );
      return;
    }
    if (g != _gen) return;
    if (_paused) {
      await recorder.pause();
      return;
    }
    _startRecClock();
    _beatTimer = Timer(timings.maxRecording, () {
      if (g == _gen && _s.beat == LessonBeat.recording) _stopRecording();
    });
  }

  void _startRecClock() {
    _recClock?.cancel();
    _recClock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_s.beat == LessonBeat.recording && !_paused) {
        _set(
          _s.copyWith(
            recordingElapsed: _s.recordingElapsed + const Duration(seconds: 1),
          ),
        );
      }
    });
  }

  Future<void> _stopRecording() async {
    _recClock?.cancel();
    final g = ++_gen;
    _beatTimer?.cancel();
    final rec = await recorder.stop();
    if (g != _gen) {
      if (rec != null) await recorder.discard(rec);
      return;
    }
    _setLevel(0);
    if (rec == null) {
      // Nothing usable — ask again.
      _say(
        _line((_step as ProjectReportStep).question),
        beat: LessonBeat.awaitMic,
      );
      return;
    }
    _recorded = rec;
    _set(_s.copyWith(recordedDuration: rec.duration));
    _say(
      _line('report.thanks'),
      beat: LessonBeat.recorded,
      happy: true,
      then: _armAutoAdvance,
    );
  }

  void _armAutoAdvance() {
    final g = _gen;
    _resume = _armAutoAdvance;
    _beatTimer?.cancel();
    _beatTimer = Timer(timings.recordedAutoAdvance, () {
      if (g == _gen && !_paused && _s.beat == LessonBeat.recorded) {
        _saveReport();
      }
    });
  }

  Future<void> _saveReport() async {
    final rec = _recorded;
    if (rec == null || _saving) return;
    _saving = true;
    _set(_s.copyWith(saveFailed: false));
    final step = _step as ProjectReportStep;
    final toHadith =
        _s.stepIndex + 1 < script.steps.length &&
        script.steps[_s.stepIndex + 1] is HadithLoopStep;
    final said = Completer<void>();
    if (toHadith) {
      _say(
        const TeacherLine('report.to_hadith'),
        beat: LessonBeat.advancing,
        happy: true,
        then: said.complete,
      );
    } else {
      _enter(_s.copyWith(beat: LessonBeat.advancing), resume: () {});
      said.complete();
    }
    final g = _gen;
    try {
      await sink.saveReport(step.projectId, rec);
    } catch (e) {
      _saving = false;
      debugPrint('Project report not saved: $e');
      // TODO(design): no designed "couldn't save" state — the recorded state
      // stays with a retry (continueTapped) and the recording is kept.
      _enter(
        _s.copyWith(beat: LessonBeat.recorded, saveFailed: true, happy: false),
        resume: () {},
      );
      return;
    }
    _saving = false;
    _recorded = null;
    unawaited(recorder.discard(rec)); // the local copy isn't needed any more
    _progress = _progress.copyWith(reportedProject: step.projectId);
    if (g == _gen) {
      await said.future.timeout(const Duration(seconds: 15), onTimeout: () {});
    }
    if (_s.screen == LessonScreen.projectReport && !_disposed) _next();
  }

  // ═══ Beat plumbing ════════════════════════════════════════════════════════

  /// Enters a beat: bumps the generation (stale work stops), cancels timers,
  /// closes the listening gate unless [keepListening].
  int _enter(
    LessonState s, {
    required VoidCallback resume,
    VoidCallback? skip,
    bool keepListening = false,
  }) {
    final g = ++_gen;
    _beatTimer?.cancel();
    _resume = resume;
    _skip = skip;
    if (!keepListening) unawaited(_stopListening());
    _set(s);
    return g;
  }

  /// Teacher says [line]; the mic is deaf meanwhile. [then] runs after the line
  /// (or immediately when the child taps the teacher to skip it).
  void _say(
    TeacherLine line, {
    required LessonBeat beat,
    bool happy = false,
    int? lineIndex,
    VoidCallback? then,
  }) {
    final text = lineBank.resolve(line);
    late final int g;
    void done() {
      if (g != _gen) return;
      _set(_s.copyWith(teacherSpeaking: false));
      then?.call();
    }

    g = _enter(
      _s.copyWith(
        beat: beat,
        captionId: line.id,
        caption: text,
        teacherSpeaking: true,
        happy: happy,
        lineIndex: lineIndex,
      ),
      resume: () => _say(
        line,
        beat: beat,
        happy: happy,
        lineIndex: lineIndex,
        then: then,
      ),
      skip: () {
        if (g != _gen) return;
        unawaited(teacher.stopSpeaking());
        done();
      },
    );
    if (_paused) return;
    () async {
      try {
        await teacher.speak(line, text);
      } catch (e) {
        debugPrint('Teacher line not spoken: $e'); // caption still shows it
      }
      if (g != _gen || _paused) return;
      // Echo guard before anything that listens.
      await Future<void>.delayed(timings.echoGuard);
      done();
    }();
  }

  Future<bool> _listen(ListenMode mode, int g) async {
    await Future<void>.delayed(timings.echoGuard);
    if (g != _gen || _paused) return false;
    try {
      await teacher.listen(mode);
    } on MicPermissionDenied {
      if (g != _gen) return false;
      _enter(
        _s.copyWith(beat: LessonBeat.awaitMic, micDenied: true),
        resume: () {},
      );
      return false;
    }
    if (g != _gen) {
      await teacher.stopListening();
      return false;
    }
    _listening = true;
    return true;
  }

  Future<void> _stopListening() async {
    if (!_listening) return;
    _listening = false;
    _setLevel(0);
    await teacher.stopListening();
  }

  void _onAction(TeacherAction a) {
    if (_paused || !_listening) return;
    switch (a) {
      case SpeechStarted():
        if (_s.beat == LessonBeat.listening) _beatTimer?.cancel();
      case RepeatDetected():
        if (_s.beat == LessonBeat.listening) _countRepeat();
      case AnswerDetected(:final intent):
        if (_s.beat == LessonBeat.hearingAnswer) _onAnswer(intent);
    }
  }

  void _applyPause() {
    if (_pauseApplied || _disposed) return;
    _pauseApplied = true;
    _gen++;
    _beatTimer?.cancel();
    _recClock?.cancel();
    unawaited(player.pause());
    unawaited(teacher.stopSpeaking());
    unawaited(_stopListening());
    if (_s.beat == LessonBeat.recording) unawaited(recorder.pause());
    _set(_s.copyWith(paused: true, teacherSpeaking: false));
  }

  void _maybeResume() {
    if (_paused || !_pauseApplied || _disposed) return;
    _pauseApplied = false;
    _set(_s.copyWith(paused: false));
    if (_s.screen == LessonScreen.ended) return;
    _resume?.call();
  }

  void _startClock() {
    _clock?.cancel();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_paused) {
        _set(_s.copyWith(elapsed: _s.elapsed + const Duration(seconds: 1)));
      }
    });
  }

  void _stopClock() => _clock?.cancel();

  void _cancelTimers() {
    _beatTimer?.cancel();
    _recClock?.cancel();
  }

  Future<void> _checkpoint(LessonProgress p) => _safe(() => sink.checkpoint(p));

  Future<void> _safe(Future<void> Function() f) async {
    try {
      await f();
    } catch (e) {
      debugPrint('Lesson progress not saved: $e');
    }
  }

  /// A bank line with this lesson's slots filled.
  TeacherLine _line(String id, [Map<String, String> extra = const {}]) {
    if (id == 'greet') {
      id = _now().hour < 12 ? 'greet.morning' : 'greet.evening';
    }
    final project = _s.project ?? _firstProject();
    final surah = _s.ayahRef?.surah ?? _introSurah();
    return TeacherLine(id, {
      'name': childFirstName,
      if (surah != null) 'surah': content.meta.surahName(surah),
      if (surah != null)
        'countWords': TeacherLineBank.ayatInWords(
          content.meta.ayahCount(surah),
        ),
      if (_s.hadith != null) 'hadithTitle': _s.hadith!.title,
      if (project != null) 'projectIntro': project.intro,
      if (project != null) 'projectTomorrow': project.tomorrow,
      if (project != null) 'reportAsk': project.reportAsk,
      ...extra,
    });
  }

  int? _introSurah() {
    for (final s in script.steps) {
      if (s is IntroStep) return s.surah;
      if (s is AyahLoopStep) return s.ref.surah;
    }
    return null;
  }

  ProjectContent? _firstProject() {
    for (final s in script.steps) {
      if (s is ProjectAssignStep) return content.projects.byId(s.projectId);
      if (s is ProjectReportStep) return content.projects.byId(s.projectId);
    }
    return null;
  }
}

class _Question {
  const _Question(this.line, this.expect, this.onYes);
  final TeacherLine line;
  final AnswerIntent expect;
  final VoidCallback onYes;
}
