// LessonAgent v0.2 (ai/CONTRACT.md §8 PROPOSAL; review notes C8–C12): the three
// memorization stages, no taps, the go-ahead before the hadith, manners_redirect,
// visible save failures. Vitest fake timers drive the clock.
// Mirrored by app/test/lesson/lesson_agent_test.dart.
import { HadithRepository } from './hadith';
import { quranRef, refKey } from './quran';
import { FormatError } from './quran';
import { parseLessonScript, validateLessonScript } from './script';
import { AYAH_REPEATS, buildReviewScript, expandLesson, FULL_SURAH_PASSES, STAGE1_PASSES } from './stages';
import type { LessonProgress } from './state';
import { loadScript, realContent, Rig } from './testing/fakes';
import { stageOf } from './web/progressSink';

const LINE = 1300; // fake speech (1 s) + echo guard (0.3 s)
const GUARD = 300;
const SILENCE = 7000;
const ADVANCE = 2000;

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

const stepType = (r: Rig) => r.agent.script.steps[r.s.stepIndex]?.type;

/**
 * Plays the child: lets each recitation finish, repeats when listening, reads the
 * whole surah (one long utterance per pass), and says «نعم» before the hadith.
 */
async function autopilot(r: Rig, until: () => boolean, maxMs = 900_000) {
  let passKey = '';
  for (let t = 0; t < maxMs; t += 100) {
    if (until()) return;
    const s = r.s;
    if (s.beat === 'reciting' && r.player.playing && !r.player.paused) {
      r.player.finish();
    } else if (s.beat === 'listening' && r.teacher.isListening) {
      if (stepType(r) === 'full_surah') {
        const key = `${s.stepIndex}:${s.passesDone}`;
        if (key !== passKey) {
          passKey = key;
          r.teacher.childRepeats(120_000); // a whole reading, then the pause completes the pass
        }
      } else {
        r.teacher.childRepeats();
      }
    } else if (s.beat === 'hearingAnswer' && r.teacher.isListening) {
      r.teacher.emit({ type: 'answerDetected', intent: 'yes' });
    }
    await elapse(100);
  }
  throw new Error(
    `autopilot timed out at ${JSON.stringify({ screen: r.s.screen, beat: r.s.beat, step: r.s.stepIndex })}`,
  );
}

/** The exact teacher lines of stage 2 for one ayah (5 repeats), ending with `praise`. */
const stage2Ayah = (praise: string) => [
  'ayah.repeat_now',
  'count.more',
  'count.more',
  'count.two_left',
  'count.one_left',
  praise,
];

test('stages: v0.1 Al-Ikhlas expands to 1× whole surah after the reciter → 5× per ayah → whole surah ×2', () => {
  const s = loadScript('m01-w03-ikhlas');
  const x = expandLesson(s);
  expect(STAGE1_PASSES).toBe(1);
  expect(AYAH_REPEATS).toBe(5);
  expect(FULL_SURAH_PASSES).toBe(2);
  expect(x.steps.map((st) => st.type)).toEqual([
    'intro',
    'stage_intro',
    'listen_surah',
    'full_surah',
    'stage_intro',
    'ayah_loop',
    'ayah_loop',
    'ayah_loop',
    'ayah_loop',
    'stage_intro',
    'full_surah',
    'surah_done',
    'hadith_loop',
    'project_assign',
    'lesson_end',
  ]);
  expect(x.steps[3]).toMatchObject({ type: 'full_surah', passes: 1, stage: 1 });
  expect(x.steps.filter((st) => st.type === 'ayah_loop').every((st) => st.repeats === 5)).toBe(true);
  expect(x.steps[10]).toMatchObject({ type: 'full_surah', passes: 2, stage: 3 });
  expect(x.steps[0]).toMatchObject({ lines: ['greet', 'intro.plan', 'intro.surah', 'intro.count'] });
  expect(expandLesson(x)).toBe(x); // idempotent
});

test('full Al-Ikhlas run: the exact action sequence, no taps, progress saved with stage «done»', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.beat === 'done');

  expect(r.teacher.spoken).toEqual([
    // intro (no «جاهز نبدأ نحفظ؟» — nothing waits)
    'greet.evening',
    'intro.plan',
    'intro.surah',
    'intro.count',
    // stage 1: the reciter plays the whole surah, then the child reads it once
    'stage.1',
    'stage1.your_turn',
    'praise.good',
    // stage 2: each ayah 5×
    'stage.2',
    ...stage2Ayah('praise.first'),
    ...stage2Ayah('praise.next'),
    ...stage2Ayah('praise.last_left'),
    ...stage2Ayah('praise.all_done'),
    // stage 3: the whole surah twice
    'stage.3',
    'full.start',
    'full.again',
    'full.done',
    // celebration, then the child's go-ahead before the hadith
    'surah.done',
    'surah.proud',
    'surah.next_hadith',
    'surah.to_hadith',
    // hadith (unapproved): the topic only
    'hadith.today',
    'hadith.soon',
    // project of the day: title + the three steps
    'project.today',
    'project.hint',
    'project.hint',
    'project.hint',
    // lesson end (after the final save)
    'end.praise',
    'project.tomorrow',
    'end.see_you',
  ]);
  // The reciter: the whole surah in stage 1, then each ayah again in stage 2; never in stage 3.
  const recited = r.teacher.events.flatMap((e) =>
    e.type === 'recitationStarted' && e.ref ? [refKey(e.ref)] : [],
  );
  expect(recited).toEqual(['112:1', '112:2', '112:3', '112:4', '112:1', '112:2', '112:3', '112:4']);
  expect(r.s.screen).toBe('lessonEnd');
  expect(r.sink.completedCalls).toHaveLength(1);
  const final = r.sink.completedCalls[0]!;
  expect(final.completed).toBe(true);
  expect(stageOf(r.agent.script, final)).toBe('done');
  expect([...final.doneRefs].sort()).toEqual(['112:1', '112:2', '112:3', '112:4']);
  expect([...final.surahsCompleted]).toEqual([112]);
  expect(final.projectAssigned).toBe('birr-3-acts');
  await r.agent.dispose();
});

test('a checkpoint is written at every stage end, with the matching database stage', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.beat === 'done');
  const idx = r.sink.checkpoints.map((c) => c.stepIndex);
  for (const stageStart of [1, 4, 9, 11]) expect(idx).toContain(stageStart);
  const script = r.agent.script;
  const at = (i: number) => stageOf(script, { ...r.sink.checkpoints.find((c) => c.stepIndex === i)! });
  expect([at(1), at(4), at(9), at(11)]).toEqual(['listen_full', 'ayah_repeat', 'full_twice', 'hadith']);
  await r.agent.dispose();
});

test('insult → manners_redirect → the same ayah resumes with the count kept', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.stepIndex === 5 && r.s.beat === 'listening' && r.teacher.isListening);
  for (let k = 1; k <= 2; k++) {
    r.teacher.childRepeats();
    await flush();
    expect(r.s.repeatsDone).toBe(k);
    await elapse(LINE + GUARD);
  }
  expect(r.s.beat).toBe('listening');
  r.teacher.emit({ type: 'mannersRedirect' });
  await flush();
  expect(r.teacher.spoken.at(-1)).toBe('manners.redirect');
  expect(r.s.repeatsDone).toBe(2); // nothing counted
  await elapse(LINE + GUARD);
  expect(r.s.beat).toBe('listening');
  expect(r.s.stepIndex).toBe(5);
  expect(r.s.ayahRef).toEqual(quranRef(112, 1));
  for (let k = 3; k <= 5; k++) {
    r.teacher.childRepeats();
    await flush();
    expect(r.s.repeatsDone).toBe(k);
    if (k < 5) await elapse(LINE + GUARD);
  }
  expect(r.teacher.spoken.at(-1)).toBe('praise.first');
  await r.agent.dispose();
});

test('stage 2 needs exactly 5 repeats per ayah before moving on', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.stepIndex === 5 && r.s.beat === 'listening' && r.teacher.isListening);
  for (let k = 1; k <= 4; k++) {
    r.teacher.childRepeats();
    await flush();
    expect(r.s.stepIndex).toBe(5);
    await elapse(LINE + GUARD);
  }
  expect(r.s.repeatsDone).toBe(4);
  r.teacher.childRepeats();
  await flush();
  expect(r.s.beat).toBe('praising');
  await elapse(LINE);
  expect(r.s.stepIndex).toBe(6);
  await r.agent.dispose();
});

test('a full pass needs half the reciter time spoken, then a pause; exactly 2 passes', async () => {
  const content = realContent();
  const need =
    [1, 2, 3, 4].reduce((t, a) => t + (content.audio.durationMsOf?.(quranRef(112, a)) ?? 2500), 0) / 2;
  const r = new Rig({ content });
  await start(r);
  await autopilot(r, () => r.s.stepIndex === 10 && r.s.beat === 'listening' && r.teacher.isListening);
  expect(r.s.passesTarget).toBe(2);
  r.teacher.childRepeats(need / 2); // not enough yet
  await elapse(3000);
  expect(r.s.passesDone).toBe(0);
  r.teacher.childRepeats(need); // enough…
  await elapse(1000);
  r.teacher.emit({ type: 'speechStarted' }); // …but still reading: no pass yet
  await elapse(3000);
  expect(r.s.passesDone).toBe(0);
  r.teacher.emit({ type: 'repeatDetected', voicedMs: 200 });
  await elapse(2500); // the pause after the reading
  expect(r.s.passesDone).toBe(1);
  expect(r.teacher.spoken.at(-1)).toBe('full.again');
  await elapse(LINE + GUARD);
  r.teacher.childRepeats(need + 1);
  await elapse(2500);
  expect(r.s.passesDone).toBe(2);
  expect(r.teacher.spoken.at(-1)).toBe('full.done');
  await elapse(LINE + ADVANCE);
  expect(r.s.screen).toBe('surahDone');
  await r.agent.dispose();
});

test('exit mid-stage saves the step; start(from:) resumes at the same ayah of the same stage', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.stepIndex === 6 && r.s.beat === 'listening');
  await r.agent.endCall();
  expect(r.s.screen).toBe('ended');
  const saved = r.sink.checkpoints.at(-1)!;
  expect(saved.stepIndex).toBe(6);
  await r.agent.dispose();

  const r2 = new Rig();
  await start(r2, saved);
  expect(r2.s.stepIndex).toBe(6);
  expect(r2.s.stage).toBe(2);
  expect(r2.s.ayahRef).toEqual(quranRef(112, 2));
  expect(r2.s.beat).toBe('reciting');
  await r2.agent.dispose();
});

test('the hadith waits for the child: silence re-asks, voice goes on', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.beat === 'hearingAnswer' && r.teacher.isListening);
  expect(r.s.screen).toBe('surahDone');
  await elapse(SILENCE);
  expect(r.teacher.spoken.at(-1)).toBe('nudge.answer');
  await elapse(LINE + GUARD + 100);
  expect(r.s.screen).toBe('surahDone'); // no timer moves on without the child
  expect(r.s.beat).toBe('hearingAnswer');
  r.teacher.emit({ type: 'answerDetected', intent: 'yes' });
  await elapse(LINE + ADVANCE + 100);
  expect(r.s.screen).toBe('hadith');
  await r.agent.dispose();
});

test('the final save failing never shows the lesson as finished; retry finishes it', async () => {
  const r = new Rig();
  await start(r);
  r.sink.failCompleted = true;
  await autopilot(r, () => r.s.beat === 'saveFailed');
  expect(r.s.screen).not.toBe('lessonEnd');
  expect(r.s.progressSaveFailed).toBe(true);
  expect(r.teacher.spoken).not.toContain('end.praise');
  r.sink.failCompleted = false;
  r.agent.continueTapped();
  await autopilot(r, () => r.s.beat === 'done');
  expect(r.s.screen).toBe('lessonEnd');
  expect(r.s.progressSaveFailed).toBe(false);
  expect(r.sink.completedCalls).toHaveLength(1);
  await r.agent.dispose();
});

test('a checkpoint that fails is shown, and the next success clears it', async () => {
  const r = new Rig();
  r.sink.failCheckpoint = true;
  await start(r);
  expect(r.s.progressSaveFailed).toBe(true);
  expect(r.s.screen).toBe('intro'); // the lesson goes on
  r.sink.failCheckpoint = false;
  await autopilot(r, () => r.s.stepIndex >= 1);
  await flush();
  expect(r.s.progressSaveFailed).toBe(false);
  await r.agent.dispose();
});

test('silence in stage 2: nudges, then one replay, then waits quietly', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.stepIndex === 5 && r.s.beat === 'listening' && r.teacher.isListening);
  await elapse(SILENCE);
  expect(r.teacher.spoken.at(-1)).toBe('nudge.start');
  await elapse(LINE + GUARD + SILENCE);
  expect(r.teacher.spoken.at(-1)).toBe('nudge.start');
  await elapse(LINE + GUARD + SILENCE);
  expect(r.s.beat).toBe('reciting'); // the one replay
  r.player.finish();
  await elapse(LINE + GUARD + SILENCE * 4);
  expect(r.s.beat).toBe('listening'); // then just waits
  await r.agent.dispose();
});

test('autoplay blocked → the fallback play, then the surah continues', async () => {
  const r = new Rig();
  r.player.blockAutoplay = true;
  await start(r);
  await autopilot(r, () => r.s.playbackBlocked);
  expect(stepType(r)).toBe('listen_surah');
  r.player.blockAutoplay = false;
  r.agent.play();
  await flush();
  expect(r.s.beat).toBe('reciting');
  expect(r.player.playing).toBe(true);
  await r.agent.dispose();
});

test('backgrounded: everything pauses; back: the same moment, counts kept', async () => {
  const r = new Rig();
  await start(r);
  await autopilot(r, () => r.s.stepIndex === 5 && r.s.beat === 'listening' && r.teacher.isListening);
  r.teacher.childRepeats();
  await elapse(LINE + GUARD);
  r.agent.setForeground(false);
  await flush();
  expect(r.s.paused).toBe(true);
  expect(r.teacher.isListening).toBe(false);
  await elapse(60_000);
  r.agent.setForeground(true);
  await elapse(GUARD);
  expect(r.s.beat).toBe('listening');
  expect(r.s.repeatsDone).toBe(1);
  await r.agent.dispose();
});

test('mic refused → «awaitMic» with the flag; a tap retries', async () => {
  const r = new Rig();
  r.teacher.denyMic = true;
  await start(r);
  await autopilot(r, () => r.s.micDenied);
  expect(r.s.beat).toBe('awaitMic');
  r.teacher.denyMic = false;
  r.agent.micTap();
  await elapse(GUARD);
  expect(r.s.beat).toBe('listening');
  expect(r.s.micDenied).toBe(false);
  await r.agent.dispose();
});

test('captions: ayah count only, no Makki/Madani, slots filled', async () => {
  const r = new Rig();
  const captions: string[] = [];
  r.agent.state.subscribe((s) => captions.push(s.caption));
  await start(r);
  await elapse(LINE * 4);
  expect(captions).toContain('وهي قصيرة — أربع آيات فقط!');
  expect(captions).toContain('نبدأ بسورة الإخلاص.');
  expect(captions.filter((c) => c.includes('مك') || c.includes('مدن'))).toEqual([]);
  await r.agent.dispose();
});

test('day 2: the report records and stops by itself → auto-save → hadith → end', async () => {
  const r = new Rig({ lessonId: 'm01-w03-day2', now: new Date(2026, 8, 25, 9) });
  await start(r);
  expect(r.s.screen).toBe('projectReport');
  await elapse(LINE * 2);
  expect(r.s.beat).toBe('recording'); // no tap
  r.recorder.talk(0.6);
  await elapse(1500);
  r.recorder.talk(0.6);
  await elapse(4000); // quiet → stops by itself
  expect(r.s.beat).toBe('recorded');
  expect(r.s.recordedDurationMs).toBe(11_000);
  await autopilot(r, () => r.s.beat === 'done');
  expect(r.teacher.spoken).toEqual([
    'report.greet.morning',
    'report.ask',
    'report.thanks',
    'report.to_hadith',
    'hadith.today',
    'hadith.soon',
    'end.praise',
    'end.see_you',
  ]);
  expect(r.sink.reports).toHaveLength(1);
  expect(r.sink.reports[0]![0]).toBe('birr-3-acts');
  expect(r.agent.progress.reportedProject).toBe('birr-3-acts');
  await r.agent.dispose();
});

test('report save failure keeps the recording and retries', async () => {
  const r = new Rig({ lessonId: 'm01-w03-day2' });
  r.sink.failSave = true;
  await start(r);
  await elapse(LINE * 2);
  r.recorder.talk(0.6);
  await elapse(5000);
  await elapse(LINE + 3200);
  expect(r.s.beat).toBe('recorded');
  expect(r.s.saveFailed).toBe(true);
  expect(r.recorder.discarded).toHaveLength(0);
  r.sink.failSave = false;
  r.agent.continueTapped();
  await elapse(LINE * 2 + ADVANCE);
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
        topic: 'برّ الوالدين',
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
  await elapse(LINE * 2);
  r.recorder.talk(0.6);
  await elapse(5000);
  await autopilot(r, () => r.s.screen === 'hadith' && r.s.beat === 'reciting');
  expect(r.s.captionId).toBe('ui.listen_hadith');
  expect(r.player.lastAsset).toBe('audio/hadith/test.mp3');
  expect(r.s.hadith!.displayText).toBe('TEST-TEXT');
  await r.agent.dispose();
});

test('weekly review: each memorized surah read once in full; unapproved hadith skipped', async () => {
  const script = buildReviewScript({ memorizedSurahs: [112], approvedHadithIds: [] });
  expect(script.steps.map((s) => s.type)).toEqual([
    'review_intro',
    'stage_intro',
    'full_surah',
    'lesson_end',
  ]);
  const r = new Rig({ script });
  await start(r);
  expect(r.s.screen).toBe('reviewIntro');
  await autopilot(r, () => r.s.beat === 'done');
  expect(r.teacher.spoken).toEqual([
    'review.intro',
    'review.surah',
    'full.start',
    'full.done',
    'end.praise',
    'end.see_you',
  ]);
  expect(r.player.started).toHaveLength(0); // no reciter in a review
  await r.agent.dispose();
});

test('audio not on the device and offline → failed before starting', async () => {
  const script = parseLessonScript({
    contractVersion: '0.1',
    lessonId: 'offline-test',
    title: 't',
    steps: [{ type: 'ayah_loop', ref: { surah: 2, ayah: 255 }, repeats: 3 }],
  });
  const r = new Rig({ script });
  void r.agent.start();
  await flush();
  expect(r.s.screen).toBe('failed');
  expect(r.s.contentUnavailable).toBe(true);
  expect(r.player.started).toHaveLength(0);
  await r.agent.dispose();
});

test('invalid ayah refs and unknown contract versions are rejected', () => {
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
