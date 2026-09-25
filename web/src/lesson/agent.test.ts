// One-to-one port of app/test/lesson/lesson_agent_test.dart — same test names,
// same steps, same expectations. Dart's fakeAsync `elapse` / `flushMicrotasks`
// map to vitest fake timers (`advanceTimersByTimeAsync`).
import type { AnswerIntent } from './aiTeacher';
import { HadithRepository, HADITH_PLACEHOLDER_TEXT } from './hadith';
import { quranRef, refKey } from './quran';
import { FormatError } from './quran';
import { parseLessonScript, validateLessonScript } from './script';
import type { LessonProgress } from './state';
import { realContent, Rig } from './testing/fakes';

const LINE = 1400; // speak (1s) + echo guard… as in the Dart test
const GUARD = 300;
const SILENCE = 7000;

const elapse = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function start(r: Rig, from?: LessonProgress) {
  void r.agent.start(from);
  await flush();
}

/** Intro lines → «جاهز نبدأ نحفظ؟» → the child says yes. */
async function intro(r: Rig) {
  await elapse(LINE * 4);
  expect(r.s.beat).toBe('awaitMic');
  expect(r.s.captionId).toBe('intro.ready');
  r.agent.micTap();
  await elapse(GUARD);
  expect(r.s.beat).toBe('hearingAnswer');
  expect(r.teacher.listeningMode).toBe('answer');
  r.teacher.emit({ type: 'answerDetected', intent: 'yes' });
  await flush();
}

/** Opens the mic after the prompt and waits for the listening gate. */
async function openMic(r: Rig) {
  r.agent.micTap();
  await elapse(GUARD);
  expect(r.s.beat).toBe('listening');
  expect(r.teacher.listeningMode).toBe('repeats');
}

/** Three repeats with the teacher counting in between. */
async function threeRepeats(r: Rig) {
  for (let k = 1; k <= 3; k++) {
    r.teacher.childRepeats();
    await flush();
    expect(r.s.repeatsDone).toBe(k);
    if (k < 3) {
      expect(r.s.beat).toBe('counted');
      await elapse(LINE + GUARD);
      expect(r.s.beat).toBe('listening');
    }
  }
  expect(r.s.beat).toBe('praising');
}

async function ayah(r: Rig, n: number) {
  expect(r.s.screen).toBe('ayah');
  expect(r.s.beat).toBe('reciting');
  expect(r.player.lastAsset).toBe(`audio/quran/11200${n}.mp3`);
  expect(r.s.ayahRef).toEqual(quranRef(112, n));
  r.player.finish();
  expect(r.s.beat).toBe('awaitMic');
  await openMic(r);
  await threeRepeats(r);
  await elapse(LINE);
}

async function answer(r: Rig, intent: AnswerIntent) {
  expect(r.s.beat).toBe('awaitMic');
  r.agent.micTap();
  await elapse(GUARD);
  r.teacher.emit({ type: 'answerDetected', intent });
  await flush();
}

const events = (r: Rig, type: string) => r.teacher.events.filter((e) => e.type === type);

test('happy path: whole lesson in design order, nothing invented', async () => {
  const r = new Rig();
  await start(r);
  expect(r.s.screen).toBe('intro');
  expect(r.s.surahAyahCount).toBe(4);
  await intro(r);
  for (let i = 1; i <= 4; i++) await ayah(r, i);
  expect(r.s.beat).toBe('awaitContinue');
  expect(r.s.caption).toBe('أتممت سورة الإخلاص كاملة… أحسنت يا سارة!');
  r.agent.continueTapped();

  expect(r.s.screen).toBe('surahDone');
  await elapse(LINE * 2);
  await answer(r, 'yes');
  expect(r.s.beat).toBe('advancing');
  await elapse(LINE);

  // Hadith: unapproved placeholder → no audio, the 3 repeats still count.
  expect(r.s.screen).toBe('hadith');
  expect(r.s.hadith!.displayText).toBe(HADITH_PLACEHOLDER_TEXT);
  await elapse(LINE);
  expect(r.s.beat).toBe('awaitMic');
  expect(r.player.started).toHaveLength(4);
  await openMic(r);
  await threeRepeats(r);
  await elapse(LINE * 2);

  expect(r.s.screen).toBe('projectAssign');
  expect(r.s.project!.hints).toHaveLength(3);
  await elapse(LINE * 2);
  await answer(r, 'understood');
  await elapse(LINE);

  expect(r.s.screen).toBe('lessonEnd');
  await elapse(LINE * 2);
  await answer(r, 'yes');
  await elapse(LINE);
  expect(r.s.beat).toBe('done');

  expect(r.teacher.spoken).toEqual([
    'greet.evening',
    'intro.plan',
    'intro.surah',
    'intro.count',
    'intro.ready',
    'ayah.repeat_now',
    'count.two_left',
    'count.one_left',
    'praise.first',
    'ayah.repeat_now',
    'count.two_left',
    'count.one_left',
    'praise.next',
    'ayah.repeat_now',
    'count.two_left',
    'count.one_left',
    'praise.last_left',
    'ayah.repeat_now',
    'count.two_left',
    'count.one_left',
    'praise.all_done',
    'surah.complete',
    'surah.done',
    'surah.proud',
    'surah.next_hadith',
    'surah.go_hadith',
    'hadith.topic',
    'ayah.repeat_now',
    'count.two_left',
    'count.one_left',
    'hadith.praise',
    'hadith.to_project',
    'project.intro',
    'project.tomorrow',
    'project.ask',
    'project.bye',
    'end.praise',
    'project.tomorrow',
    'end.ask',
    'end.bye',
  ]);

  const p = r.agent.progress;
  expect(p.doneRefs).toEqual(new Set([1, 2, 3, 4].map((i) => refKey(quranRef(112, i)))));
  expect(p.surahsCompleted).toEqual(new Set([112]));
  expect(p.hadithDone).toEqual(new Set(['PLACEHOLDER-birr-alwalidayn']));
  expect(p.projectAssigned).toBe('birr-3-acts');
  expect(p.completed).toBe(true);
  expect(r.sink.completedCalls).toHaveLength(1);
  expect(r.sink.checkpoints.map((c) => c.stepIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(r.s.elapsedMs / 1000).toBeGreaterThan(30);

  await r.agent.dispose();
});

test('captions: ayah count only, no Makki/Madani, slots filled', async () => {
  const r = new Rig();
  await start(r);
  const captions: string[] = [];
  r.agent.state.subscribe((s) => captions.push(s.caption));
  await elapse(LINE * 4);
  expect(captions).toContain('وهي قصيرة — أربع آيات فقط!');
  expect(captions).toContain('نبدأ بسورة الإخلاص.');
  expect(captions.filter((c) => c.includes('مك') || c.includes('مدن'))).toEqual([]);
  await r.agent.dispose();
});

test('silence: nudges, then one replay, then waits quietly', async () => {
  const r = new Rig();
  await start(r);
  await intro(r);
  r.player.finish();
  await openMic(r);

  await elapse(SILENCE);
  expect(r.s.beat).toBe('nudging');
  expect(r.teacher.spoken.at(-1)).toBe('nudge.start');
  await elapse(LINE + GUARD);
  await elapse(SILENCE);
  expect(r.teacher.spoken.at(-1)).toBe('nudge.start');
  await elapse(LINE + GUARD);
  expect(r.player.started).toHaveLength(1);

  await elapse(SILENCE); // 3rd silence → replay once
  expect(r.s.beat).toBe('reciting');
  expect(r.player.started).toHaveLength(2);
  r.player.finish();
  await openMic(r);

  // Two repeats, then silence before the last one → «باقي مرة، هيا…»
  r.teacher.childRepeats();
  await elapse(LINE + GUARD);
  r.teacher.childRepeats();
  await elapse(LINE + GUARD);
  await elapse(SILENCE);
  expect(r.teacher.spoken.at(-1)).toBe('nudge.one_left');
  await elapse(LINE + GUARD);
  await elapse(SILENCE);
  await elapse(LINE + GUARD);
  const spokenBefore = r.teacher.spoken.length;
  await elapse(SILENCE * 5); // replayed already → just wait
  expect(r.s.beat).toBe('listening');
  expect(r.player.started).toHaveLength(2);
  expect(r.teacher.spoken).toHaveLength(spokenBefore);
  expect(r.s.repeatsDone).toBe(2);

  r.teacher.childRepeats();
  expect(r.s.beat).toBe('praising');
  await r.agent.dispose();
});

test('reciter and teacher audio are never counted as the child', async () => {
  const r = new Rig();
  await start(r);
  await intro(r);
  expect(r.s.beat).toBe('reciting');
  expect(r.teacher.isListening).toBe(false);
  r.teacher.childRepeats(); // reciter's voice leaking into the mic
  expect(r.s.repeatsDone).toBe(0);
  expect(r.teacher.stopSpeakingCalls).toBeGreaterThan(0); // teacher silenced

  r.player.finish();
  await openMic(r);
  r.teacher.childRepeats();
  expect(r.s.beat).toBe('counted');
  expect(r.teacher.isListening).toBe(false); // deaf while counting aloud
  r.teacher.childRepeats();
  r.teacher.childRepeats();
  expect(r.s.repeatsDone).toBe(1);
  await elapse(1100); // line over, echo guard
  r.teacher.childRepeats();
  expect(r.s.repeatsDone).toBe(1);
  await elapse(GUARD * 2);
  r.teacher.childRepeats();
  expect(r.s.repeatsDone).toBe(2);
  await r.agent.dispose();
});

test('muting the mic pauses counting, not the lesson; repeats kept', async () => {
  const r = new Rig();
  await start(r);
  await intro(r);
  r.player.finish();
  await openMic(r);
  r.teacher.childRepeats();
  await elapse(LINE + GUARD);

  r.agent.micTap(); // mute
  expect(r.s.beat).toBe('awaitMic');
  expect(r.teacher.isListening).toBe(false);
  expect(events(r, 'micMuted')).toHaveLength(1);
  r.teacher.childRepeats();
  const spoken = r.teacher.spoken.length;
  await elapse(SILENCE * 3); // no nudges while muted
  expect(r.teacher.spoken).toHaveLength(spoken);
  expect(r.s.repeatsDone).toBe(1);
  expect(r.s.paused).toBe(false);

  await openMic(r);
  r.teacher.childRepeats();
  expect(r.s.repeatsDone).toBe(2);
  await r.agent.dispose();
});

test('autoplay blocked → fallback play control, then continues', async () => {
  const r = new Rig();
  r.player.blockAutoplay = true;
  await start(r);
  await intro(r);
  expect(r.s.beat).toBe('reciting');
  expect(r.s.playbackBlocked).toBe(true);
  expect(events(r, 'playbackBlocked')).toHaveLength(1);
  await elapse(SILENCE * 2);
  expect(r.s.beat).toBe('reciting'); // waits for the tap

  r.player.blockAutoplay = false;
  r.agent.play();
  await flush();
  expect(r.s.playbackBlocked).toBe(false);
  expect(r.player.playing).toBe(true);
  r.player.finish();
  expect(r.s.beat).toBe('awaitMic');
  await r.agent.dispose();
});

test('app backgrounded pauses everything and resumes the same moment', async () => {
  const r = new Rig();
  await start(r);
  await elapse(500); // mid-greeting
  r.agent.setForeground(false);
  expect(r.s.paused).toBe(true);
  expect(r.teacher.isSpeaking).toBe(false);
  const elapsed = r.s.elapsedMs;
  await elapse(60_000);
  expect(r.s.elapsedMs).toBe(elapsed); // call timer stopped
  expect(r.s.captionId).toBe('greet.evening');
  r.agent.setForeground(true);
  expect(r.teacher.spoken).toEqual(['greet.evening', 'greet.evening']); // re-said
  await elapse(LINE * 3);
  expect(r.s.captionId).toBe('intro.count');

  // During recitation.
  await elapse(LINE);
  r.agent.micTap();
  await elapse(GUARD);
  r.teacher.emit({ type: 'answerDetected', intent: 'yes' });
  await flush();
  expect(r.s.beat).toBe('reciting');
  r.agent.setForeground(false);
  expect(r.player.paused).toBe(true);
  r.player.finish(); // can't finish while paused
  expect(r.s.beat).toBe('reciting');
  r.agent.setForeground(true);
  expect(r.player.paused).toBe(false);
  r.player.finish();
  expect(r.s.beat).toBe('awaitMic');

  // While listening: no nudges in the background; listening resumes.
  await openMic(r);
  r.agent.setForeground(false);
  expect(r.teacher.isListening).toBe(false);
  const spoken = r.teacher.spoken.length;
  await elapse(SILENCE * 3);
  expect(r.teacher.spoken).toHaveLength(spoken);
  r.agent.setForeground(true);
  await elapse(GUARD);
  expect(r.teacher.isListening).toBe(true);
  await elapse(SILENCE);
  expect(r.s.beat).toBe('nudging');

  // User pause + background: resumes only when both are cleared.
  r.agent.pause();
  r.agent.setForeground(false);
  r.agent.setForeground(true);
  expect(r.s.paused).toBe(true);
  r.agent.resume();
  expect(r.s.paused).toBe(false);
  await r.agent.dispose();
});

test('replay keeps the count; next/previous move between ayat', async () => {
  const r = new Rig();
  await start(r);
  await intro(r);
  r.player.finish();
  await openMic(r);
  r.teacher.childRepeats();
  await elapse(LINE + GUARD);

  r.agent.replayAyah();
  await flush();
  expect(r.s.beat).toBe('reciting');
  expect(r.player.started).toHaveLength(2);
  expect(r.teacher.isListening).toBe(false);
  r.player.finish();
  await openMic(r);
  r.teacher.childRepeats();
  expect(r.s.repeatsDone).toBe(2);

  r.agent.nextAyah();
  await flush();
  expect(r.s.ayahRef).toEqual(quranRef(112, 2));
  expect(r.s.repeatsDone).toBe(0);
  expect(r.player.lastAsset).toBe('audio/quran/112002.mp3');
  r.agent.previousAyah();
  await flush();
  expect(r.player.lastAsset).toBe('audio/quran/112001.mp3');
  r.agent.previousAyah(); // nothing before ayah 1 → stays
  await flush();
  expect(r.s.ayahRef).toEqual(quranRef(112, 1));

  r.agent.stop();
  expect(r.s.beat).toBe('awaitMic');
  expect(r.player.playing).toBe(false);

  void r.agent.setVolume(0.4);
  await flush();
  expect(r.player.volume).toBe(0.4);
  expect(r.agent.progress.doneRefs.size).toBe(0); // skipping never counts
  await r.agent.dispose();
});

test('mic permission denied → state flag, retry works', async () => {
  const r = new Rig();
  await start(r);
  await intro(r);
  r.player.finish();
  r.teacher.denyMic = true;
  r.agent.micTap();
  await elapse(GUARD);
  expect(r.s.micDenied).toBe(true);
  expect(r.s.beat).toBe('awaitMic');
  r.teacher.denyMic = false;
  await openMic(r);
  expect(r.s.micDenied).toBe(false);
  await r.agent.dispose();
});

test('end call saves a checkpoint; start(from:) resumes there', async () => {
  const r = new Rig();
  await start(r);
  await intro(r);
  await ayah(r, 1);
  r.player.finish();
  void r.agent.endCall();
  await flush();
  expect(r.s.screen).toBe('ended');
  expect(r.s.endedByUser).toBe(true);
  const cp = r.sink.checkpoints.at(-1)!;
  expect(cp.stepIndex).toBe(2);
  expect(cp.doneRefs).toEqual(new Set([refKey(quranRef(112, 1))]));
  expect(r.player.playing).toBe(false);

  const r2 = new Rig();
  await start(r2, cp);
  expect(r2.s.screen).toBe('ayah');
  expect(r2.s.ayahRef).toEqual(quranRef(112, 2));
  expect(r2.agent.progress.doneRefs).toEqual(new Set([refKey(quranRef(112, 1))]));
  await r.agent.dispose();
  await r2.agent.dispose();
});

test('tap fallback answers «نعم»; tapping the teacher skips a line', async () => {
  const r = new Rig();
  await start(r);
  r.agent.tapTeacher(); // skip greeting
  await flush();
  expect(r.s.captionId).toBe('intro.plan');
  await elapse(LINE * 3);
  r.agent.micTap();
  await elapse(GUARD);
  r.agent.micTap(); // frame 18: live mic = «قلت نعم»
  await flush();
  expect(r.s.screen).toBe('ayah');
  expect(events(r, 'tapFallback')).toHaveLength(1);
  await r.agent.dispose();
});

test('day 2: report → re-record → auto-save → hadith → end', async () => {
  const r = new Rig({ lessonId: 'm01-w03-day2', now: new Date(2026, 8, 25, 9) });
  await start(r);
  expect(r.s.screen).toBe('projectReport');
  await elapse(LINE);
  expect(r.s.beat).toBe('awaitMic');
  expect(r.s.caption).toBe(r.s.project!.reportAsk);

  r.agent.micTap();
  await flush();
  expect(r.s.beat).toBe('recording');
  await elapse(5000);
  expect(r.s.recordingElapsedMs).toBe(5000);
  r.agent.micTap();
  await flush();
  expect(r.s.beat).toBe('recorded');
  expect(r.s.recordedDurationMs).toBe(11_000);

  r.agent.reRecord();
  await flush();
  expect(r.recorder.discarded).toHaveLength(1);
  expect(r.s.beat).toBe('recording');
  r.agent.micTap();
  await flush();
  await elapse(LINE + 3200);
  expect(r.s.beat).toBe('advancing');
  expect(r.teacher.spoken.at(-1)).toBe('report.to_hadith');
  expect(r.sink.reports).toHaveLength(1);
  expect(r.sink.reports[0]![0]).toBe('birr-3-acts');
  expect(r.sink.reports[0]![1].path).toBe('/tmp/take2.m4a');
  await elapse(LINE);

  expect(r.s.screen).toBe('hadith');
  await elapse(LINE);
  await openMic(r);
  await threeRepeats(r);
  await elapse(LINE);
  expect(r.s.screen).toBe('lessonEnd');
  await elapse(LINE * 2);
  expect(r.s.beat).toBe('done');
  expect(r.teacher.spoken).toEqual([
    'report.greet.morning',
    'report.ask',
    'report.thanks',
    'report.thanks',
    'report.to_hadith',
    'hadith.topic',
    'ayah.repeat_now',
    'count.two_left',
    'count.one_left',
    'hadith.praise',
    'end.praise',
    'end.bye',
  ]);
  expect(r.agent.progress.reportedProject).toBe('birr-3-acts');
  await r.agent.dispose();
});

test('report save failure keeps the recording and retries', async () => {
  const r = new Rig({ lessonId: 'm01-w03-day2' });
  r.sink.failSave = true;
  await start(r);
  await elapse(LINE);
  r.agent.micTap();
  await flush();
  r.agent.micTap();
  await flush();
  await elapse(LINE + 3200);
  expect(r.s.beat).toBe('recorded');
  expect(r.s.saveFailed).toBe(true);
  expect(r.recorder.discarded).toHaveLength(0);

  r.sink.failSave = false;
  r.agent.continueTapped();
  await elapse(LINE * 2);
  expect(r.sink.reports).toHaveLength(1);
  expect(r.s.screen).toBe('hadith');
  await r.agent.dispose();
});

test('approved hadith plays automatically, with no code change', async () => {
  const hadith = HadithRepository.fromJson({
    hadith: [
      {
        id: 'PLACEHOLDER-birr-alwalidayn',
        title: 'حديث برّ الوالدين',
        approved: true,
        text: 'TEST-TEXT',
        takhrij: 'TEST-TAKHRIJ',
        grading: 'TEST-GRADE',
        source: 'TEST-SOURCE',
        reviewedBy: 'TEST-REVIEWER',
        audio: 'audio/hadith/test.mp3',
      },
    ],
  });
  const r = new Rig({ lessonId: 'm01-w03-day2', content: realContent({ hadith }) });
  await start(r);
  r.agent.nextAyah(); // no ayat in day 2 → no-op
  await elapse(LINE);
  r.agent.micTap();
  await flush();
  r.agent.micTap();
  await flush();
  await elapse(LINE + 3200);
  await elapse(LINE);
  await elapse(LINE); // hadith.topic
  expect(r.s.screen).toBe('hadith');
  expect(r.s.beat).toBe('reciting');
  expect(r.s.captionId).toBe('ui.listen_hadith');
  expect(r.player.lastAsset).toBe('audio/hadith/test.mp3');
  expect(r.s.hadith!.displayText).toBe('TEST-TEXT');
  await r.agent.dispose();
});

test('audio not on the device and offline → failed before starting', async () => {
  const script = parseLessonScript({
    contractVersion: '0.1',
    lessonId: 'offline-test',
    title: 't',
    steps: [{ type: 'ayah_loop', ref: { surah: 2, ayah: 255 }, repeats: 3 }],
  });
  const r = new Rig({ script }); // fetch fails: offline
  void r.agent.start();
  await flush();
  expect(r.s.screen).toBe('failed');
  expect(r.s.contentUnavailable).toBe(true);
  expect(r.player.started).toHaveLength(0);
  await r.agent.dispose();
});

test('invalid ayah refs are rejected', () => {
  expect(() =>
    validateLessonScript(
      parseLessonScript({
        contractVersion: '0.1',
        lessonId: 'x',
        title: 't',
        steps: [{ type: 'ayah_loop', ref: { surah: 112, ayah: 5 } }],
      }),
      realContent().meta,
    ),
  ).toThrow(FormatError);
  expect(() => parseLessonScript({ contractVersion: '9', lessonId: 'x', title: 't', steps: [] })).toThrow(
    FormatError,
  );
});
