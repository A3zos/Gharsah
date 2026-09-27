import 'package:flutter/widgets.dart';

import '../features/auth/data/pairing_repository.dart';
import '../features/children/data/child_profile.dart';
import '../features/children/data/children_repository.dart';
import '../features/dashboard/data/submissions_repository.dart';
import '../features/lesson/agent/lesson_state.dart';
import '../features/lesson/screens/lesson_view.dart';
import '../features/quran/data/quran_ref.dart';
import '../features/student/data/leaderboard.dart';
import '../features/student/screens/student_home_view.dart';
import 'app_content.dart';
import 'arabic_digits.dart';
import 'debug_preview.dart';
import 'mock_data.dart';

// Debug design-comparison previews only (`?screen=…` on a debug/profile web
// build, see lib/core/debug_preview.dart). Never used in a release build.

class PreviewChildrenRepository implements ChildrenRepository {
  @override
  Stream<List<ChildProfile>> watchChildren() => Stream.value(MockData.children);

  @override
  Stream<ChildProfile?> watchChild(String childId) => Stream.value(
    MockData.children.firstWhere(
      (c) => c.id == childId,
      orElse: () => MockData.children.first,
    ),
  );

  @override
  Future<ChildProfile> addChild(ChildDraft draft) async =>
      MockData.children.first;
}

class PreviewPairingRepository implements PairingRepository {
  @override
  Future<PairingInfo> issueCode(String childId) async =>
      MockData.children.first.pairing!;

  @override
  Future<PairingInfo> revokeAndReissue(String childId) async =>
      MockData.children.first.pairing!;
}

class PreviewSubmissionsRepository implements SubmissionsRepository {
  @override
  Stream<List<ProjectSubmission>> watch(String childId) =>
      Stream.value(const []);

  @override
  Future<String> signedUrl(ProjectSubmission s) async => '';

  @override
  Future<void> delete(String childId, ProjectSubmission s) async {}
}

// ── 17–23 previews (the design's opening moment of each frame) ──────────────

class NoLessonActions implements LessonActions {
  const NoLessonActions();
  @override
  void tapTeacher() {}
  @override
  void micTap() {}
  @override
  void continueTapped() {}
  @override
  void replayAyah() {}
  @override
  void play() {}
  @override
  void reRecord() {}
  @override
  void endCall() {}
  @override
  void goHome() {}
}

Widget previewStudentHome() => StudentHomeView(
  data: StudentHomeData(
    name: 'عبدالله',
    avatarId: 'b1',
    stage: 'غَرْسة',
    streak: 5,
    surahs: 8,
    hadith: 4,
    projects: 3,
    hero: const TodayHero(
      chips: [('سورة الإخلاص', false), ('حديث برّ الوالدين', true)],
      doneSteps: 0,
      totalSteps: 5,
    ),
    // Anonymous board as shipped (product-owner rule): «طالب N» + one
    // generic avatar for others; the design's point values.
    leaders: buildBoard(
      board: const LeaderBoard(
        weekKey: 'w',
        total: 25,
        rows: [(1, 420), (2, 385), (3, 340), (4, 310), (5, 295)],
      ),
      own: const {
        'weekKey': 'w',
        'rank': 5,
        'points': 295,
        'topPercent': 20,
        'gapToAbove': 15,
      },
      myName: 'عبدالله',
      myAvatar: 'b1',
    ).rows,
    leaderNote: 'أنت ضمن أفضل ٢٠٪ هذا الأسبوع — باقي ١٥ نقطة لتلحق بطالب ٤.',
    daysLeftInWeek: 3,
  ),
  onStart: () {},
);

Widget? previewLesson(String frame, AppContent content) {
  final project = content.projects.byId('birr-3-acts');
  final hadith = content.hadith.byId('PLACEHOLDER-birr-alwalidayn');
  const plan = LessonPlanInfo(
    surahName: 'الإخلاص',
    surahAyat: 4,
    hadithTitle: 'حديث برّ الوالدين',
    hasProject: true,
  );
  const glance = ChildGlance(
    surahsTotal: 8,
    streak: 5,
    streakDays: ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'اليوم'],
  );
  final s = switch (frame) {
    '18' => const LessonState(
      screen: LessonScreen.intro,
      caption: 'مساء الخير عبدالله! أنا معك الآن.',
      captionId: 'greet.evening',
      teacherSpeaking: true,
      elapsed: Duration(seconds: 24),
    ),
    '19' => const LessonState(
      screen: LessonScreen.surahDone,
      caption: 'أربع آيات بصوتك… فخور بك.',
      captionId: 'surah.proud',
      lineIndex: 1,
      happy: true,
      surahName: 'الإخلاص',
      surahAyahCount: 4,
      elapsed: Duration(minutes: 5, seconds: 2),
    ),
    '20' => LessonState(
      screen: LessonScreen.hadith,
      beat: LessonBeat.reciting,
      caption: 'استمع للحديث… وأنا صامت معك',
      captionId: 'ui.listen_hadith',
      hadith: hadith,
      elapsed: const Duration(minutes: 6, seconds: 12),
    ),
    '21' => LessonState(
      screen: LessonScreen.projectAssign,
      caption: project.tomorrow,
      captionId: 'project.tomorrow',
      lineIndex: 1,
      project: project,
      elapsed: const Duration(minutes: 8, seconds: 19),
    ),
    '22' => LessonState(
      screen: LessonScreen.projectReport,
      beat: LessonBeat.awaitMic,
      caption: project.reportAsk,
      captionId: 'report.ask',
      lineIndex: 1,
      project: project,
      elapsed: const Duration(seconds: 38),
    ),
    '23' => const LessonState(
      screen: LessonScreen.lessonEnd,
      caption: 'بكرة، قبل الدرس، علّمني كيف بررت والديك.',
      captionId: 'project.tomorrow',
      lineIndex: 1,
      elapsed: Duration(minutes: 9, seconds: 47),
    ),
    // Ayah loop, Al-Ikhlas ayah N (?screen=lesson-ayah&ayah=N): the verified
    // Tanzil text from content, as the agent shows it.
    'ayah' => _ayahPreview(content, DebugPreview.intParam('ayah') ?? 1),
    _ => null,
  };
  if (s == null) return null;
  return LessonView(
    state: s,
    plan: plan,
    glance: glance,
    actions: const NoLessonActions(),
  );
}

LessonState _ayahPreview(AppContent content, int ayah) {
  final r = QuranRef(112, ayah.clamp(1, 4));
  final surah = content.meta.surahName(r.surah);
  return LessonState(
    screen: LessonScreen.ayah,
    beat: LessonBeat.awaitMic,
    caption: 'الآن ردّد بصوتك… ثلاث مرات.',
    captionId: 'ayah.repeat_now',
    ayahRef: r,
    ayahText: content.text.text(r),
    ayahReference: 'سورة $surah · الآية ${r.ayah.arabicDigits}',
    surahName: surah,
    surahAyahCount: content.meta.ayahCount(r.surah),
    elapsed: const Duration(minutes: 1, seconds: 40),
  );
}
