// ╔════════════════════════════════════════════════════════════════════════╗
// ║  MOCK DATA — copied from the approved design mockups (design/html).      ║
// ║  Used ONLY for: debug design-comparison previews (children), and the     ║
// ║  dashboard of a child with no progress yet (flagged isSample and shown  ║
// ║  with a visible «بيانات توضيحية» note). Delete before release (§11).    ║
// ╚════════════════════════════════════════════════════════════════════════╝

import '../features/children/data/child_profile.dart';
import '../features/dashboard/data/dashboard_data.dart';
import '../features/subscription/data/subscription.dart';

abstract final class MockData {
  /// 05-Packages «أبنائي» — debug previews only (lib/core/preview_data.dart).
  static final List<ChildProfile> children = [
    ChildProfile(
      id: 'mock-sara',
      name: 'سارة',
      age: 10,
      pairing: PairingInfo(
        code: '472918',
        expiresAt: DateTime(2100),
        status: 'active',
      ),
      gender: ChildGender.girl,
      avatarId: 'g1',
      isMock: true,
    ),
    ChildProfile(
      id: 'mock-abdullah',
      name: 'عبدالله',
      age: 12,
      pairing: PairingInfo(
        code: '308561',
        expiresAt: DateTime(2100),
        status: 'active',
      ),
      gender: ChildGender.boy,
      avatarId: 'b1',
      isMock: true,
    ),
  ];

  /// 12-Dashboard stats — the design sample for a child with no progress yet.
  static const ChildStats stats = ChildStats(
    yearProgress: 35,
    month: 2,
    week: 1,
    surahs: 7,
    ayat: 49,
    hadith: 4,
    projects: 3,
  );

  // ── 13–16 dashboard detail panels (design sample data) ──

  /// 13-DashProjects — completed projects with the child's recording.
  static const List<MockProject> projects = [
    MockProject(
      title: 'برّ الوالدين',
      date: 'اكتمل في ١٢ رجب',
      note: '«ساعدتُ أمي في ترتيب المطبخ بعد العشاء، وقرأتُ لأبي رسالته.»',
      seconds: 47,
    ),
    MockProject(
      title: 'الصدقة',
      date: 'اكتمل في ٥ رجب',
      note: '«أعطيتُ ريالًا لعامل النظافة عند البقالة.»',
      seconds: 39,
    ),
    MockProject(
      title: 'إفشاء السلام',
      date: 'اكتمل في ٢٨ جمادى الآخرة',
      note: '«سلّمتُ على جيراننا عند باب المسجد.»',
      seconds: 31,
    ),
  ];
  static const String pendingProject = 'إماطة الأذى عن الطريق';

  /// 14-DashSurahs.
  static const ({String name, int percent}) surahInProgress = (
    name: 'سورة الكوثر',
    percent: 60,
  );
  static const List<({String name, String date})> surahsDone = [
    (name: 'سورة الناس', date: '١٤ رجب'),
    (name: 'سورة الفلق', date: '٨ رجب'),
    (name: 'سورة الإخلاص', date: '٢ رجب'),
    (name: 'سورة المسد', date: '٢٦ جمادى الآخرة'),
    (name: 'سورة النصر', date: '١٩ جمادى الآخرة'),
    (name: 'سورة الكافرون', date: '١٢ جمادى الآخرة'),
    (name: 'سورة الفاتحة', date: '٥ جمادى الآخرة'),
  ];

  /// 15-DashHadith — topics only; no hadith text is shown on this screen.
  static const List<({String name, String date})> hadithDone = [
    (name: 'برّ الوالدين', date: '١٢ رجب'),
    (name: 'الصدقة', date: '٥ رجب'),
    (name: 'إفشاء السلام', date: '٢٨ جمادى الآخرة'),
    (name: 'إماطة الأذى', date: '٢٠ جمادى الآخرة'),
  ];

  /// 16-DashAyat — surah names only; no Quran text is shown on this screen.
  static const List<String> ayatSurahs = [
    'الفاتحة',
    'الكافرون',
    'النصر',
    'المسد',
    'الإخلاص',
    'الفلق',
    'الناس',
  ];
  static const String ayatInProgress = 'الكوثر';
  static const int ayatSurahCount = 8;
  static const int ayatAddedThisWeek = 3;

  /// 05-Packages plan card, used while the parent has no subscription document.
  /// Design values: «سنوية», ٢٤٧ days left, bar at 68%, ends ٠٢ / ٠٣ / ٢٠٢٦.
  /// TODO(phase-c): needs a designed "no subscription yet" state instead.
  static const SamplePlan plan = SamplePlan(
    plan: SubscriptionPlan.annual,
    daysLeft: 247,
    remainingFraction: 0.68,
    expiresOn: (day: 2, month: 3, year: 2026),
  );
}

class MockProject {
  const MockProject({
    required this.title,
    required this.date,
    required this.note,
    required this.seconds,
  });

  final String title;
  final String date;

  /// The child's own words about the project (sample).
  final String note;

  /// Recording length shown before playback (design value).
  final int seconds;
}

class SamplePlan {
  const SamplePlan({
    required this.plan,
    required this.daysLeft,
    required this.remainingFraction,
    required this.expiresOn,
  });

  final SubscriptionPlan plan;
  final int daysLeft;
  final double remainingFraction;
  final ({int day, int month, int year}) expiresOn;
}
