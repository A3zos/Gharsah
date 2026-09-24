import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/children/data/child_profile.dart';
import 'package:gharsah/features/lesson/agent/lesson_state.dart';
import 'package:gharsah/features/lesson/screens/lesson_screen.dart';
import 'package:gharsah/features/student/data/student_repository.dart';
import 'package:gharsah/features/student/screens/student_home_screen.dart';

import '../lesson/fakes.dart';

StoredProgress _p(String id, {int step = 0, bool done = false, DateTime? at}) =>
    StoredProgress(
      LessonProgress(lessonId: id, stepIndex: step, completed: done),
      at,
    );

void main() {
  final now = DateTime(2026, 9, 24, 18);

  group("today's lesson", () {
    test('nothing yet → the seed lesson, fresh', () {
      final t = pickTodayLesson({}, now) as LessonAvailable;
      expect(t.lessonId, 'm01-w03-ikhlas');
      expect(t.resume, isNull);
    });

    test('left mid-lesson → «أكمل الحصة» resumes at the checkpoint', () {
      final t = pickTodayLesson({
        'm01-w03-ikhlas': _p('m01-w03-ikhlas', step: 3),
      }, now) as LessonAvailable;
      expect(t.resume!.stepIndex, 3);
    });

    test('finished today → the next lesson waits for tomorrow', () {
      final stored = {
        'm01-w03-ikhlas': _p('m01-w03-ikhlas', done: true, at: now),
      };
      expect(pickTodayLesson(stored, now), isA<LessonDoneToday>());
      final tomorrow = pickTodayLesson(
        stored,
        now.add(const Duration(days: 1)),
      ) as LessonAvailable;
      expect(tomorrow.lessonId, 'm01-w03-day2'); // report first, next day
    });

    test('everything done → done', () {
      final stored = {
        'm01-w03-ikhlas': _p(
          'm01-w03-ikhlas',
          done: true,
          at: DateTime(2026, 9, 20),
        ),
        'm01-w03-day2': _p(
          'm01-w03-day2',
          done: true,
          at: DateTime(2026, 9, 21),
        ),
      };
      expect(pickTodayLesson(stored, now), isA<LessonDoneToday>());
    });
  });

  test('hero steps: 5 for the seed lesson (as designed), 3 for day 2', () {
    expect(lessonStepGroups(loadScript('m01-w03-ikhlas')).length, 5);
    expect(lessonStepGroups(loadScript('m01-w03-day2')).length, 3);
  });

  test('stage labels', () {
    expect(
      [
        stageLabel('seed'),
        stageLabel('sprout'),
        stageLabel('tree'),
        stageLabel(null),
      ],
      ['بذرة', 'غَرْسة', 'شجرة', 'بذرة'],
    );
  });

  test('streak row: last scheduled days, ending «اليوم»', () {
    final c = ChildProfile(
      id: 'c',
      name: 'سارة',
      age: 10,
      gender: ChildGender.girl,
      avatarId: 'g1',
      stats: const {'streak': 5, 'surahs': 8},
      schedule: const ChildSchedule(
        days: {WeekDay.sat, WeekDay.sun, WeekDay.mon, WeekDay.tue, WeekDay.thu},
        time: 1020,
        custom: {},
        duration: 45,
      ),
    );
    // 2026-09-24 is a Thursday.
    final g = LessonCallScreenGlance.of(c, now);
    expect(g.streakDays, ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'اليوم']);
    expect(g.surahsTotal, 8);
  });
}
