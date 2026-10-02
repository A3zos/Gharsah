import { describe, expect, it, vi } from 'vitest';

import { PlaybackBlocked } from '../ports';
import { AgentApi } from './api';
import type { ProgressUpdate } from './progressMap';
import {
  AUTO_LISTEN_TRIES,
  HADITH_PLACEHOLDER,
  normalizeArabic,
  RATE_LIMIT_BACKOFF_MS,
  ServerLesson,
  type PresenceListener,
  type LessonPlan,
  type ServerLessonDeps,
  type ServerLessonState,
  type UrlPlayer,
  type UtteranceRecorder,
} from './serverLesson';
import { EVERYAYAH, FakeAgentServer } from './testing/fakeServer';

interface Setup {
  server: FakeAgentServer;
  lesson: ServerLesson;
  spoken: string[];
  played: string[];
  updates: ProgressUpdate[];
  sleeps: number[];
}

/** Pilot day 1 (the fake server teaches الإخلاص + برّ الوالدين). */
const PLAN: LessonPlan = {
  lessonId: 'pilot-day-1',
  surahNo: 112,
  surahName: 'الإخلاص',
  hadithTopic: 'برّ الوالدين',
  hadithStepIndex: 9,
  lastStepIndex: 10,
};

function setup(o: Partial<ServerLessonDeps> & { server?: FakeAgentServer; childName?: string } = {}): Setup {
  const server = o.server ?? new FakeAgentServer();
  const spoken: string[] = [];
  const played: string[] = [];
  const updates: ProgressUpdate[] = [];
  const sleeps: number[] = [];
  const lesson = new ServerLesson({
    api: new AgentApi('https://ai.test', server.fetch, o.childName ? [o.childName] : []),
    voice: { speak: async (t) => void spoken.push(t), stop: () => {} },
    player: { play: async (u) => void played.push(u), stop: () => {} },
    presence: { waitForSpeech: async () => 'spoke' },
    sink: { record: async (u) => void updates.push(u) },
    plan: PLAN,
    deviceId: 'dev-1',
    gender: 'boy',
    consent: false,
    verifiedAyah: (s, a) => (s === 112 && a >= 1 && a <= 4 ? `VERIFIED-${s}:${a}` : null),
    ayahCount: () => 4,
    surahName: () => 'الإخلاص',
    blobToBase64: async () => 'QUJD',
    sleep: async (ms) => void sleeps.push(ms),
    warmingAfterMs: 10_000,
    ...o,
  });
  return { server, lesson, spoken, played, updates, sleeps };
}

const until = (l: ServerLesson, f: (s: ServerLessonState) => boolean) =>
  vi.waitFor(() => {
    if (!f(l.state.value))
      throw new Error(`not yet: ${JSON.stringify({ ...l.state.value, stages: undefined })}`);
  });
const at = (l: ServerLesson, stage: string, expects: ServerLessonState['expects']) =>
  until(l, (s) => s.stages[s.stageIndex]?.id === stage && s.expects === expects && !s.busy);

/** The furthest update per lesson. */
const last = (updates: ProgressUpdate[], lessonId: string) =>
  updates.filter((u) => u.lessonId === lessonId).at(-1);

describe('ServerLesson — mocked end-to-end', () => {
  it('a full quran lesson, then the hadith lesson (no consent)', async () => {
    const t = setup();
    const { lesson, server } = t;
    void lesson.start();

    // greet — text: quick replies + text field
    await at(lesson, 'greet', 'text');
    expect(lesson.state.value.quickReplies).toEqual(['الحمد لله بخير', 'تمام']);
    expect(lesson.state.value.teacher).toBe('المعلم عبدالله');
    expect(lesson.state.value.canSpeak).toBe(false);
    lesson.answer('الحمد لله بخير');

    // name and «which surah?» — answered on the device (بطل / today's surah), never voiced
    await at(lesson, 'lesson_intro', 'continue');
    expect(server.messages()).toEqual(['الحمد لله بخير', 'بطل', 'الإخلاص']);
    expect(t.spoken).not.toContain('وش اسمك؟');
    expect(t.spoken.some((x) => x.includes('نحفظ سورة'))).toBe(false);

    await at(lesson, 'lesson_intro', 'continue');
    lesson.continueTapped();
    // tafsir — the ayat shown are the verified local text, never the server's strings
    await at(lesson, 'tafsir', 'continue');
    expect(lesson.state.value.ayat).toEqual(
      [1, 2, 3, 4].map((a) => ({ ayah: a, text: `VERIFIED-112:${a}` })),
    );
    expect(JSON.stringify(lesson.state.value)).not.toContain('SERVER-TEXT');
    expect(lesson.state.value.surahName).toBe('الإخلاص');
    lesson.continueTapped();
    await at(lesson, 'fadl', 'continue');
    lesson.continueTapped();

    // recitation — 4 repeats counted on the device; each sends the server's reference line
    await at(lesson, 'tajweed', 'continue');
    expect(server.messages().slice(-4)).toEqual(['REF-AYAH-1', 'REF-AYAH-2', 'REF-AYAH-3', 'REF-AYAH-4']);
    expect(t.played).toEqual([...[1, 2, 3, 4].map(EVERYAYAH), ...[1, 2, 3, 4].map(EVERYAYAH)]);
    expect(server.calls.some((c) => c.path === '/agent/score-recitation')).toBe(false);
    lesson.continueTapped();
    await at(lesson, 'plan', 'continue');
    lesson.continueTapped();

    // done (expects none) → the next session is offered
    await until(lesson, (s) => s.phase === 'segmentDone');
    expect(lesson.state.value.nextSegment).toBe('hadith');
    // today's row: the surah part done → «hadith», resume point = the built-in hadith step
    expect(lesson.state.value.quranDone).toBe(true);
    expect(last(t.updates, 'pilot-day-1')).toMatchObject({
      stage: 'hadith',
      stepIndex: PLAN.hadithStepIndex,
      doneRefs: ['112:1', '112:2', '112:3', '112:4'],
    });
    expect(new Set(t.updates.map((u) => u.lessonId))).toEqual(new Set(['pilot-day-1']));
    // stages only ever move forward
    const ranks = t.updates.map((u) => u.stage);
    expect(ranks).toEqual([...ranks].sort((a, b) => order(a) - order(b)));

    // ── hadith ──
    lesson.continueTapped();
    await at(lesson, 'greet', 'text');
    lesson.answer('تمام');
    await at(lesson, 'intro', 'continue');
    lesson.continueTapped();
    await at(lesson, 'text', 'continue');
    expect(lesson.state.value.hadith).toEqual({ title: 'برّ الوالدين', source: 'متفق عليه' });
    expect(JSON.stringify(lesson.state.value)).not.toContain('SERVER-HADITH-TEXT');
    expect(HADITH_PLACEHOLDER).toMatch(/يُعتمد لاحقًا/);
    lesson.continueTapped();
    await at(lesson, 'words', 'continue');
    expect(lesson.state.value.words).toEqual([]); // hidden until the hadith is approved
    lesson.continueTapped();
    await at(lesson, 'meaning', 'continue');
    lesson.continueTapped();
    await at(lesson, 'example', 'continue');
    lesson.continueTapped();
    // memorize (repeat, presence) → quiz (choice: buttons only)
    await at(lesson, 'quiz', 'choice');
    expect(lesson.state.value.quickReplies).toEqual(['الأم', 'الصديق']);
    expect(server.messages()).toContain('SERVER-HADITH-TEXT');
    lesson.answer('الأم');
    await at(lesson, 'action', 'continue');
    lesson.continueTapped();
    await at(lesson, 'project', 'text');
    lesson.answer('بساعد أمي في البيت');

    await until(lesson, (s) => s.phase === 'finished' && s.projects.length > 0);
    expect(lesson.state.value.projects[0]).toMatchObject({ hadithId: 9, done: false });
    await lesson.markProjectDone(9);
    expect(lesson.state.value.projects[0]!.done).toBe(true);
    expect(last(t.updates, 'pilot-day-1')).toMatchObject({ stage: 'done', stepIndex: PLAN.lastStepIndex });
    expect(new Set(t.updates.map((u) => u.lessonId))).toEqual(new Set(['pilot-day-1']));

    // privacy: two /agent/start calls, neither with a name; only the random device id
    const starts = server.calls.filter((c) => c.path === '/agent/start');
    expect(starts.map((c) => c.body)).toEqual([
      { mode: 'quran', gender: 'boy', device_id: 'dev-1' },
      { mode: 'hadith', gender: 'boy', device_id: 'dev-1' },
    ]);
    // no consent → the review status endpoints were never asked
    expect(server.calls.some((c) => c.path.includes('taseem'))).toBe(false);
  });

  it('the server teaching another surah → the built-in lesson (which follows the plan)', async () => {
    const t = setup({ plan: { ...PLAN, lessonId: 'pilot-day-2', surahNo: 114, surahName: 'الناس' } });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await until(t.lesson, (s) => s.phase === 'fallback');
    expect(t.server.messages()).toEqual(['تمام', 'بطل', 'الناس']);
  });

  it("a hadith that isn't today's topic → the built-in lesson from the hadith", async () => {
    const t = setup({ plan: { ...PLAN, hadithTopic: 'الكذب' } });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    for (const stage of ['lesson_intro', 'tafsir', 'fadl', 'tajweed', 'plan']) {
      await at(t.lesson, stage, 'continue');
      t.lesson.continueTapped();
    }
    await until(t.lesson, (s) => s.phase === 'segmentDone');
    t.lesson.continueTapped();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await at(t.lesson, 'intro', 'continue');
    t.lesson.continueTapped();
    // the «text» turn names the hadith (برّ الوالدين ≠ الكذب)
    await until(t.lesson, (s) => s.phase === 'fallback');
    expect(t.lesson.state.value.quranDone).toBe(true);
  });
});

const order = (s: string) => ['listen_full', 'ayah_repeat', 'full_twice', 'hadith', 'done'].indexOf(s);

describe('ServerLesson — repeat and consent', () => {
  const toRecitation = async (t: Setup) => {
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await at(t.lesson, 'lesson_intro', 'continue');
    await at(t.lesson, 'lesson_intro', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'tafsir', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'fadl', 'continue');
    t.lesson.continueTapped();
  };

  it('with consent: the recording goes to score-recitation and its transcription is the answer', async () => {
    const recorder: UtteranceRecorder = { record: async () => new Blob(['x']) };
    const t = setup({ consent: true, recorder });
    await toRecitation(t);
    await at(t.lesson, 'tajweed', 'continue');
    const scores = t.server.calls.filter((c) => c.path === '/agent/score-recitation');
    expect(scores).toHaveLength(4);
    expect(scores[0]!.body).toMatchObject({ audio_base64: 'QUJD' });
    expect(t.server.messages().slice(-4)).toEqual(Array(4).fill('قل هو الله أحد'));
  });

  it('with consent but scoring unavailable: the reference line is sent instead', async () => {
    const server = new FakeAgentServer();
    server.scoreAvailable = false;
    const t = setup({ server, consent: true, recorder: { record: async () => new Blob(['x']) } });
    await toRecitation(t);
    await at(t.lesson, 'tajweed', 'continue');
    expect(t.server.messages().slice(-4)).toEqual(['REF-AYAH-1', 'REF-AYAH-2', 'REF-AYAH-3', 'REF-AYAH-4']);
  });

  it('without consent the recorder is never used even if present', async () => {
    const record = vi.fn(async () => new Blob(['x']));
    const t = setup({ consent: false, recorder: { record } });
    await toRecitation(t);
    await at(t.lesson, 'tajweed', 'continue');
    expect(record).not.toHaveBeenCalled();
  });

  it('mic refused → micDenied, and «ردّدت» sends the repeat', async () => {
    const presence: PresenceListener = { waitForSpeech: async () => 'denied' };
    const t = setup({ presence });
    await toRecitation(t);
    await until(t.lesson, (s) => s.expects === 'repeat' && s.micDenied);
    t.lesson.repeatTapped();
    await until(t.lesson, (s) => s.expects === 'repeat' && s.currentAyah === 2);
    expect(t.server.messages().at(-1)).toBe('REF-AYAH-1');
  });

  it('silence keeps listening (never a dead end) and «ردّدت» works any time', async () => {
    let calls = 0;
    const presence: PresenceListener = {
      waitForSpeech: (signal) =>
        new Promise((resolve) => {
          calls++;
          if (calls < 3) return resolve('silent');
          signal.addEventListener('abort', () => resolve('silent'));
        }),
    };
    const t = setup({ presence });
    await toRecitation(t);
    await until(t.lesson, (s) => s.expects === 'repeat' && s.repeat === 'listening');
    await vi.waitFor(() => expect(calls).toBe(3));
    t.lesson.repeatTapped();
    await vi.waitFor(() => expect(t.server.messages().at(-1)).toBe('REF-AYAH-1'));
  });

  it('speech recognition only with consent', async () => {
    const listen = vi.fn(async () => 'بخير والحمد لله');
    const off = setup({ speechInput: { listen }, consent: false });
    void off.lesson.start();
    await at(off.lesson, 'greet', 'text');
    expect(off.lesson.state.value.canSpeak).toBe(false);
    expect(listen).not.toHaveBeenCalled();
  });

  it('like a call: after the line, the mic listens by itself and the answer is sent', async () => {
    const said = ['بخير والحمد لله'];
    const listen = vi.fn(async () => said.shift() ?? null);
    const t = setup({ speechInput: { listen }, consent: true });
    void t.lesson.start();
    // greet (free answer) → name (auto) → surah (choice: matched to the button) → intro
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.server.messages()).toEqual(['بخير والحمد لله', 'بطل', 'الإخلاص']);
    expect(t.lesson.state.value.canSpeak).toBe(true);
  });

  it('a spoken choice that matches no button is not sent; the mic then waits for a tap', async () => {
    const { QURAN_STAGES } = await import('./testing/fakeServer');
    // a multiple-choice greeting (the surah question is answered automatically now)
    const server = new FakeAgentServer(
      QURAN_STAGES.map((st) =>
        st.id === 'greet' ? { ...st, expects: 'choice' as const, quick: ['بخير', 'تعبان'] } : st,
      ),
    );
    const said = ['ما أدري', 'ولا شي'];
    const listen = vi.fn(async () => said.shift() ?? null);
    const t = setup({ server, speechInput: { listen }, consent: true });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'choice');
    await until(t.lesson, (s) => !s.hearing && listen.mock.calls.length === AUTO_LISTEN_TRIES);
    expect(t.server.messages()).toEqual([]);
    // «أنا بخير الحمد لله» matches the «بخير» button
    said.push('أنا بخير الحمد لله');
    await t.lesson.speakAnswer();
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.server.messages()).toEqual(['بخير', 'بطل', 'الإخلاص']);
  });

  it('silence: listens AUTO_LISTEN_TRIES times, then the mic tap listens again', async () => {
    const said: (string | null)[] = [null, null, 'تمام'];
    const listen = vi.fn(async () => said.shift() ?? null);
    const t = setup({ speechInput: { listen }, consent: true });
    void t.lesson.start();
    await until(
      t.lesson,
      (s) => s.expects === 'text' && !s.hearing && listen.mock.calls.length === AUTO_LISTEN_TRIES,
    );
    expect(t.server.messages()).toEqual([]);
    await t.lesson.speakAnswer();
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.server.messages()[0]).toBe('تمام');
  });

  it('with consent, a ready taseem runs first; the server sends no text and none is shown', async () => {
    const server = new FakeAgentServer();
    server.readyTaseem = [{ item_key: '112:0', ready: true, surah_no: 112, chunk: 0 }];
    const t = setup({ server, consent: true });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'segmentDone');
    expect(t.lesson.state.value).toMatchObject({ segment: 'taseem', nextSegment: 'quran', ayat: [] });
    expect(server.calls.find((c) => c.path === '/agent/taseem/start')!.body).toEqual({
      device_id: 'dev-1',
      gender: 'boy',
      surah_no: 112,
      chunk: 0,
    });
    expect(t.updates).toEqual([]); // reviews don't write progress
    t.lesson.continueTapped();
    await at(t.lesson, 'greet', 'text');
  });
});

describe('ServerLesson — errors and fallback', () => {
  it('429: a gentle notice, backoff, then it carries on', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.server.failures.push(['/agent/message', 429], ['/agent/message', 429]);
    t.lesson.answer('تمام');
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.sleeps.slice(0, 2)).toEqual(RATE_LIMIT_BACKOFF_MS.slice(0, 2));
    expect(t.lesson.state.value.notice).toBeNull();
  });

  it('404 session expired: a new session starts transparently', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.server.failures.push(['/agent/message', 404]);
    t.lesson.answer('تمام');
    await at(t.lesson, 'greet', 'text');
    await until(t.lesson, (s) => s.notice === 'restarted');
    expect(t.server.calls.filter((c) => c.path === '/agent/start')).toHaveLength(2);
    expect(t.lesson.state.value.phase).toBe('live');
  });

  it('cold start: «warming» while the first answer is slow', async () => {
    let release = () => {};
    const server = new FakeAgentServer();
    const slow = server.fetch;
    const gate = new Promise<void>((r) => (release = r));
    const t = setup({
      server: Object.assign(server, {
        fetch: async (u: string, i?: RequestInit) => {
          await gate;
          return slow(u, i);
        },
      }),
      warmingAfterMs: 5,
    });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'warming');
    release();
    await at(t.lesson, 'greet', 'text');
  });

  it('server down at the start → fallback (the built-in lesson takes over)', async () => {
    const t = setup();
    t.server.failures.push(['/agent/start', 500], ['/agent/start', 503], ['/agent/start', 502]);
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'fallback');
  });

  it('server down mid-lesson → fallback after retries', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.server.failures.push(['/agent/message', 500], ['/agent/message', 500], ['/agent/message', 500]);
    t.lesson.answer('تمام');
    await until(t.lesson, (s) => s.phase === 'fallback');
  });

  it('too many restarts → fallback', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    for (let i = 0; i < 3; i++) {
      t.server.failures.push(['/agent/message', 404]);
      t.lesson.answer('تمام');
      if (i < 2) await until(t.lesson, (s) => s.notice === 'restarted' && s.expects === 'text' && !s.busy);
    }
    await until(t.lesson, (s) => s.phase === 'fallback');
  });
});

describe('ServerLesson — stages bar, autoplay, pause', () => {
  it('jumps back only to reached stages', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await at(t.lesson, 'lesson_intro', 'continue');
    await at(t.lesson, 'lesson_intro', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'tafsir', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'fadl', 'continue');

    t.lesson.jumpTo(8); // not reached yet — ignored
    expect(t.server.calls.some((c) => c.path === '/agent/jump')).toBe(false);
    t.lesson.jumpTo(4);
    await at(t.lesson, 'tafsir', 'continue');
    expect(t.server.calls.find((c) => c.path === '/agent/jump')!.body).toEqual({
      session_id: 's1',
      stage: 'tafsir',
    });
    expect(t.lesson.state.value.maxStageIndex).toBe(5);
  });

  it('autoplay refused → the small play button, then the recitation goes on', async () => {
    let blocked = true;
    const player: UrlPlayer = {
      play: async () => {
        if (blocked) {
          blocked = false;
          throw new PlaybackBlocked();
        }
      },
      stop: () => {},
    };
    const t = setup({ player });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await at(t.lesson, 'lesson_intro', 'continue');
    await at(t.lesson, 'lesson_intro', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'tafsir', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'fadl', 'continue');
    t.lesson.continueTapped();
    await until(t.lesson, (s) => s.playbackBlocked);
    t.lesson.playTapped();
    await at(t.lesson, 'tajweed', 'continue');
  });

  it('pause ignores input; resume says the current line again', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.pause();
    t.lesson.answer('تمام');
    expect(t.server.messages()).toEqual([]);
    t.lesson.resume();
    await at(t.lesson, 'greet', 'text');
    expect(t.spoken.filter((s) => s.startsWith('السلام عليكم'))).toHaveLength(2);
  });

  it('an answer that arrives while paused waits for resume', async () => {
    let release = () => {};
    const server = new FakeAgentServer();
    const real = server.fetch;
    let held = false;
    const t = setup({
      server: Object.assign(server, {
        fetch: async (u: string, i?: RequestInit) => {
          if (u.endsWith('/agent/message') && !held) {
            held = true;
            await new Promise<void>((r) => (release = r));
          }
          return real(u, i);
        },
      }),
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await until(t.lesson, (s) => s.busy);
    t.lesson.pause();
    release();
    await until(t.lesson, (s) => s.paused && !s.busy);
    expect(t.spoken.some((s) => s.startsWith('وش رأيك'))).toBe(false);
    t.lesson.resume();
    await at(t.lesson, 'lesson_intro', 'continue');
  });

  it('ignores empty answers and answers while busy', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('   ');
    expect(t.server.messages()).toEqual([]);
    t.lesson.answer('تمام');
    t.lesson.answer('تمام مرة ثانية');
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.server.messages()).toEqual(['تمام', 'بطل', 'الإخلاص']);
  });

  it('the name stage gets the neutral «بطل» for girls too', async () => {
    const t = setup({ gender: 'girl' });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.server.messages()[1]).toBe('بطل');
    expect(t.server.calls[0]!.body).toMatchObject({ gender: 'girl' });
  });
});

describe("ServerLesson — the child's name never leaves the device", () => {
  const NAME = 'أحمد علي';
  /** Any spelling of either name part (diacritics, hamza forms) in what was sent. */
  const leaks = (server: FakeAgentServer) =>
    server.calls
      .map((c) => `${c.path}?${new URLSearchParams(c.query).toString()} ${JSON.stringify(c.body)}`)
      .filter((sent) => /[اأإآ]حمد|(?<![\p{L}])علي(?![\p{L}])/u.test(normalizeArabic(sent)));

  it("no request body or query ever contains the child's name — typed, spoken or chosen", async () => {
    // Consent + speech: the child SAYS their name in answers; also types it.
    const said = ['أنا أَحمد'];
    const listen = vi.fn(async () => said.shift() ?? null);
    const t = setup({ consent: true, speechInput: { listen }, childName: NAME });
    void t.lesson.start();
    await at(t.lesson, 'lesson_intro', 'continue');
    t.lesson.answer('اسمي أحمد علي ويناديني بابا علي');
    await at(t.lesson, 'tafsir', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'fadl', 'continue');
    t.lesson.answer('وأحمد يحب السورة');
    await at(t.lesson, 'tajweed', 'continue');

    expect(t.server.calls.length).toBeGreaterThan(5);
    expect(leaks(t.server)).toEqual([]);
    for (const c of t.server.calls) {
      expect(Object.keys(c.body ?? {})).not.toContain('child_name');
      expect(Object.keys(c.body ?? {})).not.toContain('name');
    }
    // what the child said still arrives — with «بطل» in place of the name
    expect(t.server.messages()).toEqual(
      expect.arrayContaining(['أنا بطل', 'بطل', 'اسمي بطل ويناديني بابا بطل', 'وبطل يحب السورة']),
    );
  });

  it('the name stage is never shown: asked again → «بطل» again; a third time → the built-in lesson', async () => {
    const { QURAN_STAGES } = await import('./testing/fakeServer');
    const server = new FakeAgentServer(QURAN_STAGES.map((s) => (s.id === 'name' ? { ...s, turns: 3 } : s)));
    const seen: (string | null)[] = [];
    const t = setup({ server });
    t.lesson.state.subscribe((s) => seen.push(s.stages[s.stageIndex]?.id === 'name' ? s.expects : null));
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await until(t.lesson, (s) => s.phase === 'fallback');
    expect(t.server.messages()).toEqual(['تمام', 'بطل', 'بطل']);
    expect(seen.filter((e) => e !== null)).toEqual([]); // never waited for the child there
  });
});

describe('ServerLesson — voice first', () => {
  it('warms the voice at the start; a voiced line is not marked for text', async () => {
    const warm = vi.fn();
    const t = setup({
      voice: {
        warm,
        speak: async (text, onPiece) => {
          for (const piece of text.split('! ')) onPiece?.(piece, true);
        },
        stop: () => {},
      },
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    expect(warm).toHaveBeenCalledOnce();
    expect(t.lesson.state.value.voiceMissing).toBe(false);
  });

  it('no voice at all → the piece being said is marked for text (never silent and blank)', async () => {
    const seen: [string, boolean][] = [];
    const t = setup({
      voice: {
        speak: async (text, onPiece) => {
          for (const piece of text.split('! ')) onPiece?.(piece, false);
        },
        stop: () => {},
      },
    });
    t.lesson.state.subscribe((s) => seen.push([s.caption, s.voiceMissing]));
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    expect(seen).toContainEqual(['السلام عليكم', true]);
    expect(t.lesson.state.value).toMatchObject({
      caption: 'أنا المعلم عبدالله. كيف حالك يا بطل؟',
      voiceMissing: true,
    });
  });

  it('the first line refused before a tap → the play button, then the line plays', async () => {
    let refused = true;
    const spoken: string[] = [];
    const t = setup({
      voice: {
        speak: async (text) => {
          if (refused) {
            refused = false;
            throw new PlaybackBlocked();
          }
          spoken.push(text);
        },
        stop: () => {},
      },
    });
    void t.lesson.start();
    await until(t.lesson, (s) => s.playbackBlocked && s.speaking);
    expect(t.lesson.state.value.expects).toBeNull();
    t.lesson.playTapped();
    await at(t.lesson, 'greet', 'text');
    expect(spoken[0]).toMatch(/^السلام عليكم/);
    expect(t.lesson.state.value.playbackBlocked).toBe(false);
  });

  it('recitation shows the whole verified surah with the current ayah', async () => {
    const t = setup({ presence: { waitForSpeech: () => new Promise(() => {}) } });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await at(t.lesson, 'lesson_intro', 'continue');
    await at(t.lesson, 'lesson_intro', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'tafsir', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'fadl', 'continue');
    t.lesson.continueTapped();
    await until(t.lesson, (s) => s.expects === 'repeat');
    expect(t.lesson.state.value.ayat.map((a) => a.text)).toEqual(
      [1, 2, 3, 4].map((a) => `VERIFIED-112:${a}`),
    );
    expect(t.lesson.state.value.currentAyah).toBe(1);
  });

  it('normalizeArabic ignores diacritics, hamza forms and punctuation', () => {
    expect(normalizeArabic('الإِخْلاص!')).toBe(normalizeArabic('الاخلاص'));
    expect(normalizeArabic('  سورةُ  الناسِ؟ ')).toBe('سوره الناس');
  });
});

describe('ServerLesson — cheers (the teacher looks happy)', () => {
  it('each accepted repeat and the end of a part cheer', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    expect(t.lesson.state.value.cheer).toBe(0);
    t.lesson.answer('تمام');
    for (const stage of ['lesson_intro', 'tafsir', 'fadl']) {
      await at(t.lesson, stage, 'continue');
      t.lesson.continueTapped();
    }
    await at(t.lesson, 'tajweed', 'continue');
    expect(t.lesson.state.value.cheer).toBe(4); // the 4 ayat repeated
    for (const stage of ['tajweed', 'plan']) {
      await at(t.lesson, stage, 'continue');
      t.lesson.continueTapped();
    }
    await until(t.lesson, (s) => s.phase === 'segmentDone');
    expect(t.lesson.state.value.cheer).toBe(5);
  });
});
