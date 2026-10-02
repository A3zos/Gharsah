import 'package:flutter/services.dart';

import '../../../core/arabic_digits.dart';
import '../../children/data/child_profile.dart';
import '../../lesson/data/hadith_repository.dart';
import '../../lesson/data/lesson_script.dart';
import '../../quran/data/quran_ref.dart';

/// The child's CURRENT plan as a timeline: its steps in order (from the plan
/// data — the pilot day scripts in assets/lessons/, never the card), each
/// step's state, and progress = done steps ÷ total steps. Same rules as
/// web/src/data/planProgress.ts. Today every child is on the pilot plan.
class PlanStep {
  const PlanStep({required this.id, required this.title, required this.detail});

  /// The lesson behind the step (progress.lesson_id).
  final String id;

  /// «اليوم ١»
  final String title;

  /// «سورة الإخلاص + حديث برّ الوالدين»
  final String detail;
}

class Plan {
  const Plan({required this.name, required this.cadence, required this.steps});

  final String name;

  /// «حصة واحدة يوميًا»
  final String cadence;
  final List<PlanStep> steps;

  static const pilotName = 'الباقة التجريبية';
  static const pilotLessons = ['pilot-day-1', 'pilot-day-2', 'pilot-day-3'];

  /// The pilot plan: each day = its script's surah + hadith.
  static Future<Plan> loadPilot(
    QuranMeta meta,
    HadithRepository hadith, [
    AssetBundle? bundle,
  ]) async {
    final scripts = await Future.wait([
      for (final id in pilotLessons) LessonScript.load(id, bundle),
    ]);
    return Plan(
      name: pilotName,
      cadence: 'حصة واحدة يوميًا',
      steps: [
        for (final (i, s) in scripts.indexed)
          PlanStep(
            id: s.lessonId,
            title: 'اليوم ${(i + 1).arabicDigits}',
            detail:
                'سورة ${meta.surahName(s.steps.whereType<IntroStep>().first.surah)}'
                ' + ${hadith.byId(s.steps.whereType<HadithLoopStep>().first.hadithId).title}',
          ),
      ],
    );
  }
}

/// done — finished (with its date); today — open now; missed — open since an
/// earlier day and not done yet; locked — not open yet ([TimelineStep.tomorrow]
/// on the first locked step: it opens tomorrow at the earliest).
enum PlanStepState { done, today, missed, locked }

class TimelineStep {
  const TimelineStep(
    this.step,
    this.state, {
    this.doneAt,
    this.tomorrow = false,
  });

  final PlanStep step;
  final PlanStepState state;
  final DateTime? doneAt;
  final bool tomorrow;
}

enum PlanStage { seed, sprout, tree }

const planStageNames = {
  PlanStage.seed: 'بذرة',
  PlanStage.sprout: 'غَرْسة',
  PlanStage.tree: 'شجرة',
};

/// The growth badge from the plan %: بذرة 0–33, غَرْسة 34–99, شجرة 100.
PlanStage planStage(int pct) => pct >= 100
    ? PlanStage.tree
    : pct >= 34
    ? PlanStage.sprout
    : PlanStage.seed;

/// «2026-10-05» — the calendar day in Riyadh (UTC+3).
String riyadhDay(DateTime d) =>
    d.toUtc().add(const Duration(hours: 3)).toIso8601String().substring(0, 10);

String _nextDay(String ymd) =>
    DateTime.parse('${ymd}T00:00:00Z')
        .add(const Duration(days: 1))
        .toIso8601String()
        .substring(0, 10);

class PlanProgress {
  const PlanProgress(this.plan, this.steps);

  /// One step a day, in order: a step opens the Riyadh day after the previous
  /// one was finished; the first one when the child was added.
  factory PlanProgress.of(Plan plan, ChildProfile child, {DateTime? now}) {
    final today = riyadhDay(now ?? DateTime.now());
    String? prevDone;
    var open = false;
    final steps = <TimelineStep>[];
    for (final (i, s) in plan.steps.indexed) {
      final at = child.pilotDoneAt[s.id];
      if (!open && at != null) {
        prevDone = riyadhDay(at);
        steps.add(TimelineStep(s, PlanStepState.done, doneAt: at));
        continue;
      }
      if (!open) {
        open = true;
        if (i > 0 && prevDone == today) {
          steps.add(TimelineStep(s, PlanStepState.locked, tomorrow: true));
          continue;
        }
        final openedOn = i == 0
            ? (child.createdAt == null ? today : riyadhDay(child.createdAt!))
            : _nextDay(prevDone ?? today);
        steps.add(
          TimelineStep(
            s,
            openedOn.compareTo(today) < 0
                ? PlanStepState.missed
                : PlanStepState.today,
          ),
        );
        continue;
      }
      steps.add(TimelineStep(s, PlanStepState.locked));
    }
    // the first locked step after an open one opens tomorrow at the earliest
    final first = steps.indexWhere((s) => s.state == PlanStepState.locked);
    if (first > 0 && steps[first - 1].state != PlanStepState.done) {
      steps[first] = TimelineStep(
        steps[first].step,
        PlanStepState.locked,
        tomorrow: true,
      );
    }
    return PlanProgress(plan, steps);
  }

  final Plan plan;
  final List<TimelineStep> steps;

  int get done => steps.where((s) => s.state == PlanStepState.done).length;
  int get total => steps.length;

  /// done ÷ total, 0–100.
  int get pct => total == 0 ? 0 : (done * 100 / total).round();
  PlanStage get stage => planStage(pct);

  /// «أتمّ ١ من ٣ أيام (٣٣٪) من الباقة التجريبية» / «أكمل الباقة التجريبية 🎉»
  String get sentence => total > 0 && done >= total
      ? 'أكمل ${plan.name} 🎉'
      : 'أتمّ ${done.arabicDigits} من ${total.arabicDigits} أيام (${pct.arabicDigits}٪) من ${plan.name}';

  /// «١٠ سنوات · حصة واحدة يوميًا · الباقة التجريبية»
  String subtitle(int age) =>
      '${age.arabicDigits} ${age >= 3 && age <= 10 ? 'سنوات' : 'سنة'} · ${plan.cadence} · ${plan.name}';
}
