import 'dart:convert';

import 'package:flutter/services.dart';

import '../../quran/data/quran_ref.dart';

/// A lesson in the ai/CONTRACT.md format (Draft v0.1). Religious content is
/// referenced (Quran by surah:ayah, hadith by id), never embedded.
class LessonScript {
  const LessonScript({
    required this.lessonId,
    required this.title,
    required this.steps,
    this.interim = false,
  });

  static const supportedContract = '0.1';

  factory LessonScript.fromJson(Map<String, dynamic> j) {
    final version = j['contractVersion'];
    if (version != supportedContract) {
      throw FormatException('Unsupported lesson contract version $version');
    }
    final steps = [
      for (final s in (j['steps'] as List).cast<Map<String, dynamic>>())
        LessonStep.fromJson(s),
    ];
    if (steps.isEmpty) throw const FormatException('Lesson has no steps');
    return LessonScript(
      lessonId: j['lessonId'] as String,
      title: j['title'] as String,
      steps: steps,
      interim: j['interim'] as bool? ?? false,
    );
  }

  static Future<LessonScript> load(String lessonId, [AssetBundle? bundle]) async =>
      LessonScript.fromJson(
        jsonDecode(
              await (bundle ?? rootBundle).loadString(
                'assets/lessons/$lessonId.json',
              ),
            )
            as Map<String, dynamic>,
      );

  final String lessonId;
  final String title;
  final List<LessonStep> steps;

  /// A clearly-marked placeholder script (e.g. the day-2 lesson).
  final bool interim;

  /// Every Quran ref the lesson recites (to prefetch audio before starting).
  Iterable<QuranRef> get quranRefs => steps.whereType<AyahLoopStep>().map(
    (s) => s.ref,
  );

  /// Checks refs against the mushaf; throws [FormatException] if invalid.
  void validate(QuranMeta meta) {
    for (final r in quranRefs) {
      if (!meta.isValid(r)) throw FormatException('Invalid ayah ${r.key}');
    }
    for (final s in steps.whereType<IntroStep>()) {
      meta.ayahCount(s.surah);
    }
  }
}

sealed class LessonStep {
  const LessonStep();

  factory LessonStep.fromJson(Map<String, dynamic> j) {
    List<String> lines() => (j['lines'] as List? ?? const []).cast<String>();
    int repeats() {
      final r = j['repeats'] as int? ?? 3;
      if (r < 1 || r > 10) throw FormatException('Bad repeats $r');
      return r;
    }

    return switch (j['type']) {
      'intro' => IntroStep(surah: j['surah'] as int, lines: lines()),
      'ayah_loop' => AyahLoopStep(
        ref: QuranRef.fromJson((j['ref'] as Map).cast<String, dynamic>()),
        repeats: repeats(),
      ),
      'surah_done' => SurahDoneStep(
        lines: lines(),
        question: j['question'] as String,
      ),
      'hadith_loop' => HadithLoopStep(
        hadithId: j['hadithId'] as String,
        repeats: repeats(),
      ),
      'project_assign' => ProjectAssignStep(
        projectId: j['projectId'] as String,
        lines: lines(),
        question: j['question'] as String? ?? 'project.ask',
      ),
      'project_report' => ProjectReportStep(
        projectId: j['projectId'] as String,
        question: j['question'] as String,
      ),
      'lesson_end' => LessonEndStep(
        lines: lines(),
        question: j['question'] as String?,
      ),
      final t => throw FormatException('Unknown step type $t'),
    };
  }
}

/// Frame 18 (plan). Surah facts: ayah count only — no Makki/Madani.
class IntroStep extends LessonStep {
  const IntroStep({required this.surah, required this.lines});
  final int surah;
  final List<String> lines;
}

/// Frame 18 (ayah state).
class AyahLoopStep extends LessonStep {
  const AyahLoopStep({required this.ref, required this.repeats});
  final QuranRef ref;
  final int repeats;
}

/// Frame 19.
class SurahDoneStep extends LessonStep {
  const SurahDoneStep({required this.lines, required this.question});
  final List<String> lines;
  final String question;
}

/// Frame 20.
class HadithLoopStep extends LessonStep {
  const HadithLoopStep({required this.hadithId, required this.repeats});
  final String hadithId;
  final int repeats;
}

/// Frame 21. The hints come from the project content, not the script.
class ProjectAssignStep extends LessonStep {
  const ProjectAssignStep({
    required this.projectId,
    required this.lines,
    required this.question,
  });
  final String projectId;
  final List<String> lines;
  final String question;
}

/// Frame 22 (next day, first).
class ProjectReportStep extends LessonStep {
  const ProjectReportStep({required this.projectId, required this.question});
  final String projectId;
  final String question;
}

/// Frame 23.
class LessonEndStep extends LessonStep {
  const LessonEndStep({required this.lines, this.question});
  final List<String> lines;

  /// Optional «تقدر تقول لي: أبشر؟» answer moment (app-side contract addition).
  final String? question;
}
