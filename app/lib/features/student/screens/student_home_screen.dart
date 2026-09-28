import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../../children/data/child_profile.dart';
import '../../lesson/data/lesson_script.dart';
import '../../lesson/screens/lesson_screen.dart';
import '../data/child_session.dart';
import '../data/leaderboard.dart';
import '../data/student_repository.dart';
import 'student_home_view.dart';

/// «خطوات» of a lesson as the hero counts them: the intro and its ayat are
/// one step; every other step is one (the seed lesson has 5, as designed).
List<int> lessonStepGroups(LessonScript s) {
  final starts = <int>[];
  for (var i = 0; i < s.steps.length; i++) {
    final st = s.steps[i];
    final joinsPrevious =
        st is AyahLoopStep &&
        i > 0 &&
        (s.steps[i - 1] is AyahLoopStep || s.steps[i - 1] is IntroStep);
    if (!joinsPrevious) starts.add(i);
  }
  return starts;
}

String stageLabel(Object? stage) => switch (stage) {
  'sprout' => 'غَرْسة',
  'tree' => 'شجرة',
  _ => 'بذرة',
};

/// Frame 17 — the linked child's home.
class StudentHomeScreen extends StatefulWidget {
  const StudentHomeScreen({super.key, required this.session});

  final ChildSession session;

  @override
  State<StudentHomeScreen> createState() => _StudentHomeScreenState();
}

class _StudentHomeScreenState extends State<StudentHomeScreen> {
  late final StudentRepository _repo = StudentRepository.forSession(
    widget.session,
  );
  late final Stream<ChildProfile?> _child = _repo.watchChild();
  late final Stream<Map<String, StoredProgress>> _progress = _repo
      .watchProgress();
  late final Stream<LeaderBoard?> _board = _repo.watchLeaderboard();
  final Map<String, LessonScript> _scripts = {};

  @override
  void initState() {
    super.initState();
    for (final id in lessonSequence) {
      LessonScript.load(id).then((s) {
        if (mounted) setState(() => _scripts[id] = s);
      });
    }
  }

  TodayHero? _hero(TodayLesson today, Map<String, StoredProgress> stored) {
    final content = AppScope.of(context).content;
    String id;
    int done;
    var finished = false;
    switch (today) {
      case LessonAvailable(:final lessonId, :final resume):
        id = lessonId;
        final groups = _scripts[id] == null
            ? const <int>[]
            : lessonStepGroups(_scripts[id]!);
        done = resume == null
            ? 0
            : groups.where((g) => g < resume.stepIndex).length - 1;
        done = done.clamp(0, groups.length);
      case LessonDoneToday():
        finished = true;
        id = lessonSequence.lastWhere(
          (l) => stored[l]?.progress.completed ?? false,
          orElse: () => lessonSequence.first,
        );
        done = _scripts[id] == null
            ? 0
            : lessonStepGroups(_scripts[id]!).length;
    }
    final script = _scripts[id];
    if (script == null) return null;
    final chips = <(String, bool)>[];
    for (final s in script.steps) {
      if (s is IntroStep) {
        chips.add(('سورة ${content.meta.surahName(s.surah)}', false));
      }
      if (s is HadithLoopStep) {
        chips.add((content.hadith.byId(s.hadithId).title, true));
      }
    }
    return TodayHero(
      chips: chips,
      doneSteps: done,
      totalSteps: lessonStepGroups(script).length,
      finishedToday: finished,
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.session;
    return StreamBuilder<ChildProfile?>(
      stream: _child,
      builder: (context, childSnap) =>
          StreamBuilder<Map<String, StoredProgress>>(
            stream: _progress,
            builder: (context, progSnap) => StreamBuilder<LeaderBoard?>(
              stream: _board,
              builder: (context, boardSnap) {
                final child = childSnap.data;
                final stats = child?.stats ?? const {};
                int n(String k) => (stats[k] as num?)?.toInt() ?? 0;
                final stored = progSnap.data;
                final today = stored == null
                    ? null
                    : pickTodayLesson(stored, DateTime.now());
                final name = child?.name ?? s.name;
                final avatar = child?.avatarId ?? s.avatar;
                final board = buildBoard(
                  board: boardSnap.data,
                  // Only the child's own row is named — its first name.
                  myName: name.trim().split(RegExp(r'\s+')).first,
                  myAvatar: avatar,
                );
                return StudentHomeView(
                  data: StudentHomeData(
                    name: name,
                    avatarId: avatar,
                    stage: stageLabel(stats['stage']),
                    streak: n('streak'),
                    surahs: n('surahs'),
                    hadith: n('hadith'),
                    projects: n('projects'),
                    hero: today == null ? null : _hero(today, stored!),
                    leaders: board.rows,
                    leaderOwn: board.own,
                    leaderSeparator: board.separator,
                    leaderNote: board.note,
                    daysLeftInWeek: daysUntilReset(DateTime.now()),
                  ),
                  onStart: today is LessonAvailable
                      ? () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => LessonCallScreen(
                              session: s,
                              lessonId: today.lessonId,
                              resume: today.resume,
                            ),
                          ),
                        )
                      : null,
                );
              },
            ),
          ),
    );
  }
}
