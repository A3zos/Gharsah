import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/children/data/child_profile.dart';
import 'package:gharsah/features/dashboard/data/plan_progress.dart';
import 'package:gharsah/features/lesson/data/hadith_repository.dart';
import 'package:gharsah/features/quran/data/quran_ref.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // noon Riyadh (UTC+3) on 2026-10-05
  final now = DateTime.utc(2026, 10, 5, 9);
  DateTime at(int day) => DateTime.utc(2026, 10, day, 9);
  late Plan plan;

  setUpAll(() async {
    plan = await Plan.loadPilot(
      await QuranMeta.load(),
      await HadithRepository.load(),
    );
  });

  ChildProfile child(Map<String, DateTime> done, {int created = 5}) =>
      ChildProfile(
        id: 'c',
        name: 'راكان',
        age: 10,
        gender: ChildGender.boy,
        avatarId: 'boy-1',
        createdAt: at(created),
        pilotDoneAt: done,
      );

  test('the pilot steps come from the day scripts, in order', () {
    expect(
      [for (final s in plan.steps) '${s.title}: ${s.detail}'],
      [
        'اليوم ١: سورة الإخلاص + حديث برّ الوالدين',
        'اليوم ٢: سورة الناس + حديث عن الكذب',
        'اليوم ٣: سورة الفلق + حديث عن الغضب',
      ],
    );
  });

  test('nothing done: day 1 today, day 2 opens tomorrow, 0٪ بذرة', () {
    final p = PlanProgress.of(plan, child({}), now: now);
    expect(p.steps.map((s) => s.state), [
      PlanStepState.today,
      PlanStepState.locked,
      PlanStepState.locked,
    ]);
    expect(p.steps[1].tomorrow, isTrue);
    expect((p.pct, p.stage), (0, PlanStage.seed));
    expect(p.subtitle(10), '١٠ سنوات · حصة واحدة يوميًا · الباقة التجريبية');
  });

  test('day 1 done today → 33٪, day 2 opens tomorrow', () {
    final p = PlanProgress.of(plan, child({'pilot-day-1': at(5)}), now: now);
    expect(p.steps.map((s) => s.state), [
      PlanStepState.done,
      PlanStepState.locked,
      PlanStepState.locked,
    ]);
    expect(p.steps[1].tomorrow, isTrue);
    expect(p.sentence, 'أتمّ ١ من ٣ أيام (٣٣٪) من الباقة التجريبية');
  });

  test('2/3 → 67٪ غَرْسة; a day passed without a lesson → فاته', () {
    final p = PlanProgress.of(
      plan,
      child({'pilot-day-1': at(3), 'pilot-day-2': at(4)}),
      now: now,
    );
    expect(p.steps[2].state, PlanStepState.today);
    expect((p.pct, p.stage), (67, PlanStage.sprout));
    expect(
      PlanProgress.of(
        plan,
        child({'pilot-day-1': at(2)}),
        now: now,
      ).steps[1].state,
      PlanStepState.missed,
    );
  });

  test('all done → 100٪ شجرة, «أكمل الباقة التجريبية 🎉»', () {
    final p = PlanProgress.of(
      plan,
      child({'pilot-day-1': at(1), 'pilot-day-2': at(2), 'pilot-day-3': at(3)}),
      now: now,
    );
    expect((p.pct, p.stage), (100, PlanStage.tree));
    expect(p.sentence, 'أكمل الباقة التجريبية 🎉');
  });
}
