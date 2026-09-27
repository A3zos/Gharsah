import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supa.dart';
import '../../children/data/child_profile.dart';
import '../../lesson/agent/lesson_agent.dart';
import '../../lesson/agent/lesson_state.dart';
import '../../lesson/data/lesson_script.dart';
import '../../lesson/recording/project_recorder.dart';
import '../../quran/data/quran_ref.dart';
import 'child_session.dart';
import 'debug_student_repository.dart';
import 'leaderboard.dart';
import 'upload_stub.dart' if (dart.library.io) 'upload_io.dart' as upload;

/// The lesson sequence (interim until the yearly plan is delivered): the
/// seed lesson, then the product-owner-approved interim day-2 lesson.
const lessonSequence = ['m01-w03-ikhlas', 'm01-w03-day2'];

/// A lesson checkpoint as stored in `progress`.
class StoredProgress {
  const StoredProgress(this.progress, this.updatedAt);
  final LessonProgress progress;
  final DateTime? updatedAt;
}

/// What StudentHome shows for «حصة اليوم».
sealed class TodayLesson {
  const TodayLesson();
}

class LessonAvailable extends TodayLesson {
  const LessonAvailable(this.lessonId, this.resume);
  final String lessonId;

  /// Non-null when the child left mid-lesson («أكمل الحصة»).
  final LessonProgress? resume;
}

/// Today's lesson is done; the next one opens tomorrow.
/// TODO(design): no designed «done for today» hero state.
class LessonDoneToday extends TodayLesson {
  const LessonDoneToday();
}

/// Picks today's lesson: the first unfinished lesson in [lessonSequence];
/// a lesson that follows one finished *today* waits until tomorrow.
TodayLesson pickTodayLesson(Map<String, StoredProgress> stored, DateTime now) {
  DateTime? lastDone;
  for (final id in lessonSequence) {
    final s = stored[id];
    if (s != null && s.progress.completed) {
      lastDone = s.updatedAt;
      continue;
    }
    if (lastDone != null && _sameDay(lastDone, now)) {
      return const LessonDoneToday();
    }
    final resume = s != null && s.progress.stepIndex > 0 ? s.progress : null;
    return LessonAvailable(id, resume);
  }
  return const LessonDoneToday();
}

bool _sameDay(DateTime a, DateTime b) {
  final x = a.toLocal(), y = b.toLocal();
  return x.year == y.year && x.month == y.month && x.day == y.day;
}

/// The database stage of a checkpoint (same rule as the web's stageOf):
/// until the 3-stage agent flow lands (review notes C9), the stage follows the
/// script step the child is on; it only ever moves forward, like the steps.
String stageOf(LessonScript script, LessonProgress p) {
  if (p.completed) return 'done';
  final i = p.stepIndex;
  final step = i >= 0 && i < script.steps.length ? script.steps[i] : null;
  return switch (step) {
    AyahLoopStep() => 'ayah_repeat',
    SurahDoneStep() => 'full_twice',
    HadithLoopStep() || ProjectAssignStep() || LessonEndStep() => 'hadith',
    _ => 'listen_full',
  };
}

/// A `progress` row → the LessonAgent's checkpoint (same meaning as before):
/// the surah counts as completed from the hadith stage on; the hadith once the
/// child is past its step.
LessonProgress progressFromRow(
  String lessonId,
  Map<String, dynamic> r, {
  LessonScript? script,
}) {
  final stepIndex = (r['step_index'] as num?)?.toInt() ?? 0;
  final completed = r['stage'] == 'done';
  final steps = script?.steps ?? const <LessonStep>[];
  final intro = steps.whereType<IntroStep>().firstOrNull;
  final hIdx = steps.indexWhere((s) => s is HadithLoopStep);
  final hadith = hIdx >= 0 ? steps[hIdx] as HadithLoopStep : null;
  return LessonProgress(
    lessonId: lessonId,
    stepIndex: stepIndex,
    doneRefs: {
      for (final x in (r['done_refs'] as List? ?? const []))
        if (x is String && x.contains(':'))
          QuranRef(int.parse(x.split(':')[0]), int.parse(x.split(':')[1])),
    },
    surahsCompleted: {
      if (intro != null && (completed || r['stage'] == 'hadith')) intro.surah,
    },
    hadithDone: {
      if (hadith != null && (completed || stepIndex > hIdx)) hadith.hadithId,
    },
    projectAssigned: r['project_assigned'] as String?,
    reportedProject: r['reported_project'] as String?,
    completed: completed,
  );
}

/// The child device's view of its own data.
abstract interface class StudentRepository {
  /// The repository for [session]: Supabase — or, in DEBUG builds only, the
  /// in-memory mock child (see debug_student_repository.dart).
  factory StudentRepository.forSession(ChildSession session) =>
      kDebugMode && session.debugMock
      ? DebugStudentRepository(session)
      : SupabaseStudentRepository(session);

  ChildSession get session;
  Stream<ChildProfile?> watchChild();
  Stream<Map<String, StoredProgress>> watchProgress();
  Stream<LeaderBoard?> watchLeaderboard();
  LessonProgressSink sinkFor(String lessonId);
}

const _childColumns =
    'id, name, age, gender, avatar, schedule_days, schedule_time, schedule_custom, '
    'session_duration, reminder, review_days, created_at';

/// Supabase implementation (RLS: a paired device reads its own child row,
/// progress and stars, writes its own progress and reports, and reads the
/// weekly board through `get_leaderboard()` — other children anonymous).
class SupabaseStudentRepository implements StudentRepository {
  SupabaseStudentRepository(this.session);

  @override
  final ChildSession session;

  final Map<String, LessonScript> _scripts = {};

  Future<LessonScript?> _script(String id) async {
    if (_scripts[id] case final s?) return s;
    try {
      return _scripts[id] = await LessonScript.load(id);
    } on Object {
      return null;
    }
  }

  /// get_leaderboard() → the board + this child's standing in the `leader` shape.
  Future<(LeaderBoard?, Map<String, dynamic>?)> _board() async {
    try {
      final d = await supa.rpc('get_leaderboard');
      if (d is! Map) return (null, null);
      return (LeaderBoard.fromRpc(d), LeaderBoard.ownFromRpc(d));
    } on Object {
      return (null, null);
    }
  }

  @override
  Stream<ChildProfile?> watchChild() => watchQuery(
    [
      Watched('children', column: 'id', value: session.childId),
      Watched('progress', column: 'child_id', value: session.childId),
      Watched('star_events', column: 'child_id', value: session.childId),
      Watched('submissions', column: 'child_id', value: session.childId),
    ],
    () async {
      final r = await supa
          .from('children')
          .select(_childColumns)
          .eq('id', session.childId)
          .maybeSingle();
      if (r == null) return null;
      final stats = await supa.rpc(
        'child_stats',
        params: {'c': session.childId},
      );
      final (_, own) = await _board();
      return ChildProfile.fromRow(r, stats: stats, leader: own);
    },
  );

  /// Checkpoints of the lessons in [lessonSequence].
  @override
  Stream<Map<String, StoredProgress>> watchProgress() => watchQuery(
    [Watched('progress', column: 'child_id', value: session.childId)],
    () async {
      final rows = await supa
          .from('progress')
          .select(
            'lesson_id, stage, step_index, done_refs, project_assigned, reported_project, updated_at',
          )
          .eq('child_id', session.childId)
          .inFilter('lesson_id', lessonSequence);
      return {
        for (final r in rows)
          '${r['lesson_id']}': StoredProgress(
            progressFromRow(
              '${r['lesson_id']}',
              r,
              script: await _script('${r['lesson_id']}'),
            ),
            parseDate(r['updated_at']),
          ),
      };
    },
  );

  /// The anonymous weekly board (refreshed every 30 min by pg_cron): re-read
  /// on the child's own stars and every 5 minutes.
  @override
  Stream<LeaderBoard?> watchLeaderboard() {
    late final StreamController<LeaderBoard?> c;
    Timer? timer;
    Future<void> load() async {
      final (b, _) = await _board();
      if (!c.isClosed) c.add(b);
    }

    c = StreamController<LeaderBoard?>(
      onListen: () {
        unawaited(load());
        timer = Timer.periodic(
          const Duration(minutes: 5),
          (_) => unawaited(load()),
        );
      },
      onCancel: () async {
        timer?.cancel();
        await c.close();
      },
    );
    return c.stream;
  }

  @override
  LessonProgressSink sinkFor(String lessonId) =>
      SupabaseLessonProgressSink(this, lessonId);
}

/// Writes lesson checkpoints to `progress` (INSERT once, then UPDATE — the
/// column grants allow the device only the flow columns) and the project
/// report to the private `recordings` bucket + `submissions`.
class SupabaseLessonProgressSink implements LessonProgressSink {
  SupabaseLessonProgressSink(this._repo, this.lessonId);

  final SupabaseStudentRepository _repo;
  final String lessonId;
  bool? _exists;

  /// The agent fires checkpoints without awaiting — written one at a time.
  Future<void> _queue = Future.value();

  Future<void> _write(LessonProgress p) {
    final run = _queue.then((_) => _writeNow(p));
    _queue = run.catchError((Object _) {});
    return run;
  }

  Future<void> _writeNow(LessonProgress p) async {
    final childId = _repo.session.childId;
    final script = await _repo._script(lessonId);
    final flow = {
      'stage': script == null
          ? (p.completed ? 'done' : 'listen_full')
          : stageOf(script, p),
      'step_index': p.stepIndex,
      'done_refs': [for (final r in p.doneRefs) r.key],
      'project_assigned': p.projectAssigned,
      'reported_project': p.reportedProject,
    };
    _exists ??=
        await supa
            .from('progress')
            .select('lesson_id')
            .eq('child_id', childId)
            .eq('lesson_id', lessonId)
            .maybeSingle() !=
        null;
    if (_exists != true) {
      try {
        await supa.from('progress').insert({
          'child_id': childId,
          'lesson_id': lessonId,
          ...flow,
        });
        _exists = true;
        return;
      } on PostgrestException catch (e) {
        // 23505 = another writer created it first → update below.
        if (e.code != '23505') rethrow;
        _exists = true;
      }
    }
    await supa
        .from('progress')
        .update(flow)
        .eq('child_id', childId)
        .eq('lesson_id', lessonId);
  }

  @override
  Future<void> checkpoint(LessonProgress progress) => _write(progress);

  @override
  Future<void> completed(LessonProgress progress) => _write(progress);

  @override
  Future<void> saveReport(String projectId, RecordedAudio audio) async {
    final s = _repo.session;
    final id = _uuidV4();
    final wav = audio.path == null;
    final path = '${s.parentUid}/${s.childId}/$id.${wav ? 'wav' : 'm4a'}';
    final options = FileOptions(
      contentType: wav ? 'audio/wav' : 'audio/mp4',
      upsert: false,
    );
    final bucket = supa.storage.from('recordings');
    // Upload first: the submission row must point at a stored recording.
    if (audio.bytes != null) {
      await bucket.uploadBinary(path, audio.bytes!, fileOptions: options);
    } else {
      await upload.putLocalFile(bucket, path, audio.path!, options);
    }
    await supa.from('submissions').insert({
      'id': id,
      'child_id': s.childId,
      'lesson_id': lessonId,
      'stage': 'project',
      'project_id': projectId,
      'storage_path': path,
      'duration_ms': audio.duration.inMilliseconds.clamp(1000, 180000),
    });
  }
}

/// A random (v4) UUID for the submission id / file name.
String _uuidV4() {
  final r = _random;
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  String hex(int from, int to) =>
      [for (var i = from; i < to; i++) b[i].toRadixString(16).padLeft(2, '0')]
          .join();
  return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
}

final _random = Random.secure();
