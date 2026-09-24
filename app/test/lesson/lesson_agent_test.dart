import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/lesson/agent/lesson_agent.dart';
import 'package:gharsah/features/lesson/agent/lesson_state.dart';
import 'package:gharsah/features/lesson/ai/ai_teacher.dart';
import 'package:gharsah/features/lesson/data/hadith_repository.dart';
import 'package:gharsah/features/lesson/data/lesson_script.dart';
import 'package:gharsah/features/quran/data/quran_ref.dart';

import 'fakes.dart';

const _line = Duration(milliseconds: 1400); // speak (1s) + echo guard
const _guard = Duration(milliseconds: 300);
const _silence = Duration(seconds: 7);

void _start(Rig r, FakeAsync a, {LessonProgress? from}) {
  r.agent.start(from: from);
  a.flushMicrotasks();
}

/// Intro lines → «جاهز نبدأ نحفظ؟» → the child says yes.
void _intro(Rig r, FakeAsync a) {
  a.elapse(_line * 4);
  expect(r.s.beat, LessonBeat.awaitMic);
  expect(r.s.captionId, 'intro.ready');
  r.agent.micTap();
  a.elapse(_guard);
  expect(r.s.beat, LessonBeat.hearingAnswer);
  expect(r.teacher.listeningMode, ListenMode.answer);
  r.teacher.emit(const AnswerDetected(AnswerIntent.yes));
  a.flushMicrotasks();
}

/// Opens the mic after the prompt and waits for the listening gate.
void _openMic(Rig r, FakeAsync a) {
  r.agent.micTap();
  a.elapse(_guard);
  expect(r.s.beat, LessonBeat.listening);
  expect(r.teacher.listeningMode, ListenMode.repeats);
}

/// Three repeats with the teacher counting in between.
void _threeRepeats(Rig r, FakeAsync a) {
  for (var k = 1; k <= 3; k++) {
    r.teacher.childRepeats();
    a.flushMicrotasks();
    expect(r.s.repeatsDone, k);
    if (k < 3) {
      expect(r.s.beat, LessonBeat.counted);
      a.elapse(_line + _guard);
      expect(r.s.beat, LessonBeat.listening);
    }
  }
  expect(r.s.beat, LessonBeat.praising);
}

void _ayah(Rig r, FakeAsync a, int ayah) {
  expect(r.s.screen, LessonScreen.ayah);
  expect(r.s.beat, LessonBeat.reciting);
  expect(r.player.lastAsset, 'audio/quran/11200$ayah.mp3');
  expect(r.s.ayahRef, QuranRef(112, ayah));
  r.player.finish();
  expect(r.s.beat, LessonBeat.awaitMic);
  _openMic(r, a);
  _threeRepeats(r, a);
  a.elapse(_line);
}

void _answer(Rig r, FakeAsync a, AnswerIntent intent) {
  expect(r.s.beat, LessonBeat.awaitMic);
  r.agent.micTap();
  a.elapse(_guard);
  r.teacher.emit(AnswerDetected(intent));
  a.flushMicrotasks();
}

void main() {
  test('happy path: whole lesson in design order, nothing invented', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      expect(r.s.screen, LessonScreen.intro);
      expect(r.s.surahAyahCount, 4);
      _intro(r, a);
      for (var i = 1; i <= 4; i++) {
        _ayah(r, a, i);
      }
      expect(r.s.beat, LessonBeat.awaitContinue);
      expect(r.s.caption, 'أتممت سورة الإخلاص كاملة… أحسنت يا سارة!');
      r.agent.continueTapped();

      expect(r.s.screen, LessonScreen.surahDone);
      a.elapse(_line * 2);
      _answer(r, a, AnswerIntent.yes);
      expect(r.s.beat, LessonBeat.advancing);
      a.elapse(_line);

      // Hadith: unapproved placeholder → no audio, the 3 repeats still count.
      expect(r.s.screen, LessonScreen.hadith);
      expect(r.s.hadith!.displayText, Hadith.placeholderText);
      a.elapse(_line);
      expect(r.s.beat, LessonBeat.awaitMic);
      expect(r.player.started, hasLength(4));
      _openMic(r, a);
      _threeRepeats(r, a);
      a.elapse(_line * 2);

      expect(r.s.screen, LessonScreen.projectAssign);
      expect(r.s.project!.hints, hasLength(3));
      a.elapse(_line * 2);
      _answer(r, a, AnswerIntent.understood);
      a.elapse(_line);

      expect(r.s.screen, LessonScreen.lessonEnd);
      a.elapse(_line * 2);
      _answer(r, a, AnswerIntent.yes);
      a.elapse(_line);
      expect(r.s.beat, LessonBeat.done);

      expect(r.teacher.spoken, [
        'greet.evening', 'intro.plan', 'intro.surah', 'intro.count', 'intro.ready',
        'ayah.repeat_now', 'count.two_left', 'count.one_left', 'praise.first',
        'ayah.repeat_now', 'count.two_left', 'count.one_left', 'praise.next',
        'ayah.repeat_now', 'count.two_left', 'count.one_left', 'praise.last_left',
        'ayah.repeat_now', 'count.two_left', 'count.one_left', 'praise.all_done',
        'surah.complete',
        'surah.done', 'surah.proud', 'surah.next_hadith', 'surah.go_hadith',
        'hadith.topic', 'ayah.repeat_now', 'count.two_left', 'count.one_left',
        'hadith.praise', 'hadith.to_project',
        'project.intro', 'project.tomorrow', 'project.ask', 'project.bye',
        'end.praise', 'project.tomorrow', 'end.ask', 'end.bye',
      ]);

      final p = r.agent.progress;
      expect(p.doneRefs, {for (var i = 1; i <= 4; i++) QuranRef(112, i)});
      expect(p.surahsCompleted, {112});
      expect(p.hadithDone, {'PLACEHOLDER-birr-alwalidayn'});
      expect(p.projectAssigned, 'birr-3-acts');
      expect(p.completed, isTrue);
      expect(r.sink.completedCalls, hasLength(1));
      expect(r.sink.checkpoints.map((c) => c.stepIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
      expect(r.s.elapsed.inSeconds, greaterThan(30));

      r.agent.dispose();
    });
  });

  test('captions: ayah count only, no Makki/Madani, slots filled', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      final captions = <String>[];
      r.agent.state.addListener(() => captions.add(r.s.caption));
      a.elapse(_line * 4);
      expect(captions, contains('وهي قصيرة — أربع آيات فقط!'));
      expect(captions, contains('نبدأ بسورة الإخلاص.'));
      expect(captions.where((c) => c.contains('مك') || c.contains('مدن')), isEmpty);
      r.agent.dispose();
    });
  });

  test('silence: nudges, then one replay, then waits quietly', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      _intro(r, a);
      r.player.finish();
      _openMic(r, a);

      a.elapse(_silence);
      expect(r.s.beat, LessonBeat.nudging);
      expect(r.teacher.spoken.last, 'nudge.start');
      a.elapse(_line + _guard);
      a.elapse(_silence);
      expect(r.teacher.spoken.last, 'nudge.start');
      a.elapse(_line + _guard);
      expect(r.player.started, hasLength(1));

      a.elapse(_silence); // 3rd silence → replay once
      expect(r.s.beat, LessonBeat.reciting);
      expect(r.player.started, hasLength(2));
      r.player.finish();
      _openMic(r, a);

      // Two repeats, then silence before the last one → «باقي مرة، هيا…»
      r.teacher.childRepeats();
      a.elapse(_line + _guard);
      r.teacher.childRepeats();
      a.elapse(_line + _guard);
      a.elapse(_silence);
      expect(r.teacher.spoken.last, 'nudge.one_left');
      a.elapse(_line + _guard);
      a.elapse(_silence);
      a.elapse(_line + _guard);
      final spokenBefore = r.teacher.spoken.length;
      a.elapse(_silence * 5); // replayed already → just wait
      expect(r.s.beat, LessonBeat.listening);
      expect(r.player.started, hasLength(2));
      expect(r.teacher.spoken.length, spokenBefore);
      expect(r.s.repeatsDone, 2);

      r.teacher.childRepeats();
      expect(r.s.beat, LessonBeat.praising);
      r.agent.dispose();
    });
  });

  test('reciter and teacher audio are never counted as the child', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      _intro(r, a);
      expect(r.s.beat, LessonBeat.reciting);
      expect(r.teacher.isListening, isFalse);
      r.teacher.childRepeats(); // reciter's voice leaking into the mic
      expect(r.s.repeatsDone, 0);
      expect(r.teacher.stopSpeakingCalls, greaterThan(0)); // teacher silenced

      r.player.finish();
      _openMic(r, a);
      r.teacher.childRepeats();
      expect(r.s.beat, LessonBeat.counted);
      expect(r.teacher.isListening, isFalse); // deaf while counting aloud
      r.teacher.childRepeats();
      r.teacher.childRepeats();
      expect(r.s.repeatsDone, 1);
      a.elapse(const Duration(milliseconds: 1100)); // line over, echo guard
      r.teacher.childRepeats();
      expect(r.s.repeatsDone, 1);
      a.elapse(_guard * 2);
      r.teacher.childRepeats();
      expect(r.s.repeatsDone, 2);
      r.agent.dispose();
    });
  });

  test('muting the mic pauses counting, not the lesson; repeats kept', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      _intro(r, a);
      r.player.finish();
      _openMic(r, a);
      r.teacher.childRepeats();
      a.elapse(_line + _guard);

      r.agent.micTap(); // mute
      expect(r.s.beat, LessonBeat.awaitMic);
      expect(r.teacher.isListening, isFalse);
      expect(r.teacher.events.whereType<MicMuted>(), hasLength(1));
      r.teacher.childRepeats();
      final spoken = r.teacher.spoken.length;
      a.elapse(_silence * 3); // no nudges while muted
      expect(r.teacher.spoken.length, spoken);
      expect(r.s.repeatsDone, 1);
      expect(r.s.paused, isFalse);

      _openMic(r, a);
      r.teacher.childRepeats();
      expect(r.s.repeatsDone, 2);
      r.agent.dispose();
    });
  });

  test('autoplay blocked → fallback play control, then continues', () {
    fakeAsync((a) {
      final r = Rig();
      r.player.blockAutoplay = true;
      _start(r, a);
      _intro(r, a);
      expect(r.s.beat, LessonBeat.reciting);
      expect(r.s.playbackBlocked, isTrue);
      expect(r.teacher.events.whereType<PlaybackBlockedEvent>(), hasLength(1));
      a.elapse(_silence * 2);
      expect(r.s.beat, LessonBeat.reciting); // waits for the tap

      r.player.blockAutoplay = false;
      r.agent.play();
      a.flushMicrotasks();
      expect(r.s.playbackBlocked, isFalse);
      expect(r.player.playing, isTrue);
      r.player.finish();
      expect(r.s.beat, LessonBeat.awaitMic);
      r.agent.dispose();
    });
  });

  test('app backgrounded pauses everything and resumes the same moment', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      a.elapse(const Duration(milliseconds: 500)); // mid-greeting
      r.agent.setForeground(false);
      expect(r.s.paused, isTrue);
      expect(r.teacher.isSpeaking, isFalse);
      final elapsed = r.s.elapsed;
      a.elapse(const Duration(minutes: 1));
      expect(r.s.elapsed, elapsed); // call timer stopped
      expect(r.s.captionId, 'greet.evening');
      r.agent.setForeground(true);
      expect(r.teacher.spoken, ['greet.evening', 'greet.evening']); // re-said
      a.elapse(_line * 3);
      expect(r.s.captionId, 'intro.count');

      // During recitation.
      a.elapse(_line);
      r.agent.micTap();
      a.elapse(_guard);
      r.teacher.emit(const AnswerDetected(AnswerIntent.yes));
      a.flushMicrotasks();
      expect(r.s.beat, LessonBeat.reciting);
      r.agent.setForeground(false);
      expect(r.player.paused, isTrue);
      r.player.finish(); // can't finish while paused
      expect(r.s.beat, LessonBeat.reciting);
      r.agent.setForeground(true);
      expect(r.player.paused, isFalse);
      r.player.finish();
      expect(r.s.beat, LessonBeat.awaitMic);

      // While listening: no nudges in the background; listening resumes.
      _openMic(r, a);
      r.agent.setForeground(false);
      expect(r.teacher.isListening, isFalse);
      final spoken = r.teacher.spoken.length;
      a.elapse(_silence * 3);
      expect(r.teacher.spoken.length, spoken);
      r.agent.setForeground(true);
      a.elapse(_guard);
      expect(r.teacher.isListening, isTrue);
      a.elapse(_silence);
      expect(r.s.beat, LessonBeat.nudging);

      // User pause + background: resumes only when both are cleared.
      r.agent.pause();
      r.agent.setForeground(false);
      r.agent.setForeground(true);
      expect(r.s.paused, isTrue);
      r.agent.resume();
      expect(r.s.paused, isFalse);
      r.agent.dispose();
    });
  });

  test('replay keeps the count; next/previous move between ayat', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      _intro(r, a);
      r.player.finish();
      _openMic(r, a);
      r.teacher.childRepeats();
      a.elapse(_line + _guard);

      r.agent.replayAyah();
      a.flushMicrotasks();
      expect(r.s.beat, LessonBeat.reciting);
      expect(r.player.started, hasLength(2));
      expect(r.teacher.isListening, isFalse);
      r.player.finish();
      _openMic(r, a);
      r.teacher.childRepeats();
      expect(r.s.repeatsDone, 2);

      r.agent.nextAyah();
      a.flushMicrotasks();
      expect(r.s.ayahRef, const QuranRef(112, 2));
      expect(r.s.repeatsDone, 0);
      expect(r.player.lastAsset, 'audio/quran/112002.mp3');
      r.agent.previousAyah();
      a.flushMicrotasks();
      expect(r.player.lastAsset, 'audio/quran/112001.mp3');
      r.agent.previousAyah(); // nothing before ayah 1 → stays
      a.flushMicrotasks();
      expect(r.s.ayahRef, const QuranRef(112, 1));

      r.agent.stop();
      expect(r.s.beat, LessonBeat.awaitMic);
      expect(r.player.playing, isFalse);

      r.agent.setVolume(0.4);
      a.flushMicrotasks();
      expect(r.player.volume, 0.4);
      expect(r.agent.progress.doneRefs, isEmpty); // skipping never counts
      r.agent.dispose();
    });
  });

  test('mic permission denied → state flag, retry works', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      _intro(r, a);
      r.player.finish();
      r.teacher.denyMic = true;
      r.agent.micTap();
      a.elapse(_guard);
      expect(r.s.micDenied, isTrue);
      expect(r.s.beat, LessonBeat.awaitMic);
      r.teacher.denyMic = false;
      _openMic(r, a);
      expect(r.s.micDenied, isFalse);
      r.agent.dispose();
    });
  });

  test('end call saves a checkpoint; start(from:) resumes there', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      _intro(r, a);
      _ayah(r, a, 1);
      r.player.finish();
      r.agent.endCall();
      a.flushMicrotasks();
      expect(r.s.screen, LessonScreen.ended);
      expect(r.s.endedByUser, isTrue);
      final cp = r.sink.checkpoints.last;
      expect(cp.stepIndex, 2);
      expect(cp.doneRefs, {const QuranRef(112, 1)});
      expect(r.player.playing, isFalse);

      final r2 = Rig();
      _start(r2, a, from: cp);
      expect(r2.s.screen, LessonScreen.ayah);
      expect(r2.s.ayahRef, const QuranRef(112, 2));
      expect(r2.agent.progress.doneRefs, {const QuranRef(112, 1)});
      r.agent.dispose();
      r2.agent.dispose();
    });
  });

  test('tap fallback answers «نعم»; tapping the teacher skips a line', () {
    fakeAsync((a) {
      final r = Rig();
      _start(r, a);
      r.agent.tapTeacher(); // skip greeting
      a.flushMicrotasks();
      expect(r.s.captionId, 'intro.plan');
      a.elapse(_line * 3);
      r.agent.micTap();
      a.elapse(_guard);
      r.agent.micTap(); // frame 18: live mic = «قلت نعم»
      a.flushMicrotasks();
      expect(r.s.screen, LessonScreen.ayah);
      expect(r.teacher.events.whereType<TapFallback>(), hasLength(1));
      r.agent.dispose();
    });
  });

  test('day 2: report → re-record → auto-save → hadith → end', () {
    fakeAsync((a) {
      final r = Rig(lessonId: 'm01-w03-day2', now: DateTime(2026, 9, 25, 9));
      _start(r, a);
      expect(r.s.screen, LessonScreen.projectReport);
      a.elapse(_line);
      expect(r.s.beat, LessonBeat.awaitMic);
      expect(r.s.caption, r.s.project!.reportAsk);

      r.agent.micTap();
      a.flushMicrotasks();
      expect(r.s.beat, LessonBeat.recording);
      a.elapse(const Duration(seconds: 5));
      expect(r.s.recordingElapsed, const Duration(seconds: 5));
      r.agent.micTap();
      a.flushMicrotasks();
      expect(r.s.beat, LessonBeat.recorded);
      expect(r.s.recordedDuration, const Duration(seconds: 11));

      r.agent.reRecord();
      a.flushMicrotasks();
      expect(r.recorder.discarded, hasLength(1));
      expect(r.s.beat, LessonBeat.recording);
      r.agent.micTap();
      a.flushMicrotasks();
      a.elapse(_line + const Duration(milliseconds: 3200));
      expect(r.s.beat, LessonBeat.advancing);
      expect(r.teacher.spoken.last, 'report.to_hadith');
      expect(r.sink.reports.single.$1, 'birr-3-acts');
      expect(r.sink.reports.single.$2.path, '/tmp/take2.m4a');
      a.elapse(_line);

      expect(r.s.screen, LessonScreen.hadith);
      a.elapse(_line);
      _openMic(r, a);
      _threeRepeats(r, a);
      a.elapse(_line);
      expect(r.s.screen, LessonScreen.lessonEnd);
      a.elapse(_line * 2);
      expect(r.s.beat, LessonBeat.done);
      expect(r.teacher.spoken, [
        'report.greet.morning', 'report.ask', 'report.thanks', 'report.thanks',
        'report.to_hadith',
        'hadith.topic', 'ayah.repeat_now', 'count.two_left', 'count.one_left',
        'hadith.praise', 'end.praise', 'end.bye',
      ]);
      expect(r.agent.progress.reportedProject, 'birr-3-acts');
      r.agent.dispose();
    });
  });

  test('report save failure keeps the recording and retries', () {
    fakeAsync((a) {
      final r = Rig(lessonId: 'm01-w03-day2');
      r.sink.failSave = true;
      _start(r, a);
      a.elapse(_line);
      r.agent.micTap();
      a.flushMicrotasks();
      r.agent.micTap();
      a.flushMicrotasks();
      a.elapse(_line + const Duration(milliseconds: 3200));
      expect(r.s.beat, LessonBeat.recorded);
      expect(r.s.saveFailed, isTrue);
      expect(r.recorder.discarded, isEmpty);

      r.sink.failSave = false;
      r.agent.continueTapped();
      a.elapse(_line * 2);
      expect(r.sink.reports, hasLength(1));
      expect(r.s.screen, LessonScreen.hadith);
      r.agent.dispose();
    });
  });

  test('approved hadith plays automatically, with no code change', () {
    fakeAsync((a) {
      final hadith = HadithRepository.fromJson({
        'hadith': [
          {
            'id': 'PLACEHOLDER-birr-alwalidayn',
            'title': 'حديث برّ الوالدين',
            'approved': true,
            'text': 'TEST-TEXT',
            'takhrij': 'TEST-TAKHRIJ',
            'grading': 'TEST-GRADE',
            'source': 'TEST-SOURCE',
            'reviewedBy': 'TEST-REVIEWER',
            'audio': 'audio/hadith/test.mp3',
          },
        ],
      });
      final r = Rig(lessonId: 'm01-w03-day2', content: realContent(hadith: hadith));
      _start(r, a);
      r.agent.nextAyah(); // no ayat in day 2 → no-op
      a.elapse(_line);
      r.agent.micTap();
      a.flushMicrotasks();
      r.agent.micTap();
      a.flushMicrotasks();
      a.elapse(_line + const Duration(milliseconds: 3200));
      a.elapse(_line);
      a.elapse(_line); // hadith.topic
      expect(r.s.screen, LessonScreen.hadith);
      expect(r.s.beat, LessonBeat.reciting);
      expect(r.s.captionId, 'ui.listen_hadith');
      expect(r.player.lastAsset, 'audio/hadith/test.mp3');
      expect(r.s.hadith!.displayText, 'TEST-TEXT');
      r.agent.dispose();
    });
  });

  test('audio not on the device and offline → failed before starting', () {
    fakeAsync((a) {
      final script = LessonScript.fromJson({
        'contractVersion': '0.1',
        'lessonId': 'offline-test',
        'title': 't',
        'steps': [
          {'type': 'ayah_loop', 'ref': {'surah': 2, 'ayah': 255}, 'repeats': 3},
        ],
      });
      final r = Rig();
      final agent = LessonAgent(
        script: script,
        content: realContent(), // fetch fails: offline
        teacher: r.teacher,
        player: r.player,
        recorder: r.recorder,
        sink: r.sink,
        childFirstName: 'سارة',
      );
      agent.start();
      a.flushMicrotasks();
      expect(agent.state.value.screen, LessonScreen.failed);
      expect(agent.state.value.contentUnavailable, isTrue);
      expect(r.player.started, isEmpty);
      agent.dispose();
    });
  });

  test('invalid ayah refs are rejected', () {
    expect(
      () => LessonScript.fromJson({
        'contractVersion': '0.1',
        'lessonId': 'x',
        'title': 't',
        'steps': [
          {'type': 'ayah_loop', 'ref': {'surah': 112, 'ayah': 5}},
        ],
      }).validate(realContent().meta),
      throwsFormatException,
    );
    expect(
      () => LessonScript.fromJson({'contractVersion': '9', 'lessonId': 'x', 'title': 't', 'steps': []}),
      throwsFormatException,
    );
  });
}
