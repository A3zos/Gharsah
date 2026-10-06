import { describe, expect, it, vi } from 'vitest';

import { PlaybackBlocked } from '../ports';
import { AgentApi } from './api';
import type { ProgressUpdate } from './progressMap';
import { ENCOURAGE_LINE } from '../voice/recitationVerifier';
import { DEFAULT_QURAN_STAGES, PILOT_DAYS } from '../../content/pilot';
import { RECITATION_WAIT_FALLBACK } from './waitLine';
import { resetWarmDebounce } from './api';
import {
  FILLER,
  FILLER_LONG,
  MIC_ASK,
  TO_HADITH,
  HADITH_PLACEHOLDER,
  MOVE_ON_UNREPEATED,
  NUDGE_REPEAT,
  REPEATS_START,
  REPEATS_START_REPLY,
  SKIP_AYAH,
  WHOLE_SURAH_TURN,
  normalizeArabic,
  RATE_LIMIT_BACKOFF_MS,
  ServerLesson,
  CONTINUE_WORD,
  shownHadith,
  todayHadithAnswer,
  HADITH_LATER,
  type PresenceListener,
  type LessonPlan,
  type ServerLessonDeps,
  type ServerLessonState,
  type UrlPlayer,
  type UtteranceRecorder,
} from './serverLesson';
import { EVERYAYAH, FakeAgentServer, QURAN_STAGES, type StageSpec } from './testing/fakeServer';

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
    // repeats: the child repeats at once; answers: quiet (the test answers itself)
    presence: {
      waitForSpeech: (_signal, o) =>
        o?.purpose === 'answer' ? new Promise<never>(() => {}) : Promise.resolve('spoke' as const),
    },
    sink: { record: async (u) => void updates.push(u) },
    plan: PLAN,
    deviceId: 'dev-1',
    gender: 'boy',
    verifiedAyah: (s, a) => (s === 112 && a >= 1 && a <= 4 ? `VERIFIED-${s}:${a}` : null),
    ayahCount: () => 4,
    surahName: () => 'الإخلاص',
    blobToBase64: async () => 'QUJD',
    sleep: async (ms) => void sleeps.push(ms),
    beat: async () => {},
    warmingAfterMs: 10_000,
    ...o,
  });
  return { server, lesson, spoken, played, updates, sleeps };
}

const until = (l: ServerLesson, f: (s: ServerLessonState) => boolean) =>
  vi.waitFor(
    () => {
      if (!f(l.state.value))
        throw new Error(`not yet: ${JSON.stringify({ ...l.state.value, stages: undefined })}`);
    },
    { timeout: 5000 }, // whole lessons run here; a loaded machine needs more than the 1 s default
  );
const at = (l: ServerLesson, stage: string, expects: ServerLessonState['expects']) =>
  until(l, (s) => s.stages[s.stageIndex]?.id === stage && s.expects === expects && !s.busy);

/** The furthest update per lesson. */
const last = (updates: ProgressUpdate[], lessonId: string) =>
  updates.filter((u) => u.lessonId === lessonId).at(-1);

describe('ServerLesson — mocked end-to-end', () => {
  it('a full quran lesson, then the hadith lesson', async () => {
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

    // done (expects none) → the next part starts by itself (a voice call: no button)
    await until(lesson, (s) => s.segment === 'hadith');
    // today's row: the surah part done → «hadith», resume point = the built-in hadith step
    expect(lesson.state.value.quranDone).toBe(true);
    expect(t.updates).toContainEqual({
      lessonId: 'pilot-day-1',
      stage: 'hadith',
      stepIndex: PLAN.hadithStepIndex,
      doneRefs: ['112:1', '112:2', '112:3', '112:4'],
    });
    expect(new Set(t.updates.map((u) => u.lessonId))).toEqual(new Set(['pilot-day-1']));
    // stages only ever move forward
    const ranks = t.updates.map((u) => u.stage);
    expect(ranks).toEqual([...ranks].sort((a, b) => order(a) - order(b)));

    // ── hadith ── its greeting and «which hadith?» were answered in the background (the
    // child was already greeted): straight to the hadith's text, nothing of them voiced
    await at(lesson, 'text', 'continue');
    expect(t.spoken).toContain(TO_HADITH.boy);
    expect(t.spoken).not.toContain('أهلًا من جديد!');
    expect(t.spoken).not.toContain('حديث اليوم عن برّ الوالدين.');
    expect(lesson.state.value.hadith).toEqual({ title: 'برّ الوالدين', source: 'متفق عليه' });
    // 2026-10-05: the server's hadith text is shown like the ayat (SERVER_HADITH_TEXT_APPROVED)
    expect(lesson.state.value.hadithText).toBe('SERVER-HADITH-TEXT');
    expect(HADITH_PLACEHOLDER).toMatch(/يُعتمد لاحقًا/);
    lesson.continueTapped();
    await at(lesson, 'words', 'continue');
    expect(lesson.state.value.words).toEqual([{ word: 'البر', meaning: 'الإحسان' }]); // the word table is shown
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

    await until(lesson, (s) => s.phase === 'finished');
    expect(last(t.updates, 'pilot-day-1')).toMatchObject({ stage: 'done', stepIndex: PLAN.lastStepIndex });
    expect(new Set(t.updates.map((u) => u.lessonId))).toEqual(new Set(['pilot-day-1']));

    // privacy: two /agent/start calls, neither with a name; only the random device id
    const starts = server.calls.filter((c) => c.path === '/agent/start');
    expect(starts.map((c) => c.body)).toEqual([
      { mode: 'quran', gender: 'boy', device_id: 'dev-1', lang: 'ar' },
      { mode: 'hadith', gender: 'boy', device_id: 'dev-1', lang: 'ar' },
    ]);
    // the daily lesson never asks for the recall (taseem / htaseem) — that is the review session only
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

  it("«which hadith?» asks for today's; the server teaching another → a closing line, the call ends (never the built-in hadith card)", async () => {
    const t = setup({ plan: { ...PLAN, hadithTopic: 'الكذب' } });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    for (const stage of ['lesson_intro', 'tafsir', 'fadl', 'tajweed', 'plan']) {
      await at(t.lesson, stage, 'continue');
      t.lesson.continueTapped();
    }
    await until(t.lesson, (s) => s.segment === 'hadith');
    // …but the fake server still teaches برّ الوالدين → graceful end
    await until(t.lesson, (s) => s.phase === 'ended');
    // today's hadith was asked for by name (not the first option)
    expect(t.server.messages()).toContain('الكذب');
    expect(t.spoken.at(-1)).toBe(HADITH_LATER);
    expect(t.lesson.state.value.quranDone).toBe(true);
  });

  it('day 1 starts at the surah — a new child, or no surah finished earlier today', async () => {
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    expect(t.server.calls.find((c) => c.path === '/agent/start')?.body?.mode).toBe('quran');
    expect(t.lesson.state.value.segment).toBe('quran');
    expect(t.lesson.state.value.hadith).toBeNull();
  });

  it("today's surah finished earlier today → the lesson resumes at the hadith", async () => {
    const t = setup({ startAt: 'hadith' });
    void t.lesson.start();
    await until(t.lesson, (s) => s.segment === 'hadith' && s.phase === 'live');
    const starts = t.server.calls.filter((c) => c.path === '/agent/start').map((c) => c.body?.mode);
    expect(starts).toEqual(['hadith']);
    expect(t.lesson.state.value.quranDone).toBe(true);
  });

  it("todayHadithAnswer: today's option when offered, else its name", () => {
    expect(todayHadithAnswer(['بر الوالدين', 'الكذب', 'لا تغضب'], 'الغضب')).toBe('لا تغضب');
    expect(todayHadithAnswer(['بر الوالدين', 'الكذب', 'لا تغضب'], 'برّ الوالدين')).toBe('بر الوالدين');
    // the server offers only the hadiths this device hasn't finished
    expect(todayHadithAnswer(['الكذب', 'لا تغضب'], 'برّ الوالدين')).toBe('برّ الوالدين');
  });
});

const order = (s: string) => ['listen_full', 'ayah_repeat', 'full_twice', 'hadith', 'done'].indexOf(s);

const FOLLOWUP_STAGES: StageSpec[] = [
  { id: 'greet', label: 'الترحيب', say: 'أهلًا من جديد!', expects: 'text', quick: ['تمام'] },
  {
    id: 'intro',
    label: 'المقدمة',
    say: 'ما هو المشروع الذي طبّقته من حديث الكذب؟',
    expects: 'text',
    quick: ['لم أطبّق مشروعًا بعد', 'تخطّي'],
    extra: { followup: true },
  },
  {
    id: 'intro',
    label: 'المقدمة',
    say: 'ما شاء الله، سجّلته في مشاريعك المنجزة. أي حديث تحب؟',
    expects: 'text',
    quick: ['برّ الوالدين', 'الكذب'],
    extra: { followup_ack: 'ما شاء الله، سجّلته في مشاريعك المنجزة.' },
  },
  {
    id: 'text',
    label: 'النص',
    say: 'اسمع الحديث.',
    expects: 'continue',
    actions: () => [
      { type: 'show_ayat', ayat: ['SERVER-HADITH-TEXT'], hadith_title: 'برّ الوالدين', source: 'x' },
    ],
  },
  { id: 'done', label: 'النهاية', say: 'بارك الله فيك.', expects: 'none' },
];

describe('ServerLesson — the previous hadith’s project follow-up (2026-10-06)', () => {
  it('the question reaches the child, their own answer is sent, the reaction is said before today’s hadith', async () => {
    const server = new FakeAgentServer(QURAN_STAGES, FOLLOWUP_STAGES);
    const t = setup({ server, startAt: 'hadith' });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    // the follow-up question is NOT answered for the child
    await at(t.lesson, 'intro', 'text');
    expect(server.messages()).toEqual(['تمام']);
    expect(t.spoken.some((x) => x.includes('ما هو المشروع الذي طبّقته'))).toBe(true);
    t.lesson.answer('ساعدت أمي في ترتيب البيت');
    await at(t.lesson, 'text', 'continue');
    // the child's own words went to the server; only then was today's hadith chosen for them
    expect(server.messages()).toEqual(['تمام', 'ساعدت أمي في ترتيب البيت', 'برّ الوالدين']);
    // the reaction is said in front of the hadith — and «which hadith?» is never asked
    expect(t.spoken.some((x) => x.startsWith('ما شاء الله، سجّلته في مشاريعك المنجزة.'))).toBe(true);
    expect(t.spoken.some((x) => x.includes('أي حديث تحب'))).toBe(false);
  });

  it('silence on the question is a skip, not «I did not apply anything»', async () => {
    const server = new FakeAgentServer(QURAN_STAGES, FOLLOWUP_STAGES);
    const t = setup({ server, startAt: 'hadith', presence: { waitForSpeech: async () => 'silent' } });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    expect(server.messages()).toContain('تخطّي');
    expect(server.messages()).not.toContain('لم أطبّق مشروعًا بعد');
  });
});

const MEMORIZE_RETRY_STAGES: StageSpec[] = [
  { id: 'greet', label: 'الترحيب', say: 'أهلًا!', expects: 'text', quick: ['تمام'] },
  { id: 'intro', label: 'المقدمة', say: 'أي حديث تحب؟', expects: 'text', quick: ['برّ الوالدين', 'الكذب'] },
  {
    id: 'memorize',
    label: 'الحفظ',
    turns: 2,
    say: 'نسيت كلمة: أُمُّكَ. استمع إلى الحديث، ثم ردّده بصوتك بعدي: SERVER-HADITH-TEXT',
    expects: 'repeat',
    quick: ['تخطّي'],
  },
  { id: 'done', label: 'النهاية', say: 'بارك الله فيك.', expects: 'none' },
];

describe('ServerLesson — the hadith is said again after a judging line (2026-10-06)', () => {
  it('the encouragement is followed by the «listen, then repeat» part with the hadith — never the encouragement alone', async () => {
    const server = new FakeAgentServer(QURAN_STAGES, MEMORIZE_RETRY_STAGES);
    const presence: PresenceListener = {
      waitForSpeech: async (_s, o) => {
        if (o?.purpose === 'answer') return new Promise<never>(() => {});
        o?.onVoiced?.(1500);
        return 'spoke';
      },
    };
    const t = setup({ server, startAt: 'hadith', presence });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    await at(t.lesson, 'intro', 'text');
    t.lesson.answer('برّ الوالدين');
    await until(t.lesson, (s) => s.phase === 'finished');
    // the unverifiable «نسيت كلمة» is never claimed...
    expect(t.spoken.some((x) => x.includes('نسيت'))).toBe(false);
    // ...but the child still hears the encouragement AND the hadith to repeat
    expect(
      t.spoken.some(
        (x) => x.startsWith(ENCOURAGE_LINE) && x.includes('استمع') && x.includes('SERVER-HADITH-TEXT'),
      ),
    ).toBe(true);
  });
});

describe('ServerLesson — hearing the child', () => {
  it('a recitation goes to score-recitation and its transcription is the answer', async () => {
    const recorder: UtteranceRecorder = { record: async () => new Blob(['x']) };
    const t = setup({ recorder });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    const scores = t.server.calls.filter((c) => c.path === '/agent/score-recitation');
    const recitations = scores.filter((c) => (c.body as { forScore?: boolean }).forScore === true);
    expect(recitations).toHaveLength(5); // the 4 ayat + the hadith
    expect(recitations[0]!.body).toMatchObject({ audio_base64: 'QUJD' });
    // no speech recognition here (as in Firefox / Safari): free answers go to the server's
    // transcription in the session language
    const free = scores.filter((c) => (c.body as { forScore?: boolean }).forScore === false);
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((c) => (c.body as { lang?: string }).lang === 'ar')).toBe(true);
  });

  it('scoring unavailable: the reference line is sent instead', async () => {
    const server = new FakeAgentServer();
    server.scoreAvailable = false;
    const t = setup({ server, recorder: { record: async () => new Blob(['x']) } });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    expect(t.server.messages().filter((m) => m.startsWith('REF-AYAH'))).toEqual([
      'REF-AYAH-1',
      'REF-AYAH-2',
      'REF-AYAH-3',
      'REF-AYAH-4',
    ]);
  });

  it('the mic is asked for once at the start, with a friendly line first', async () => {
    const spoken: string[] = [];
    const requestAccess = vi.fn(async () => true);
    const t = setup({
      presence: { waitForSpeech: async () => 'spoke', requestAccess, permission: async () => 'prompt' },
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    void t.lesson.start();
    await until(t.lesson, (st) => st.phase === 'finished');
    expect(spoken[0]).toBe(MIC_ASK.boy);
    expect(spoken[1]).toMatch(/^السلام عليكم/);
    expect(requestAccess).toHaveBeenCalledTimes(1);
  });

  it('the mic already allowed → no ask, no line', async () => {
    const spoken: string[] = [];
    const requestAccess = vi.fn(async () => true);
    const t = setup({
      presence: { waitForSpeech: async () => 'spoke', requestAccess, permission: async () => 'granted' },
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    void t.lesson.start();
    await until(t.lesson, (st) => st.phase === 'finished');
    expect(spoken).not.toContain(MIC_ASK.boy);
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it('the mic refused at the start → presence only: no recorder, no recognition, no review; the lesson goes on', async () => {
    const record = vi.fn(async () => new Blob(['x']));
    const listen = vi.fn(async () => 'تمام');
    const server = new FakeAgentServer();
    const t = setup({
      server,
      recorder: { record },
      speechInput: { listen },
      presence: {
        waitForSpeech: async () => 'denied',
        requestAccess: async () => false,
        permission: async () => 'prompt',
      },
    });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    expect(t.lesson.state.value).toMatchObject({ listenOnly: true, micDenied: true });
    expect(record).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    expect(server.calls.some((c) => c.path.includes('taseem'))).toBe(false);
  });

  it('mic refused → the «سماح» prompt; allowed → the child is heard again', async () => {
    let denied = true;
    const presence: PresenceListener = {
      waitForSpeech: async () => (denied ? 'denied' : 'spoke'),
      requestAccess: async () => {
        denied = false;
        return true;
      },
      permission: async () => 'granted', // allowed at the start, blocked later
    };
    const t = setup({ presence });
    void t.lesson.start();
    await until(t.lesson, (s) => s.micPrompt);
    t.lesson.allowTapped();
    await until(t.lesson, (s) => s.phase === 'finished');
    expect(t.lesson.state.value.listenOnly).toBe(false);
    expect(t.server.messages()).toEqual(expect.arrayContaining(['الحمد لله بخير', 'REF-AYAH-1']));
  });

  it('mic still blocked after «سماح» → listen-only: each line continues by itself', async () => {
    const presence: PresenceListener = {
      waitForSpeech: async () => 'denied',
      requestAccess: async () => false,
      permission: async () => 'granted', // allowed at the start, blocked later
    };
    const t = setup({ presence });
    void t.lesson.start();
    await until(t.lesson, (s) => s.micPrompt);
    t.lesson.allowTapped();
    await until(t.lesson, (s) => s.phase === 'finished');
    expect(t.lesson.state.value).toMatchObject({ listenOnly: true, micPrompt: false });
    // answers go on by themselves; a repeat that can't be heard is never counted — skipped
    expect(t.server.messages()).toEqual(expect.arrayContaining(['الحمد لله بخير', SKIP_AYAH]));
    expect(t.server.messages()).not.toContain('REF-AYAH-1');
  });

  it('silence: one gentle nudge per turn, then the lesson continues by itself (never stuck)', async () => {
    const presence: PresenceListener = { waitForSpeech: async () => 'silent' };
    const spoken: string[] = [];
    const t = setup({ presence, voice: { speak: async (x) => void spoken.push(x), stop: () => {} } });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    // greet: silence → «أنا أسمعك يا بطل، قلها بصوتك» → silence → the first quick reply
    const greetAt = spoken.findIndex((x) => x.startsWith('السلام عليكم'));
    expect(spoken[greetAt + 1]).toBe('أنا أسمعك يا بطل، قلها بصوتك');
    expect(spoken[greetAt + 2]).not.toBe('أنا أسمعك يا بطل، قلها بصوتك'); // one nudge, not two
    expect(t.server.messages()[0]).toBe('الحمد لله بخير');
    expect(spoken).toContain('أنا أسمعك… ردّدها بصوتك'); // the repeat nudge
    // silence is never praised or sent as a repeat: the neutral line, then «تخطّي الآية»
    expect(spoken).toContain(MOVE_ON_UNREPEATED);
    expect(t.server.messages().filter((m) => m.startsWith('REF-AYAH'))).toEqual([]);
  });

  it('a browser that can neither record nor recognise: speech of ≥0.6 s → the first quick reply; nothing sent', async () => {
    const seen: (number | undefined)[] = [];
    const presence: PresenceListener = {
      waitForSpeech: async (_s, o) => {
        seen.push(o?.minMs);
        return 'spoke';
      },
    };
    const t = setup({ presence });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    expect(t.server.messages().slice(0, 3)).toEqual(['الحمد لله بخير', 'بطل', 'الإخلاص']);
    expect(seen[0]).toBe(600);
    expect(t.lesson.state.value.heard).toBeGreaterThan(0); // «I heard you» on the mic
    expect(t.server.calls.some((c) => c.path === '/agent/score-recitation')).toBe(false);
  });

  it('nothing recognised: a quiz gets the first option, marked «لم يُقيَّم» for the parent', async () => {
    const t = setup({ presence: { waitForSpeech: async () => 'spoke' } });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    expect(t.server.messages()).toContain('الأم'); // the quiz's first option
    expect(t.updates.some((u) => u.quizUnscored === true)).toBe(true);
  });

  it('speech recognition for every child (no per-child switch)', async () => {
    const listen = vi.fn(async () => 'بخير والحمد لله');
    const t = setup({ speechInput: { listen } });
    void t.lesson.start();
    await until(t.lesson, (st) => st.phase === 'finished');
    expect(listen).toHaveBeenCalled();
    expect(t.server.messages()[0]).toBe('بخير والحمد لله');
  });

  it('like a call: after the line, the mic listens by itself and the words are sent', async () => {
    const said = ['بخير والحمد لله'];
    const listen = vi.fn(async () => said.shift() ?? null);
    const t = setup({ speechInput: { listen } });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');
    // greet (the child's words) → name (auto) → surah (auto)
    expect(t.server.messages().slice(0, 3)).toEqual(['بخير والحمد لله', 'بطل', 'الإخلاص']);
  });

  it('a spoken choice goes as the closest option', async () => {
    const { QURAN_STAGES } = await import('./testing/fakeServer');
    // a multiple-choice greeting (the surah question is answered automatically now)
    const server = new FakeAgentServer(
      QURAN_STAGES.map((st) =>
        st.id === 'greet' ? { ...st, expects: 'choice' as const, quick: ['بخير', 'تعبان'] } : st,
      ),
    );
    // «أنا بخير الحمد لله» → the «بخير» option
    const said = ['أنا بخير الحمد لله'];
    const listen = vi.fn(async () => said.shift() ?? new Promise<never>(() => {}));
    const t = setup({ server, speechInput: { listen } });
    void t.lesson.start();
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.server.messages()).toEqual(['بخير', 'بطل', 'الإخلاص']);
    expect(t.updates.some((u) => u.quizUnscored)).toBe(false);
  });

  it('recognition unavailable → on-device presence for the rest of the lesson', async () => {
    const listen = vi.fn(async () => {
      throw new Error('speech recognition unavailable');
    });
    const presence: PresenceListener = { waitForSpeech: async () => 'spoke' };
    const t = setup({ speechInput: { listen }, presence });
    void t.lesson.start();
    await until(t.lesson, (s) => s.stageIndex >= 3);
    expect(t.server.messages()[0]).toBe('الحمد لله بخير');
    expect(listen).toHaveBeenCalledTimes(1);
  });

  it('a ready taseem does NOT run in the daily lesson — recall is for the review session only (2026-10-06)', async () => {
    const server = new FakeAgentServer();
    server.readyTaseem = [{ item_key: '112:0', ready: true, surah_no: 112, chunk: 0 }];
    const t = setup({ server });
    void t.lesson.start();
    await until(t.lesson, (s) => s.segment === 'quran');
    expect(server.calls.some((c) => c.path.includes('taseem'))).toBe(false);
    expect(
      server.calls.some((c) => c.path === '/agent/start' && (c.body as { mode?: string }).mode === 'quran'),
    ).toBe(true);
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

  it('the session language goes to every /agent/start, the restart included', async () => {
    const t = setup({ lang: 'en' });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.server.failures.push(['/agent/message', 404]);
    t.lesson.answer('ok');
    await until(t.lesson, (s) => s.notice === 'restarted');
    const starts = t.server.calls.filter((c) => c.path === '/agent/start');
    expect(starts).toHaveLength(2);
    expect(starts.map((c) => c.body?.lang)).toEqual(['en', 'en']);
  });

  it('en session: a «continue» turn sends a plain continue word (the server ignores its own translated button)', async () => {
    const en = setup({ lang: 'en' });
    void en.lesson.start();
    await at(en.lesson, 'greet', 'text');
    en.lesson.answer('ok');
    await at(en.lesson, 'lesson_intro', 'continue');
    en.lesson.continueTapped();
    await until(en.lesson, () => en.server.messages().length >= 3);
    expect(en.server.messages()).toContain(CONTINUE_WORD.en);

    // Arabic: exactly as before — the server's own first quick reply
    const ar = setup();
    void ar.lesson.start();
    await at(ar.lesson, 'greet', 'text');
    ar.lesson.answer('تمام');
    await at(ar.lesson, 'lesson_intro', 'continue');
    ar.lesson.continueTapped();
    await until(ar.lesson, () => ar.server.messages().length >= 3);
    expect(ar.server.messages()).not.toContain(CONTINUE_WORD.en);
  });

  it("en/id session: the server's own hadith title/source are never shown — today's topic instead", () => {
    // the server's translations are its own (not QuranEnc / HadeethEnc)
    expect(shownHadith('en', "Don't get angry.", 'Al-Bukhari', 'الغضب')).toEqual({
      title: 'الغضب',
      source: null,
    });
    expect(shownHadith('id', 'Jangan Marah', 'Al-Bukhari', 'الغضب')).toEqual({
      title: 'الغضب',
      source: null,
    });
    expect(shownHadith('ar', 'لا تغضب', 'البخاري', 'الغضب')).toEqual({ title: 'لا تغضب', source: 'البخاري' });
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
    expect(t.server.calls.find((c) => c.path === '/agent/start')!.body).toMatchObject({ gender: 'girl' });
  });
});

describe("ServerLesson — the child's first name: /agent/start only", () => {
  const NAME = 'أحمد علي';
  /** Any spelling of either name part (diacritics, hamza forms) in what was sent. */
  const leaks = (server: FakeAgentServer) =>
    server.calls
      .map((c) => `${c.path}?${new URLSearchParams(c.query).toString()} ${JSON.stringify(c.body)}`)
      .filter((sent) => /[اأإآ]حمد|(?<![\p{L}])علي(?![\p{L}])/u.test(normalizeArabic(sent)));

  it('child_name = the first name in every /agent/start — and nowhere else (typed, spoken or chosen)', async () => {
    // the child SAYS their name in answers, in many spellings
    const said = ['أنا أَحمد', 'اسمي أحمد علي ويناديني بابا علي', 'وأحمد يحب السورة'];
    const listen = vi.fn(async () => said.shift() ?? null);
    const t = setup({ speechInput: { listen }, childName: NAME, childFirstName: 'أحمد' });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'finished');

    const starts = t.server.calls.filter((c) => c.path === '/agent/start');
    expect(starts.length).toBeGreaterThanOrEqual(2); // the surah and the hadith sessions
    for (const c of starts) expect(c.body).toMatchObject({ child_name: 'أحمد', gender: 'boy' });
    // nowhere else: every other request is scrubbed
    expect(
      leaks({ calls: t.server.calls.filter((c) => c.path !== '/agent/start') } as FakeAgentServer),
    ).toEqual([]);
    for (const c of t.server.calls.filter((c) => c.path !== '/agent/start')) {
      expect(Object.keys(c.body ?? {})).not.toContain('child_name');
      expect(Object.keys(c.body ?? {})).not.toContain('name');
    }
    // what the child said still arrives — with «بطل» in place of the name
    expect(t.server.messages()).toEqual(
      expect.arrayContaining(['أنا بطل', 'بطل', 'اسمي بطل ويناديني بابا بطل', 'وبطل يحب السورة']),
    );
  });

  it('no name in the profile → no child_name at all (the server picks its nickname)', async () => {
    const t = setup({ childFirstName: '' });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    const start = t.server.calls.find((c) => c.path === '/agent/start')!;
    expect(start.body).not.toHaveProperty('child_name');
  });

  it('the recitation model is woken right after /agent/start (debounced in the API)', async () => {
    resetWarmDebounce();
    const t = setup();
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    const paths = t.server.calls.map((c) => c.path);
    expect(paths.indexOf('/agent/warm')).toBeGreaterThan(paths.indexOf('/agent/start'));
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
    await until(t.lesson, (s) => s.segment === 'hadith');
    expect(t.lesson.state.value.cheer).toBe(5);
  });
});

describe('ServerLesson — voice first, no early browser voice', () => {
  it('waits for the server voice before starting — nothing asked or said meanwhile', async () => {
    let release = (_ok: boolean) => {};
    const spoken: string[] = [];
    const t = setup({
      voice: {
        ready: () => new Promise<boolean>((r) => (release = r)),
        speak: async (text) => void spoken.push(text),
        stop: () => {},
      },
      warmingAfterMs: 1,
    });
    void t.lesson.start();
    await until(t.lesson, (s) => s.phase === 'warming'); // «المعلم يتجهز…»
    expect(t.server.calls.filter((c) => c.path === '/agent/start')).toHaveLength(0);
    expect(spoken).toEqual([]);
    release(true);
    await at(t.lesson, 'greet', 'text');
    expect(spoken[0]).toMatch(/^السلام عليكم/);
  });

  it('the surah check ignores the server default (1) before «which surah?», and logs a real mismatch', async () => {
    const ok = setup(); // the fake server sends surah_no 1 on greet/surah, like the real one
    void ok.lesson.start();
    await at(ok.lesson, 'greet', 'text');
    ok.lesson.answer('تمام');
    await at(ok.lesson, 'lesson_intro', 'continue');
    expect(ok.lesson.state.value.phase).toBe('live');

    const bad = setup({ plan: { ...PLAN, lessonId: 'pilot-day-2', surahNo: 114, surahName: 'الناس' } });
    void bad.lesson.start();
    await at(bad.lesson, 'greet', 'text');
    bad.lesson.answer('تمام');
    await until(bad.lesson, (s) => s.phase === 'fallback');
    expect(bad.lesson.state.value.fallbackReason).toMatch(/surah 112 ≠ today's 114/);
  });
});

// ── recitation: ayah order, silence, transitions, judgments (real-test fixes) ──

/** The recitation stage as the live server sends it: play_ayah N + show_ayat current N (1-based). */
const REAL_RECITATION: StageSpec = {
  id: 'recitation',
  label: 'التلاوة',
  say: 'استمع للآية ثم ردّدها.',
  expects: 'repeat',
  turns: 4,
  actions: (n) => [
    { type: 'play_ayah', ayah: n + 1, text: `REF-AYAH-${n + 1}`, url: EVERYAYAH(n + 1) },
    { type: 'show_ayat', ayat: ['S1', 'S2', 'S3', 'S4'], first: 1, current: n + 1, surah_name: 'الإخلاص' },
  ],
};
const withStage = (id: string, stage: StageSpec) => QURAN_STAGES.map((s) => (s.id === id ? stage : s));

describe('ServerLesson — recitation', () => {
  const toRepeats = async (t: Setup) => {
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('تمام');
    for (const stage of ['lesson_intro', 'tafsir', 'fadl']) {
      await at(t.lesson, stage, 'continue');
      t.lesson.continueTapped();
    }
  };

  it('Al-Ikhlas: the repeats go 1 → 2 → 3 → 4; highlighted = played = asked', async () => {
    const asked: { highlighted: number | null; played: string | undefined }[] = [];
    let t: Setup | null = null;
    const presence: PresenceListener = {
      waitForSpeech: async (_s, o) => {
        if (o?.purpose === 'answer') return new Promise<never>(() => {});
        asked.push({ highlighted: t!.lesson.state.value.currentAyah, played: t!.played.at(-1) });
        o?.onVoiced?.(1500);
        return 'spoke';
      },
    };
    t = setup({ server: new FakeAgentServer(withStage('recitation', REAL_RECITATION)), presence });
    await toRepeats(t);
    await at(t.lesson, 'tajweed', 'continue');
    expect(asked.map((a) => a.highlighted)).toEqual([1, 2, 3, 4]);
    expect(asked.map((a) => a.played)).toEqual([1, 2, 3, 4].map(EVERYAYAH));
    expect(t.server.messages().slice(-4)).toEqual(['REF-AYAH-1', 'REF-AYAH-2', 'REF-AYAH-3', 'REF-AYAH-4']);
  });

  it('silent on a repeat: nudge + the ayah again; silent again: neutral line, the ayah, «تخطّي الآية» — no praise', async () => {
    const spoken: string[] = [];
    let calls = 0;
    const presence: PresenceListener = {
      waitForSpeech: async (_s, o) => {
        if (o?.purpose === 'answer') return new Promise<never>(() => {});
        calls++;
        // ayah 1: silent twice; the rest: the child repeats
        if (calls <= 2) return 'silent';
        o?.onVoiced?.(1200);
        return 'spoke';
      },
    };
    const t = setup({
      server: new FakeAgentServer(withStage('recitation', REAL_RECITATION)),
      presence,
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    await toRepeats(t);
    await at(t.lesson, 'tajweed', 'continue');
    // ayah 1 plays: the first time, after the nudge, and after the neutral line (before ayah 2)
    const beforeAyah2 = t.played.slice(0, t.played.indexOf(EVERYAYAH(2)));
    expect(beforeAyah2.filter((u) => u === EVERYAYAH(1))).toHaveLength(3);
    const nudgeAt = spoken.indexOf(NUDGE_REPEAT.boy);
    const moveAt = spoken.indexOf(MOVE_ON_UNREPEATED);
    expect(nudgeAt).toBeGreaterThan(-1);
    expect(moveAt).toBeGreaterThan(nudgeAt);
    // the server never hears «repeated» for ayah 1 — its own skip reply instead
    expect(t.server.messages().slice(-4)).toEqual([SKIP_AYAH, 'REF-AYAH-2', 'REF-AYAH-3', 'REF-AYAH-4']);
    // ayah 1 is «لم يُردَّد» for the parent and is never counted as memorized
    const withMark = t.updates.filter((u) => u.notRepeatedRefs?.length);
    expect(withMark.at(-1)?.notRepeatedRefs).toEqual(['112:1']);
    expect(t.updates.flatMap((u) => u.doneRefs)).not.toContain('112:1');
  });

  it('too little speech (< 0.6 s) is not a repeat — treated like silence, never praised', async () => {
    const seen: (number | undefined)[] = [];
    const t = setup({
      server: new FakeAgentServer(withStage('recitation', REAL_RECITATION)),
      presence: {
        waitForSpeech: async (_s, o) => {
          if (o?.purpose === 'answer') return new Promise<never>(() => {});
          seen.push(o?.minMs);
          o?.onVoiced?.(300);
          return 'spoke';
        },
      },
    });
    await toRepeats(t);
    await at(t.lesson, 'tajweed', 'continue');
    expect(seen.every((m) => m === 600)).toBe(true);
    expect(t.server.messages().filter((m) => m.startsWith('REF-AYAH'))).toEqual([]);
    expect(t.server.messages().filter((m) => m === SKIP_AYAH)).toHaveLength(4);
  });

  it('after the reciter plays the whole surah, the teacher speaks before the mic opens', async () => {
    const events: string[] = [];
    const intro: StageSpec = {
      id: 'lesson_intro',
      label: 'المقدمة',
      say: 'استمع للسورة.',
      expects: 'continue',
      quick: ['أكمل الدرس'],
      extra: { surah_no: 112 },
      actions: () => [
        { type: 'show_ayat', ayat: ['S1', 'S2', 'S3', 'S4'], first: 1 },
        { type: 'play_all', urls: [1, 2, 3, 4].map(EVERYAYAH) },
      ],
    };
    const t = setup({
      server: new FakeAgentServer(withStage('lesson_intro', intro)),
      voice: { speak: async (x) => void events.push(`say:${x}`), stop: () => {} },
      player: { play: async (u) => void events.push(`play:${u}`), stop: () => {} },
      presence: {
        waitForSpeech: async (_s, o) => {
          events.push(`listen:${o?.purpose}`);
          return 'spoke';
        },
      },
    });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.server.messages()).toContain('أكمل الدرس'));
    const lastPlay = events.indexOf(`play:${EVERYAYAH(4)}`); // the end of the first (whole-surah) recitation
    // one short «ready?» — no second «let's start» (the server's own line announces the recitation)
    expect(events.slice(lastPlay + 1, lastPlay + 3)).toEqual([`say:${REPEATS_START.boy}`, 'listen:answer']);
    expect(events).not.toContain(`say:${REPEATS_START_REPLY}`);
    expect(t.server.messages()).toContain('أكمل الدرس');
  });

  it('the whole surah to recite: the teacher asks first, and the server gets its own surah text', async () => {
    const spoken: string[] = [];
    const whole: StageSpec = {
      id: 'recitation',
      label: 'التلاوة',
      say: 'سأسمعك السورة كاملة.',
      expects: 'repeat',
      actions: () => [
        { type: 'show_ayat', ayat: ['S1', 'S2', 'S3', 'S4'], first: 1 },
        { type: 'play_all', urls: [1, 2, 3, 4].map(EVERYAYAH) },
      ],
    };
    const t = setup({
      server: new FakeAgentServer(withStage('recitation', whole)),
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    await toRepeats(t);
    await at(t.lesson, 'tajweed', 'continue');
    expect(spoken).toContain(WHOLE_SURAH_TURN.boy);
    expect(t.server.messages()).toContain('S1 S2 S3 S4');
    expect(t.server.messages()).not.toContain('ردّدت');
  });

  it('a server line judging words we cannot verify → the approved encouragement, and the ayah plays', async () => {
    const spoken: string[] = [];
    const judging: StageSpec = { ...REAL_RECITATION, turns: 2, say: 'نسيت كلمة يا بطل! استمع مرة ثانية.' };
    const t = setup({
      server: new FakeAgentServer(withStage('recitation', judging)),
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    await toRepeats(t);
    await at(t.lesson, 'tajweed', 'continue');
    expect(spoken.some((x) => x.includes('نسيت'))).toBe(false);
    expect(spoken).toContain(ENCOURAGE_LINE);
    expect(t.played).toContain(EVERYAYAH(2));
  });

  it('the server scored the attempt low → its word feedback is spoken', async () => {
    const spoken: string[] = [];
    const judging: StageSpec = { ...REAL_RECITATION, turns: 2, say: 'نسيت كلمة يا بطل! استمع مرة ثانية.' };
    const server = new FakeAgentServer(withStage('recitation', judging));
    server.scoreValue = 0.6; // live: one wrong word → 60, that word marked
    const t = setup({
      server,
      recorder: { record: async () => new Blob(['x']) },
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    void t.lesson.start();
    await until(t.lesson, (st) => st.phase === 'finished');
    expect(spoken).toContain('نسيت كلمة يا بطل! استمع مرة ثانية.');
    // the child's real words went to the server (not the reference line)
    expect(t.server.messages()).toContain('قل هو الله أحد');
  });

  it('the server scored it well → a judging line is still replaced by the encouragement', async () => {
    const spoken: string[] = [];
    const judging: StageSpec = { ...REAL_RECITATION, turns: 2, say: 'نسيت كلمة يا بطل! استمع مرة ثانية.' };
    const server = new FakeAgentServer(withStage('recitation', judging));
    server.scoreValue = 0.9;
    const t = setup({
      server,
      recorder: { record: async () => new Blob(['x']) },
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    void t.lesson.start();
    await until(t.lesson, (st) => st.phase === 'finished');
    expect(spoken.some((x) => x.includes('نسيت'))).toBe(false);
    expect(spoken).toContain(ENCOURAGE_LINE);
  });

  it('the child answered «جاهز؟» in words → no fixed «let us start», the server answers them', async () => {
    const spoken: string[] = [];
    const said = ['تمام', 'ما فهمت'];
    const whole: StageSpec = {
      id: 'lesson_intro',
      label: 'المقدمة',
      say: 'سورة الإخلاص أربع آيات.',
      expects: 'continue',
      actions: () => [{ type: 'play_all', urls: [1, 2, 3, 4].map(EVERYAYAH) }],
    };
    const t = setup({
      server: new FakeAgentServer(withStage('lesson_intro', whole)),
      speechInput: { listen: async () => said.shift() ?? new Promise<never>(() => {}) },
      voice: { speak: async (x) => void spoken.push(x), stop: () => {} },
    });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.server.messages()).toContain('ما فهمت'));
    expect(spoken).toContain(REPEATS_START.boy);
    expect(spoken).not.toContain(REPEATS_START_REPLY);
  });

  it('no MediaRecorder → the recitation through the browser speech recognition (ar-SA), its text sent', async () => {
    const opts: { recitation?: boolean }[] = [];
    let t: Setup | null = null;
    const listen = vi.fn(async (_s: AbortSignal, o?: { recitation?: boolean }) => {
      opts.push({ ...o });
      return t!.lesson.state.value.expects === 'repeat' ? 'قل هو الله احد' : 'تمام';
    });
    t = setup({
      server: new FakeAgentServer(withStage('recitation', REAL_RECITATION)),
      speechInput: { listen },
    });
    void t.lesson.start();
    await vi.waitFor(() =>
      expect(t!.server.calls.filter((c) => c.path === '/agent/message').length).toBeGreaterThan(8),
    );
    expect(opts).toContainEqual({ recitation: true });
    expect(t.server.messages()).toContain('قل هو الله احد');
    expect(t.server.calls.some((c) => c.path === '/agent/score-recitation')).toBe(false);
  });

  it('with a recorder: recognition runs alongside — its text only when scoring is {available:false}', async () => {
    const run = async (available: boolean) => {
      const server = new FakeAgentServer(withStage('recitation', REAL_RECITATION));
      server.scoreAvailable = available;
      let t: Setup | null = null;
      t = setup({
        server,
        recorder: { record: async () => new Blob(['x']) },
        speechInput: {
          listen: async () => (t!.lesson.state.value.expects === 'repeat' ? 'نص المتصفح' : 'تمام'),
        },
      });
      void t.lesson.start();
      await vi.waitFor(() =>
        expect(server.calls.filter((c) => c.path === '/agent/score-recitation').length).toBeGreaterThan(1),
      );
      await vi.waitFor(() => expect(server.messages().length).toBeGreaterThan(5));
      t.lesson.dispose();
      return server.messages();
    };
    const scored = await run(true);
    expect(scored).toContain('قل هو الله أحد'); // the server's transcription
    expect(scored).not.toContain('نص المتصفح');
    const fallback = await run(false);
    expect(fallback).toContain('نص المتصفح'); // the browser's, the same recitation
  });
});

describe('ServerLesson — the recitation wait line', () => {
  /** score-recitation answered after `ms` (each RECITATION counted when it starts); everything else at once. */
  const slowScore =
    (server: FakeAgentServer, ms: number, started: { n: number }): typeof server.fetch =>
    async (url, init) => {
      if (new URL(url).pathname === '/agent/score-recitation') {
        if ((JSON.parse(String(init?.body)) as { forScore?: boolean }).forScore === true) started.n++;
        await new Promise((r) => setTimeout(r, ms));
      }
      return server.fetch(url, init);
    };
  const scoring = (o: { delay: number; lineMs?: number; againMs?: number; lang?: 'ar' | 'en' }) => {
    const server = new FakeAgentServer(withStage('recitation', REAL_RECITATION));
    const spoken: string[] = [];
    const stop = vi.fn();
    const started = { n: 0 };
    const t = setup({
      server,
      lang: o.lang ?? 'ar',
      api: new AgentApi('https://ai.test', slowScore(server, o.delay, started)),
      recorder: { record: async () => new Blob(['x']) },
      voice: { speak: async (x) => void spoken.push(x), stop },
      waits: {
        fillerMs: 60_000,
        timeoutMs: 60_000,
        recitationLineMs: o.lineMs ?? 20,
        recitationAgainMs: o.againMs ?? 60_000,
      },
    });
    /** score-recitation calls for a RECITATION (forScore: true) — free speech also uses the endpoint here. */
    const recitations = () =>
      server.calls.filter(
        (c) => c.path === '/agent/score-recitation' && (c.body as { forScore?: boolean }).forScore === true,
      );
    return { ...t, server, spoken, stop, recitations, started };
  };

  it('a slow score → the teacher says the wait line once (after the delay), then the evaluation', async () => {
    const t = scoring({ delay: 80 });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.recitations()).toHaveLength(2), {
      timeout: 5000,
    });
    const lines = t.spoken.filter((x) => x === RECITATION_WAIT_FALLBACK.ar);
    // once per slow recitation (the delay < the «again» time)
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(t.started.n);
    // the reply came: the line is cut off before anything else is said
    expect(t.stop).toHaveBeenCalled();
    t.lesson.dispose();
  });

  it('a very long wait → said one more time at most', async () => {
    const t = scoring({ delay: 400, lineMs: 20, againMs: 120 });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.recitations().length).toBeGreaterThan(1), {
      timeout: 5000,
    });
    const first = t.server.calls.findIndex((c) => c.path === '/agent/score-recitation');
    expect(first).toBeGreaterThan(-1);
    // per recitation: at most twice
    expect(t.spoken.filter((x) => x === RECITATION_WAIT_FALLBACK.ar).length).toBeLessThanOrEqual(
      2 * t.started.n,
    );
    expect(t.spoken.filter((x) => x === RECITATION_WAIT_FALLBACK.ar).length).toBeGreaterThanOrEqual(2);
    t.lesson.dispose();
  });

  it('a quick score → no wait line at all', async () => {
    const t = scoring({ delay: 0, lineMs: 2000 });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.recitations().length).toBeGreaterThan(1));
    expect(t.spoken).not.toContain(RECITATION_WAIT_FALLBACK.ar);
    t.lesson.dispose();
  });

  it('the reply arrives mid-line: the wait line FADES out first, then the evaluation is said (never overlapping)', async () => {
    const server = new FakeAgentServer(withStage('recitation', REAL_RECITATION));
    const events: string[] = [];
    let speaking = false;
    let overlap = false;
    const t = setup({
      server,
      api: new AgentApi('https://ai.test', slowScore(server, 80, { n: 0 })),
      recorder: { record: async () => new Blob(['x']) },
      voice: {
        speak: async (x) => {
          if (speaking) overlap = true; // never two voices at once
          speaking = true;
          events.push(`say:${x}`);
          await new Promise((r) => setTimeout(r, x === RECITATION_WAIT_FALLBACK.ar ? 400 : 5));
          speaking = false;
        },
        fadeOut: async (ms) => {
          events.push(`fade:${ms}`);
          speaking = false;
        },
        stop: () => {
          speaking = false;
        },
      },
      waits: { fillerMs: 60_000, timeoutMs: 60_000, recitationLineMs: 20, recitationAgainMs: 60_000 },
    });
    void t.lesson.start();
    await vi.waitFor(() => expect(events.some((e) => e.startsWith('fade'))).toBe(true), { timeout: 5000 });
    const fade = events.findIndex((e) => e.startsWith('fade'));
    expect(events[fade]).toBe('fade:150');
    expect(events[fade - 1]).toBe(`say:${RECITATION_WAIT_FALLBACK.ar}`);
    // the evaluation (the next turn's say) comes after the fade — not dropped
    await vi.waitFor(() =>
      expect(
        events
          .slice(fade + 1)
          .some((e) => e.startsWith('say:') && e !== `say:${RECITATION_WAIT_FALLBACK.ar}`),
      ).toBe(true),
    );
    expect(overlap).toBe(false);
    t.lesson.dispose();
  });

  it('a late evaluation is never dropped or sent twice (no 15 s race for a repeat)', async () => {
    const server = new FakeAgentServer(withStage('recitation', REAL_RECITATION));
    let slow: 'waiting' | 'inFlight' | 'done' = 'waiting';
    let sentMeanwhile = 0;
    let nextIsEvaluation = false;
    const t = setup({
      server,
      recorder: { record: async () => new Blob(['x']) },
      api: new AgentApi('https://ai.test', async (url, init) => {
        const path = new URL(url).pathname;
        const body = init?.body ? (JSON.parse(String(init.body)) as { forScore?: boolean }) : null;
        if (path === '/agent/message' && slow === 'inFlight') sentMeanwhile++;
        if (path === '/agent/score-recitation' && body?.forScore === true && slow === 'waiting')
          nextIsEvaluation = true;
        // the first recitation's evaluation takes longer than the retry limit (40 ms here)
        if (path === '/agent/message' && slow === 'waiting' && nextIsEvaluation) {
          slow = 'inFlight';
          await new Promise((r) => setTimeout(r, 150));
          const r = await server.fetch(url, init);
          slow = 'done';
          return r;
        }
        return server.fetch(url, init);
      }),
      waits: { fillerMs: 60_000, timeoutMs: 40, recitationLineMs: 60_000 },
    });
    void t.lesson.start();
    await vi.waitFor(() => expect(slow).toBe('done'), { timeout: 5000 });
    await vi.waitFor(() =>
      expect(
        t.server.calls.filter((c) => c.path === '/agent/score-recitation' && c.body?.forScore === true)
          .length,
      ).toBeGreaterThan(1),
    );
    // no retry while it was in flight, and the lesson went on with its (late) reply
    expect(sentMeanwhile).toBe(0);
    t.lesson.dispose();
  });

  it("English session: the English wait line (the server's own text when it gave one)", async () => {
    const t = scoring({ delay: 80, lang: 'en' });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.spoken).toContain(RECITATION_WAIT_FALLBACK.en), { timeout: 5000 });
    t.lesson.dispose();
  });
});

describe('ServerLesson — the day plan: surah → hadith directly, no silent gaps', () => {
  const DAY_PLAN = { ...PLAN, quranStages: DEFAULT_QURAN_STAGES };
  /** The fake server, each request delayed by `ms(path, n)` (n = that path's call number). */
  const slowFetch = (
    server: FakeAgentServer,
    ms: (path: string, n: number) => number,
  ): typeof server.fetch => {
    const seen = new Map<string, number>();
    return async (url, init) => {
      const path = new URL(url).pathname;
      const n = seen.get(path) ?? 0;
      seen.set(path, n + 1);
      const wait = ms(path, n);
      if (wait === Infinity) return new Promise<never>(() => {});
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      return server.fetch(url, init);
    };
  };

  it('the meanings and every stage after the recitation are never run; the hadith follows at once', async () => {
    const server = new FakeAgentServer();
    let startsWhenPraised = -1;
    const t = setup({
      server,
      plan: DAY_PLAN,
      voice: {
        speak: async (line) => {
          t.spoken.push(line);
          if (line === TO_HADITH.boy) {
            await new Promise((r) => setTimeout(r, 20));
            startsWhenPraised = server.calls.filter((c) => c.path === '/agent/start').length;
          }
        },
        stop: () => {},
      },
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('الحمد لله بخير');
    await at(t.lesson, 'lesson_intro', 'continue');
    t.lesson.continueTapped();
    await at(t.lesson, 'text', 'continue');
    // tafsir / fadl: continued silently; tajweed / plan / done: never reached (no answer sent)
    for (const line of ['معنى السورة…', 'فضلها عظيم.', 'أحسنت!', 'بكرة نراجع.', 'في أمان الله.'])
      expect(t.spoken).not.toContain(line);
    const quran = t.server.calls.filter((c) => c.path === '/agent/message' && c.body?.session_id === 's1');
    expect(quran.at(-1)!.body!.text).toBe('REF-AYAH-4');
    // the praise line right after the last ayah, the hadith session already starting meanwhile
    const i = t.spoken.indexOf(TO_HADITH.boy);
    expect(i).toBeGreaterThan(0);
    expect(startsWhenPraised).toBe(2);
    // the surah part is saved as done before the hadith (a resume starts at the hadith)
    expect(t.updates).toContainEqual({
      lessonId: 'pilot-day-1',
      stage: 'hadith',
      stepIndex: PLAN.hadithStepIndex,
      doneRefs: ['112:1', '112:2', '112:3', '112:4'],
    });
    expect(t.lesson.state.value.quranDone).toBe(true);
  });

  it('pilot days run the same surah plan: greet, surah, intro, recitation', () => {
    expect(DEFAULT_QURAN_STAGES).toEqual(['greet', 'surah', 'lesson_intro', 'recitation']);
    for (const d of PILOT_DAYS) expect(d.quranStages).toEqual(DEFAULT_QURAN_STAGES);
  });

  it('waiting on the server > the filler time → one short filler, then the reply', async () => {
    const server = new FakeAgentServer();
    const t = setup({
      server,
      plan: DAY_PLAN,
      api: new AgentApi(
        'https://ai.test',
        slowFetch(server, (p) => (p === '/agent/message' ? 40 : 0)),
      ),
      waits: { fillerMs: 10, timeoutMs: 5000 },
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('الحمد لله بخير');
    await at(t.lesson, 'lesson_intro', 'continue');
    // at most one filler in FILLER_EVERY_MS — not one after every reply
    expect(t.spoken.filter((x) => x === FILLER.boy)).toHaveLength(1);
  });

  it('a wait that goes on → a «getting it ready» line every so often (even right after a filler)', async () => {
    const server = new FakeAgentServer();
    const t = setup({
      server,
      plan: DAY_PLAN,
      api: new AgentApi(
        'https://ai.test',
        slowFetch(server, (p, n) => (p === '/agent/message' ? (n === 1 ? 120 : 15) : 0)),
      ),
      waits: { fillerMs: 5, timeoutMs: 5000, longEveryMs: 40 },
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('الحمد لله بخير');
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.spoken).toContain(FILLER.boy);
    expect(t.spoken.filter((x) => x === FILLER_LONG.boy).length).toBeGreaterThanOrEqual(2);
  });

  it('no answer in the wait limit → the request once more (the lesson goes on)', async () => {
    const server = new FakeAgentServer();
    const t = setup({
      server,
      plan: DAY_PLAN,
      // the first answer to the greeting never comes back; the retry does
      api: new AgentApi(
        'https://ai.test',
        slowFetch(server, (p, n) => (p === '/agent/message' && n === 0 ? Infinity : 0)),
      ),
      waits: { fillerMs: 1000, timeoutMs: 30 },
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('الحمد لله بخير');
    await at(t.lesson, 'lesson_intro', 'continue');
    expect(t.lesson.state.value.phase).toBe('live');
  });

  it('still nothing after the retry → the lesson moves on (never a frozen call)', async () => {
    const server = new FakeAgentServer();
    const t = setup({
      server,
      plan: DAY_PLAN,
      api: new AgentApi(
        'https://ai.test',
        slowFetch(server, (p) => (p === '/agent/message' ? Infinity : 0)),
      ),
      waits: { fillerMs: 1000, timeoutMs: 30 },
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('الحمد لله بخير');
    await until(t.lesson, (s) => s.phase === 'fallback');
    expect(t.lesson.state.value.fallbackReason).toMatch(/did not answer in time/);
  });

  it('the surah card stays (dimmed: busy) until the hadith is ready — never an empty stage', async () => {
    const server = new FakeAgentServer();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const t = setup({
      server,
      plan: DAY_PLAN,
      api: new AgentApi('https://ai.test', async (url, init) => {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        if (new URL(url).pathname === '/agent/start' && body?.mode === 'hadith') await gate;
        return server.fetch(url, init);
      }),
      waits: { fillerMs: 5000, timeoutMs: 5000 },
    });
    void t.lesson.start();
    await at(t.lesson, 'greet', 'text');
    t.lesson.answer('الحمد لله بخير');
    await at(t.lesson, 'lesson_intro', 'continue');
    t.lesson.continueTapped();
    await until(t.lesson, (s) => s.segment === 'hadith' && s.busy);
    expect(t.lesson.state.value.ayat).toHaveLength(4);
    release();
    await at(t.lesson, 'text', 'continue');
    expect(t.lesson.state.value.ayat).toEqual([]);
    expect(t.lesson.state.value.hadith).not.toBeNull();
  });
});
