import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/mock_data.dart';
import '../../children/data/child_profile.dart';
import '../../lesson/agent/lesson_agent.dart';
import '../../lesson/agent/lesson_state.dart';
import '../../lesson/recording/project_recorder.dart';
import 'child_session.dart';
import 'leaderboard.dart';
import 'student_repository.dart';

/// DEBUG builds only — the mock child «عبدالله» entered with the demo code
/// ٤٧٢٩١٨ on the child tab. No server at all: the child, board and progress
/// live in memory (the lesson itself — Quran text, recitation, LessonAgent —
/// is real). `StudentRepository.forSession` only returns this under
/// `kDebugMode`, so release builds never reach it.
class DebugStudentRepository implements StudentRepository {
  DebugStudentRepository(this.session)
    : assert(kDebugMode, 'debug mock repository in a release build');

  @override
  final ChildSession session;

  // Shared by StudentHome and the lesson screen for the whole app run, so a
  // finished or left lesson shows up on the home hero («أكمل الحصة»).
  static final Map<String, StoredProgress> _progress = {};
  static final _changes =
      StreamController<Map<String, StoredProgress>>.broadcast();

  static const _week = 'debug-week';

  /// The design's sample numbers for عبدالله (frame 17).
  ChildProfile get _child {
    final base = MockData.children.firstWhere((c) => c.id == session.childId);
    return ChildProfile(
      id: base.id,
      name: base.name,
      age: base.age,
      gender: base.gender,
      avatarId: base.avatarId,
      pairing: base.pairing,
      linked: true,
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
      schedule: ChildSchedule.initial,
      stats: const {
        'stage': 'sprout',
        'streak': 5,
        'surahs': 8,
        'hadith': 4,
        'projects': 3,
      },
      leader: const {
        'weekKey': _week,
        'rank': 5,
        'points': 295,
        'total': 25,
        'topPercent': 20,
        'gapToAbove': 15,
      },
      isMock: true,
    );
  }

  @override
  Stream<ChildProfile?> watchChild() => Stream.value(_child);

  @override
  Stream<Map<String, StoredProgress>> watchProgress() =>
      // Current value first, then every change — subscribed synchronously on
      // listen so no checkpoint written in between is missed.
      Stream.multi((c) {
        c.add(Map.of(_progress));
        final sub = _changes.stream.listen(c.add);
        c.onCancel = sub.cancel;
      });

  @override
  Stream<LeaderBoard?> watchLeaderboard() => Stream.value(
    const LeaderBoard(
      weekKey: _week,
      total: 25,
      rows: [(1, 420), (2, 385), (3, 340), (4, 310), (5, 295)],
    ),
  );

  @override
  LessonProgressSink sinkFor(String lessonId) => _MemorySink();
}

class _MemorySink implements LessonProgressSink {
  void _store(LessonProgress p) {
    DebugStudentRepository._progress[p.lessonId] = StoredProgress(
      p,
      DateTime.now(),
    );
    DebugStudentRepository._changes.add(
      Map.of(DebugStudentRepository._progress),
    );
  }

  @override
  Future<void> checkpoint(LessonProgress progress) async => _store(progress);

  @override
  Future<void> completed(LessonProgress progress) async => _store(progress);

  /// The report recording is kept nowhere in debug mock mode.
  @override
  Future<void> saveReport(String projectId, RecordedAudio audio) async {
    debugPrint(
      'DEBUG mock child: report for $projectId '
      '(${audio.duration.inSeconds}s) not uploaded — mock mode.',
    );
    await Future<void>.delayed(const Duration(milliseconds: 400));
  }
}
