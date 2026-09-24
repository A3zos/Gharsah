import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/lesson/agent/lesson_state.dart';
import 'package:gharsah/features/student/data/child_session.dart';
import 'package:gharsah/features/student/data/debug_student_repository.dart';
import 'package:gharsah/features/student/data/student_repository.dart';

void main() {
  test('debug mock child → in-memory repository (tests run in debug mode)', () async {
    final s = ChildSession.debugMockChild();
    expect(s.debugMock, isTrue);
    expect(s.name, 'عبدالله');
    final repo = StudentRepository.forSession(s);
    expect(repo, isA<DebugStudentRepository>());

    final child = await repo.watchChild().first;
    expect(child!.name, 'عبدالله');
    expect(child.stats!['streak'], 5);
    expect((await repo.watchLeaderboard().first)!.rows, hasLength(5));

    // Fresh app run: nothing done → today's lesson is the real seed lesson.
    final first = await repo.watchProgress().first;
    expect(pickTodayLesson(first, DateTime.now()), isA<LessonAvailable>());

    // Checkpoints are kept in memory → «أكمل الحصة» resumes.
    final next = repo.watchProgress().skip(1).first;
    await repo.sinkFor('m01-w03-ikhlas').checkpoint(
      const LessonProgress(lessonId: 'm01-w03-ikhlas', stepIndex: 3),
    );
    final t = pickTodayLesson(await next, DateTime.now()) as LessonAvailable;
    expect(t.resume!.stepIndex, 3);
  });

  test('a real session never uses the debug repository', () {
    const s = ChildSession(
      deviceUid: 'd', parentUid: 'p', childId: 'c', name: 'x', avatar: 'b1', gender: 'boy',
    );
    expect(s.debugMock, isFalse);
    expect(s.toJson().containsKey('debugMock'), isFalse);
  });
}
