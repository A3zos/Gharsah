import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../core/mock_data.dart';
import '../../../core/time_format.dart';
import '../../children/data/child_profile.dart';
import '../../lesson/data/hadith_repository.dart';
import '../../lesson/data/project_repository.dart';
import '../../quran/data/quran_ref.dart';

/// Headline numbers for the growth hero and the four stat cards (12).
class ChildStats {
  const ChildStats({
    required this.yearProgress,
    required this.month,
    required this.week,
    required this.surahs,
    required this.ayat,
    required this.hadith,
    required this.projects,
    this.streak = 0,
  });

  /// Percent of the yearly plan (0–100) → growth stage.
  final int yearProgress;
  final int month;
  final int week;
  final int surahs;
  final int ayat;
  final int hadith;
  final int projects;

  /// Consecutive *scheduled* lesson days completed.
  final int streak;
}

/// A finished item in a detail panel: «سورة الناس» · «١٤ رجب».
class DashItem {
  const DashItem({required this.name, required this.date});
  final String name;
  final String date;
}

/// Everything frames 12–16 show for one child.
///
/// Built from the server-written `stats` on the child document; when the child
/// has no progress yet, [DashboardData.sample] shows the design's sample data
/// and [isSample] is true so the screen can mark it clearly.
class DashboardData {
  const DashboardData({
    required this.stats,
    required this.surahsDone,
    required this.surahInProgress,
    required this.hadithDone,
    required this.ayatSurahs,
    required this.ayatInProgress,
    required this.ayatLatest,
    required this.pendingProject,
    required this.isSample,
  });

  final ChildStats stats;
  final List<DashItem> surahsDone;
  final ({String name, int percent})? surahInProgress;

  /// Hadith *topics* only (e.g. «برّ الوالدين») — never hadith text.
  final List<DashItem> hadithDone;

  /// Surah names with memorized ayat (no Quran text).
  final List<String> ayatSurahs;
  final String? ayatInProgress;
  final ({int count, String surah})? ayatLatest;

  /// Title of the project assigned but not reported yet.
  final String? pendingProject;
  final bool isSample;

  /// «الشهر ٢ · الأسبوع ١» of the child's plan, counted from when the child
  /// was added.
  static ({int month, int week}) planPosition(DateTime? start, DateTime now) {
    if (start == null) return (month: 1, week: 1);
    final days = now.difference(start).inDays.clamp(0, 100000);
    return (month: days ~/ 30 + 1, week: ((days % 30) ~/ 7 + 1).clamp(1, 4));
  }

  /// Parses `stats` (schema written by functions/src/progress.ts).
  factory DashboardData.fromChild(
    ChildProfile child, {
    required QuranMeta meta,
    required HadithRepository hadith,
    required ProjectRepository projects,
    DateTime? now,
  }) {
    final s = child.stats;
    if (s == null) return DashboardData.sample(child, now: now);
    int num0(Object? v) => v is num ? v.toInt() : 0;
    int n(String k) => num0(s[k]);
    String date(Object? t) =>
        t is Timestamp ? formatHijriDayMonth(t.toDate()) : '';
    String surahName(Object? v) {
      final i = num0(v);
      return i >= 1 && i <= 114 ? meta.surahName(i) : '';
    }

    List<Map<String, dynamic>> list(String k) => [
      for (final e in (s[k] as List? ?? const []))
        if (e is Map) Map<String, dynamic>.from(e),
    ];

    final pos = planPosition(child.createdAt, now ?? DateTime.now());
    final surahsDone = [
      for (final e in list('surahsDone').reversed)
        if (surahName(e['surah']).isNotEmpty)
          DashItem(name: 'سورة ${surahName(e['surah'])}', date: date(e['at'])),
    ];
    final prog = s['surahInProgress'];
    ({String name, int percent})? inProgress;
    if (prog is Map && num0(prog['surah']) >= 1 && num0(prog['surah']) <= 114) {
      final surah = num0(prog['surah']);
      final done = num0(prog['done']);
      inProgress = (
        name: 'سورة ${meta.surahName(surah)}',
        percent: (done * 100 / meta.ayahCount(surah)).round().clamp(0, 100),
      );
    }
    String topic(String id) {
      try {
        return hadith.byId(id).topic;
      } on StateError {
        return '';
      }
    }

    final bySurah = <int, int>{
      for (final e in (s['ayatBySurah'] as Map? ?? const {}).entries)
        if ((int.tryParse('${e.key}') ?? 0) >= 1 &&
            (int.tryParse('${e.key}') ?? 0) <= 114 &&
            e.value is num)
          int.parse('${e.key}'): (e.value as num).toInt(),
    };
    final full = [
      for (final k in bySurah.keys.toList()..sort())
        if (bySurah[k] == meta.ayahCount(k)) meta.surahName(k),
    ];
    final partial = [
      for (final k in bySurah.keys)
        if (bySurah[k]! < meta.ayahCount(k)) meta.surahName(k),
    ];
    final latest = s['latestAyat'];
    String? pending;
    final pid = s['pendingProject'];
    if (pid is String) {
      try {
        pending = projects.byId(pid).title;
      } on StateError {
        pending = null;
      }
    }
    return DashboardData(
      stats: ChildStats(
        yearProgress: n('planPct').clamp(0, 100),
        month: pos.month,
        week: pos.week,
        surahs: n('surahs'),
        ayat: n('ayat'),
        hadith: n('hadith'),
        projects: n('projects'),
        streak: n('streak'),
      ),
      surahsDone: surahsDone,
      surahInProgress: inProgress,
      hadithDone: [
        for (final e in list('hadithDone').reversed)
          if (topic('${e['id']}').isNotEmpty)
            DashItem(name: topic('${e['id']}'), date: date(e['at'])),
      ],
      ayatSurahs: full,
      ayatInProgress: partial.isEmpty ? null : partial.first,
      ayatLatest: latest is Map && surahName(latest['surah']).isNotEmpty
          ? (count: num0(latest['count']), surah: surahName(latest['surah']))
          : null,
      pendingProject: pending,
      isSample: false,
    );
  }

  /// The design's sample (MockData) — shown only while the child has no real
  /// progress yet, and flagged with [isSample].
  factory DashboardData.sample(ChildProfile child, {DateTime? now}) {
    const m = MockData.stats;
    return DashboardData(
      stats: m,
      surahsDone: [
        for (final s in MockData.surahsDone)
          DashItem(name: s.name, date: s.date),
      ],
      surahInProgress: MockData.surahInProgress,
      hadithDone: [
        for (final h in MockData.hadithDone)
          DashItem(name: h.name, date: h.date),
      ],
      ayatSurahs: MockData.ayatSurahs,
      ayatInProgress: MockData.ayatInProgress,
      ayatLatest: (
        count: MockData.ayatAddedThisWeek,
        surah: MockData.ayatInProgress,
      ),
      pendingProject: MockData.pendingProject,
      isSample: true,
    );
  }
}
