import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../../children/data/child_profile.dart';
import '../../lesson/agent/lesson_agent.dart';
import '../../lesson/agent/lesson_state.dart';
import '../../lesson/recording/project_recorder.dart';
import '../../quran/data/quran_ref.dart';
import 'child_session.dart';
import 'leaderboard.dart';
import 'upload_stub.dart' if (dart.library.io) 'upload_io.dart' as upload;

/// The lesson sequence (interim until the yearly plan is delivered): the
/// seed lesson, then the product-owner-approved interim day-2 lesson.
const lessonSequence = ['m01-w03-ikhlas', 'm01-w03-day2'];

/// A lesson checkpoint as stored in `progress/{lessonId}`.
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

LessonProgress progressFromMap(String lessonId, Map<String, dynamic> d) {
  Set<QuranRef> refs() => {
    for (final r in (d['doneRefs'] as List? ?? const []))
      if (r is String && r.contains(':'))
        QuranRef(int.parse(r.split(':')[0]), int.parse(r.split(':')[1])),
  };
  return LessonProgress(
    lessonId: lessonId,
    stepIndex: (d['stepIndex'] as num?)?.toInt() ?? 0,
    doneRefs: refs(),
    surahsCompleted: {
      for (final s in (d['surahsCompleted'] as List? ?? const []))
        if (s is num) s.toInt(),
    },
    hadithDone: {
      for (final h in (d['hadithDone'] as List? ?? const []))
        if (h is String) h,
    },
    projectAssigned: d['projectAssigned'] as String?,
    reportedProject: d['reportedProject'] as String?,
    completed: d['completed'] == true,
  );
}

/// The child device's view of its own data (rules: get own child doc, own
/// progress docs; create submissions; upload own recordings).
class StudentRepository {
  StudentRepository(
    this.session, {
    FirebaseFirestore? db,
    FirebaseStorage? storage,
  }) : _db = db ?? FirebaseFirestore.instance,
       _storage = storage ?? FirebaseStorage.instance;

  final ChildSession session;
  final FirebaseFirestore _db;
  final FirebaseStorage _storage;

  DocumentReference<Map<String, dynamic>> get _child =>
      _db.doc('parents/${session.parentUid}/children/${session.childId}');

  Stream<ChildProfile?> watchChild() => _child.snapshots().map(
    (d) => d.exists ? ChildProfile.fromDoc(d.id, d.data()!) : null,
  );

  /// Checkpoints of the lessons in [lessonSequence] (device can only get by id).
  Stream<Map<String, StoredProgress>> watchProgress() {
    final controller = StreamController<Map<String, StoredProgress>>();
    final latest = <String, StoredProgress>{};
    final seen = <String>{};
    final subs = [
      for (final id in lessonSequence)
        _child.collection('progress').doc(id).snapshots().listen((d) {
          seen.add(id);
          if (d.exists) {
            latest[id] = StoredProgress(
              progressFromMap(id, d.data()!),
              (d.data()!['updatedAt'] as Timestamp?)?.toDate(),
            );
          } else {
            latest.remove(id);
          }
          if (seen.length == lessonSequence.length) {
            controller.add(Map.of(latest));
          }
        }, onError: controller.addError),
    ];
    controller.onCancel = () async {
      for (final s in subs) {
        await s.cancel();
      }
    };
    return controller.stream;
  }

  /// The anonymous weekly board (rank + points rows only).
  Stream<LeaderBoard?> watchLeaderboard() => _db
      .doc('leaderboard/current')
      .snapshots()
      .map((d) => d.exists ? LeaderBoard.fromMap(d.data()!) : null)
      .handleError((Object _) {});

  LessonProgressSink sinkFor(String lessonId) =>
      FirestoreLessonProgressSink(this, lessonId);
}

/// Writes lesson checkpoints to `progress/{lessonId}` and the project report
/// to Storage + `submissions/{id}`. Firestore queues writes while offline.
class FirestoreLessonProgressSink implements LessonProgressSink {
  FirestoreLessonProgressSink(this._repo, this.lessonId);

  final StudentRepository _repo;
  final String lessonId;
  Object? _startedAt;

  DocumentReference<Map<String, dynamic>> get _doc =>
      _repo._child.collection('progress').doc(lessonId);

  Future<void> _write(LessonProgress p) async {
    if (_startedAt == null) {
      final existing = await _doc.get();
      _startedAt = existing.data()?['startedAt'];
    }
    final creating = _startedAt == null;
    await _doc.set({
      'lessonId': lessonId,
      'stepIndex': p.stepIndex,
      'doneRefs': [for (final r in p.doneRefs) r.key],
      'surahsCompleted': p.surahsCompleted.toList(),
      'hadithDone': p.hadithDone.toList(),
      'projectAssigned': p.projectAssigned,
      'reportedProject': p.reportedProject,
      'completed': p.completed,
      'startedAt': creating ? FieldValue.serverTimestamp() : _startedAt,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    if (creating) _startedAt = (await _doc.get()).data()?['startedAt'];
  }

  @override
  Future<void> checkpoint(LessonProgress progress) => _write(progress);

  @override
  Future<void> completed(LessonProgress progress) => _write(progress);

  @override
  Future<void> saveReport(String projectId, RecordedAudio audio) async {
    final s = _repo.session;
    final ref = _repo._child.collection('submissions').doc();
    final wav = audio.path == null;
    final path =
        'recordings/${s.parentUid}/${s.childId}/${ref.id}.${wav ? 'wav' : 'm4a'}';
    final meta = SettableMetadata(contentType: wav ? 'audio/wav' : 'audio/mp4');
    final storage = _repo._storage.ref(path);
    // Upload first: the submission record must point at a stored recording.
    if (audio.bytes != null) {
      await storage.putData(audio.bytes!, meta);
    } else {
      await upload.putLocalFile(storage, audio.path!, meta);
    }
    await ref.set({
      'projectId': projectId,
      'lessonId': lessonId,
      'storagePath': path,
      'durationMs': audio.duration.inMilliseconds.clamp(1000, 180000),
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
