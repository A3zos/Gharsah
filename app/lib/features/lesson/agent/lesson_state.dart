import '../../quran/data/quran_ref.dart';
import '../data/hadith_repository.dart';
import '../data/project_repository.dart';

/// Which design frame the lesson is on.
enum LessonScreen {
  loading,
  intro, // 18 (plan)
  ayah, // 18 (ayah loop)
  surahDone, // 19
  hadith, // 20
  projectAssign, // 21
  projectReport, // 22
  lessonEnd, // 23
  ended, // left the call (checkpoint saved)
  failed, // content couldn't be prepared
}

/// The live moment inside a screen. Screens map it to the design's states.
enum LessonBeat {
  /// Teacher says a line; mic closed (dimmed).
  speaking,

  /// Reciter plays; teacher quiet; mic closed (dimmed).
  reciting,

  /// Waiting for the child to open the mic (gold ring) — to repeat, answer or record.
  awaitMic,

  /// Mic open, hearing the child's repeats.
  listening,

  /// Teacher counts by voice («باقي مرتين»); mic stays open.
  counted,

  /// Silence nudge («باقي مرة، هيا…»); mic stays open.
  nudging,

  /// Teacher praises after the last repeat; mic idle.
  praising,

  /// Frame 18 «complete» — the gold arrow to continue.
  awaitContinue,

  /// Mic open for a short answer («قل: نعم»).
  hearingAnswer,

  /// Handoff line («ننتقل…») — moving to the next screen.
  advancing,

  /// Frame 22 — recording the project report.
  recording,

  /// Frame 22 — recorded («حُفظ صوتك» + «أعِد التسجيل»).
  recorded,

  /// Frame 23 — lesson finished; only «عودة للرئيسية» remains.
  done,
}

/// Everything a lesson screen renders. Produced only by `LessonAgent`.
class LessonState {
  const LessonState({
    this.screen = LessonScreen.loading,
    this.beat = LessonBeat.speaking,
    this.stepIndex = 0,
    this.lineIndex = 0,
    this.caption = '',
    this.captionId,
    this.teacherSpeaking = false,
    this.happy = false,
    this.ayahRef,
    this.ayahText,
    this.ayahReference,
    this.surahName,
    this.surahAyahCount,
    this.hadith,
    this.project,
    this.repeatsDone = 0,
    this.repeatsTarget = 3,
    this.playbackBlocked = false,
    this.paused = false,
    this.micDenied = false,
    this.saveFailed = false,
    this.contentUnavailable = false,
    this.elapsed = Duration.zero,
    this.recordingElapsed = Duration.zero,
    this.recordedDuration,
    this.endedByUser = false,
  });

  final LessonScreen screen;
  final LessonBeat beat;
  final int stepIndex;

  /// Index of the current line within the step (drives e.g. the plan cards'
  /// highlight on frame 18 and the project hints on frame 21).
  final int lineIndex;

  /// The one line under the teacher (a teacher line or a silent caption).
  final String caption;
  final String? captionId;
  final bool teacherSpeaking;

  /// Praise moments (happy eyes, green caption).
  final bool happy;

  final QuranRef? ayahRef;

  /// Verified Tanzil text — never generated.
  final String? ayahText;

  /// «سورة الإخلاص · الآية ١»
  final String? ayahReference;
  final String? surahName;
  final int? surahAyahCount;
  final Hadith? hadith;
  final ProjectContent? project;
  final int repeatsDone;
  final int repeatsTarget;

  /// Autoplay was refused — show only the design's small fallback play.
  final bool playbackBlocked;
  final bool paused;

  /// TODO(design): no designed state for a denied mic permission yet.
  final bool micDenied;

  /// TODO(design): the project report couldn't be saved — retry.
  final bool saveFailed;

  /// TODO(design): the recitation audio isn't on the device (offline).
  final bool contentUnavailable;

  /// Call timer (frames 18–23 «٠٢:٤٦»).
  final Duration elapsed;
  final Duration recordingElapsed;
  final Duration? recordedDuration;
  final bool endedByUser;

  /// The design's "mic live" (gold, pulse, voice bars).
  bool get micLive =>
      beat == LessonBeat.listening ||
      beat == LessonBeat.counted ||
      beat == LessonBeat.nudging ||
      beat == LessonBeat.hearingAnswer;

  /// The teacher leans in (listening) vs. talks vs. stays quiet (reciter).
  bool get teacherListening =>
      beat == LessonBeat.listening ||
      beat == LessonBeat.hearingAnswer ||
      beat == LessonBeat.recording;
  bool get teacherQuiet => beat == LessonBeat.reciting;

  LessonState copyWith({
    LessonScreen? screen,
    LessonBeat? beat,
    int? stepIndex,
    int? lineIndex,
    String? caption,
    String? captionId,
    bool? teacherSpeaking,
    bool? happy,
    QuranRef? ayahRef,
    String? ayahText,
    String? ayahReference,
    String? surahName,
    int? surahAyahCount,
    Hadith? hadith,
    ProjectContent? project,
    int? repeatsDone,
    int? repeatsTarget,
    bool? playbackBlocked,
    bool? paused,
    bool? micDenied,
    bool? saveFailed,
    bool? contentUnavailable,
    Duration? elapsed,
    Duration? recordingElapsed,
    Duration? recordedDuration,
    bool clearRecorded = false,
    bool? endedByUser,
  }) => LessonState(
    screen: screen ?? this.screen,
    beat: beat ?? this.beat,
    stepIndex: stepIndex ?? this.stepIndex,
    lineIndex: lineIndex ?? this.lineIndex,
    caption: caption ?? this.caption,
    captionId: captionId ?? this.captionId,
    teacherSpeaking: teacherSpeaking ?? this.teacherSpeaking,
    happy: happy ?? this.happy,
    ayahRef: ayahRef ?? this.ayahRef,
    ayahText: ayahText ?? this.ayahText,
    ayahReference: ayahReference ?? this.ayahReference,
    surahName: surahName ?? this.surahName,
    surahAyahCount: surahAyahCount ?? this.surahAyahCount,
    hadith: hadith ?? this.hadith,
    project: project ?? this.project,
    repeatsDone: repeatsDone ?? this.repeatsDone,
    repeatsTarget: repeatsTarget ?? this.repeatsTarget,
    playbackBlocked: playbackBlocked ?? this.playbackBlocked,
    paused: paused ?? this.paused,
    micDenied: micDenied ?? this.micDenied,
    saveFailed: saveFailed ?? this.saveFailed,
    contentUnavailable: contentUnavailable ?? this.contentUnavailable,
    elapsed: elapsed ?? this.elapsed,
    recordingElapsed: recordingElapsed ?? this.recordingElapsed,
    recordedDuration: clearRecorded
        ? null
        : (recordedDuration ?? this.recordedDuration),
    endedByUser: endedByUser ?? this.endedByUser,
  );
}

/// What the child has done in this lesson — saved as a checkpoint after each
/// step and on leaving the call, so «أكمل الحصة» resumes where they stopped.
class LessonProgress {
  const LessonProgress({
    required this.lessonId,
    this.stepIndex = 0,
    this.doneRefs = const {},
    this.surahsCompleted = const {},
    this.hadithDone = const {},
    this.projectAssigned,
    this.reportedProject,
    this.completed = false,
  });

  final String lessonId;

  /// The step to resume at.
  final int stepIndex;
  final Set<QuranRef> doneRefs;
  final Set<int> surahsCompleted;
  final Set<String> hadithDone;
  final String? projectAssigned;
  final String? reportedProject;
  final bool completed;

  LessonProgress copyWith({
    int? stepIndex,
    Set<QuranRef>? doneRefs,
    Set<int>? surahsCompleted,
    Set<String>? hadithDone,
    String? projectAssigned,
    String? reportedProject,
    bool? completed,
  }) => LessonProgress(
    lessonId: lessonId,
    stepIndex: stepIndex ?? this.stepIndex,
    doneRefs: doneRefs ?? this.doneRefs,
    surahsCompleted: surahsCompleted ?? this.surahsCompleted,
    hadithDone: hadithDone ?? this.hadithDone,
    projectAssigned: projectAssigned ?? this.projectAssigned,
    reportedProject: reportedProject ?? this.reportedProject,
    completed: completed ?? this.completed,
  );
}
