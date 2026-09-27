import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/core/time_format.dart';
import 'package:gharsah/features/auth/data/pairing_repository.dart';
import 'package:gharsah/features/children/data/child_profile.dart';
import 'package:gharsah/features/dashboard/data/dashboard_data.dart';

import '../lesson/fakes.dart';

void main() {
  final content = realContent();
  // Dates arrive as ISO strings from child_stats / Postgres.
  final when = DateTime(2026, 1, 1, 12);
  final t = when.toUtc().toIso8601String();

  ChildProfile child(Map<String, dynamic>? stats, {DateTime? created}) =>
      ChildProfile.fromRow(
        {
          'id': 'c1',
          'name': 'سارة',
          'age': 10,
          'gender': 'girl',
          'avatar': 'g1',
          'created_at': (created ?? DateTime(2026, 1, 1))
              .toUtc()
              .toIso8601String(),
        },
        pairing: {
          'code': '123456',
          'expiresAt': DateTime(2026, 1, 2).toUtc().toIso8601String(),
          'status': 'active',
          'linked': true,
        },
        stats: stats,
      );

  DashboardData build(ChildProfile c, [DateTime? now]) =>
      DashboardData.fromChild(
        c,
        meta: content.meta,
        hadith: content.hadith,
        projects: content.projects,
        now: now,
      );

  test('child row: server pairing + link parsed', () {
    final c = child(null);
    expect(c.pairingCode, '123456');
    expect(c.pairing!.isActive(DateTime(2026, 1, 1, 23)), isTrue);
    expect(c.pairing!.isActive(DateTime(2026, 1, 2, 1)), isFalse);
    expect(c.linked, isTrue);
    expect(PairingInfo.fromMap({'code': 1}), isNull);
    expect(
      ChildProfile.newRow(
        parentId: 'u',
        draft: const ChildDraft(
          name: ' سارة ',
          age: 10,
          gender: ChildGender.girl,
          avatarId: 'g1',
        ),
      ).keys,
      isNot(contains('pairing')),
    );
  });

  test('no stats yet → design sample, flagged', () {
    final d = build(child(null));
    expect(d.isSample, isTrue);
    expect(d.stats.ayat, 49);
  });

  test(
    'real stats → numbers, names, Hijri dates, topics (no religious text)',
    () {
      final d = build(
        child({
          'ayat': 11,
          'surahs': 2,
          'hadith': 1,
          'projects': 1,
          'streak': 3,
          'planPct': 4,
          'surahsDone': [
            {'surah': 1, 'at': t},
            {'surah': 112, 'at': t},
          ],
          'surahInProgress': {'surah': 113, 'done': 2},
          'hadithDone': [
            {'id': 'PLACEHOLDER-birr-alwalidayn', 'at': t},
            {'id': 'unknown-id', 'at': t},
          ],
          'ayatBySurah': {'1': 7, '112': 4, '113': 2},
          'latestAyat': {'surah': 113, 'count': 2},
          'pendingProject': 'birr-3-acts',
        }),
        DateTime(2026, 2, 12),
      );
      expect(d.isSample, isFalse);
      expect(d.stats.yearProgress, 4);
      expect(d.stats.month, 2); // 42 days after being added
      expect(d.stats.week, 2);
      expect(d.stats.streak, 3);
      expect(d.surahsDone.map((e) => e.name), ['سورة الإخلاص', 'سورة الفاتحة']);
      expect(d.surahsDone.first.date, formatHijriDayMonth(when));
      expect(d.surahInProgress!.name, 'سورة الفلق');
      expect(d.surahInProgress!.percent, 40);
      expect(d.hadithDone.single.name, 'برّ الوالدين'); // unknown ids dropped
      expect(d.ayatSurahs, ['الفاتحة', 'الإخلاص']);
      expect(d.ayatInProgress, 'الفلق');
      expect(d.ayatLatest!.count, 2);
      expect(d.pendingProject, 'برّ والديك اليوم بعمل');
    },
  );

  test('bad stats values never crash the dashboard', () {
    final d = build(
      child({
        'ayat': 'x',
        'planPct': 400,
        'surahsDone': [
          {'surah': 999},
        ],
        'ayatBySurah': {'abc': 3},
      }),
    );
    expect(d.stats.ayat, 0);
    expect(d.stats.yearProgress, 100);
    expect(d.ayatSurahs, isEmpty);
  });

  test('Hijri date in the design style (Umm al-Qura)', () {
    // 1 January 2026 = 12 Rajab 1447 AH.
    expect(formatHijriDayMonth(DateTime(2026, 1, 1, 12)), '١٢ رجب');
  });

  test('pairing function errors become Arabic messages', () {
    expect(
      pairingFailure('no-active-subscription').message,
      'فعّل اشتراكك أولًا لإصدار رمز الربط.',
    );
    expect(pairingFailure('child-not-found').message, contains('لم نجد'));
    expect(pairingFailure('internal').message, contains('الاتصال'));
  });

  test('a new child row carries review days (1–3, lesson days only)', () {
    final row = ChildProfile.newRow(
      parentId: 'u',
      draft: const ChildDraft(
        name: 'سارة',
        age: 10,
        gender: ChildGender.girl,
        avatarId: 'g1',
      ),
    );
    expect(row['schedule_days'], [0, 1, 2, 4, 5]);
    expect(row['review_days'], [5]); // الخميس
    final s = ChildSchedule.fromRow(row)!;
    expect(s.reviewDays, {WeekDay.thu});
    expect(
      ChildSchedule.initial
          .copyWith(reviewDays: {WeekDay.tue, WeekDay.sat})
          .toRow()['review_days'],
      [0], // الثلاثاء isn't a lesson day
    );
  });
}
