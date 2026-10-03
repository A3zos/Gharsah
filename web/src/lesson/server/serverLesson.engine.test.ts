// One engine at a time + no dead ends (the live «frozen lesson» bug, girl account).
import { describe, expect, it, vi } from 'vitest';

import { lessonLogEntries } from '../lessonLog';
import { AgentApi } from './api';
import { ServerLesson, SKIP_AYAH, TO_HADITH, type LessonPlan, type ServerLessonDeps } from './serverLesson';
import { EVERYAYAH, FakeAgentServer, QURAN_STAGES, type StageSpec } from './testing/fakeServer';

const PLAN: LessonPlan = {
  lessonId: 'pilot-day-1',
  surahNo: 112,
  surahName: 'الإخلاص',
  hadithTopic: 'برّ الوالدين',
  hadithStepIndex: 9,
  lastStepIndex: 10,
};

function make(o: Partial<ServerLessonDeps> & { server?: FakeAgentServer } = {}) {
  const server = o.server ?? new FakeAgentServer();
  const spoken: string[] = [];
  const played: string[] = [];
  const voiceStop = vi.fn();
  const playerStop = vi.fn();
  const lesson = new ServerLesson({
    api: new AgentApi('https://ai.test', server.fetch, []),
    voice: { speak: async (t) => void spoken.push(t), stop: voiceStop },
    player: { play: async (u) => void played.push(u), stop: playerStop },
    // repeats: heard at once; answers: the child stays quiet (the test answers itself)
    presence: {
      waitForSpeech: async (_s, p) => {
        if (p?.purpose === 'answer') return new Promise<never>(() => {});
        p?.onVoiced?.(1200);
        return 'spoke';
      },
    },
    sink: { record: async () => {} },
    plan: PLAN,
    deviceId: 'dev-1',
    gender: 'girl',
    consent: false,
    verifiedAyah: (s, a) => (s === 112 && a >= 1 && a <= 4 ? `V-${a}` : null),
    ayahCount: () => 4,
    surahName: () => 'الإخلاص',
    sleep: async () => {},
    beat: async () => {},
    watchdog: false,
    ...o,
  });
  return { server, lesson, spoken, played, voiceStop, playerStop };
}

describe('ServerLesson — one engine at a time', () => {
  it('a mid-lesson fallback stops the AI engine for good (no voice, audio or request after it)', async () => {
    const t = make();
    void t.lesson.start();
    await vi.waitFor(() => expect(t.lesson.state.value.expects).toBe('text'));
    t.lesson.answer('تمام');
    await vi.waitFor(() =>
      expect(t.lesson.state.value.stages[t.lesson.state.value.stageIndex]?.id).toBe('lesson_intro'),
    );
    await vi.waitFor(() => expect(t.lesson.state.value.expects).toBe('continue'));
    // the server fails in the middle of the Quran part (girl account, like the live report)
    t.server.failures.push(['/agent/message', 503], ['/agent/message', 503], ['/agent/message', 503]);
    t.lesson.continueTapped();
    await vi.waitFor(() => expect(t.lesson.state.value.phase).toBe('fallback'));

    expect(t.lesson.stopped).toBe(true);
    expect(t.voiceStop).toHaveBeenCalled();
    expect(t.playerStop).toHaveBeenCalled();
    const said = t.spoken.length;
    const played = t.played.length;
    const calls = t.server.calls.length;
    await new Promise((r) => setTimeout(r, 100));
    expect(t.spoken.length).toBe(said);
    expect(t.played.length).toBe(played);
    expect(t.server.calls.length).toBe(calls);
    // commands after the fallback do nothing
    t.lesson.continueTapped();
    t.lesson.answer('تمام');
    await new Promise((r) => setTimeout(r, 50));
    expect(t.server.calls.length).toBe(calls);
    expect(t.lesson.state.value.phase).toBe('fallback');
    // logged, with the reason
    expect(lessonLogEntries().some((e) => e.engine === 'ai' && e.event.startsWith('FALLBACK'))).toBe(true);
    expect(lessonLogEntries().some((e) => e.engine === 'ai' && e.event === 'engine stopped')).toBe(true);
  });

  it('dispose is complete and idempotent', () => {
    const t = make();
    t.lesson.dispose();
    t.lesson.dispose();
    expect(t.lesson.stopped).toBe(true);
    expect(t.voiceStop).toHaveBeenCalled();
  });
});

describe('ServerLesson — no dead ends', () => {
  it('a turn whose voice fails unexpectedly is recovered by the watchdog (not a frozen screen)', async () => {
    let failures = 1;
    const spoken: string[] = [];
    const t = make({
      watchdog: { idleMs: 60, tickMs: 10 },
      voice: {
        speak: async (x) => {
          // the greeting's voice dies once with an unexpected error (not a cancel)
          if (x.startsWith('السلام') && failures-- > 0) throw new Error('decoder crashed');
          spoken.push(x);
        },
        stop: () => {},
      },
    });
    void t.lesson.start();
    await vi.waitFor(() => expect(spoken.some((x) => x.startsWith('السلام'))).toBe(true), { timeout: 2000 });
    expect(lessonLogEntries().some((e) => e.event === 'turn failed')).toBe(true);
    expect(lessonLogEntries().some((e) => e.event === 'STUCK — recovering')).toBe(true);
    // and the lesson goes on: the greeting was said again and the mic listens
    await vi.waitFor(
      () => expect(t.lesson.state.value).toMatchObject({ expects: 'text', hearing: true, phase: 'live' }),
      { timeout: 2000 },
    );
    t.lesson.dispose();
  });
});

describe('ServerLesson — the end of today’s surah (the live «old behaviour» fallback)', () => {
  // The live server ends the Quran part with «ننتقل لسورة الناس، أم تكتفي اليوم؟» (expects continue).
  const endAsks = (nextSurah: number): StageSpec[] =>
    QURAN_STAGES.map((s) =>
      s.id === 'done' ? { ...s, expects: 'continue' as const, quick: ['نعم، سورة الناس', 'أكتفي اليوم'] } : s,
    ).concat([
      {
        id: 'next_intro',
        label: 'المقدمة',
        say: 'اليوم نتعلم سورة الناس.',
        expects: 'continue',
        extra: { surah_no: nextSurah },
      },
    ]);

  it('the «done» turn ends the Quran part — nothing answered (no next surah, no «أكتفي اليوم»)', async () => {
    const t = make({ server: new FakeAgentServer(endAsks(112)) });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.lesson.state.value.expects).toBe('text'));
    t.lesson.answer('تمام');
    for (const stage of ['lesson_intro', 'tafsir', 'fadl', 'tajweed', 'plan']) {
      await vi.waitFor(() => {
        const s = t.lesson.state.value;
        expect(s.stages[s.stageIndex]?.id).toBe(stage);
        expect(s.expects).toBe('continue');
      });
      t.lesson.continueTapped();
    }
    await vi.waitFor(() => expect(t.lesson.state.value.segment).toBe('hadith'), { timeout: 3000 });
    // the server's «done» turn was answered with nothing
    expect(t.server.messages()).not.toContain('أكتفي اليوم');
    expect(t.server.messages()).not.toContain('نعم، سورة الناس');
    // the transition line, then the hadith session
    expect(t.spoken).toContain(TO_HADITH);
    const starts = t.server.calls.filter((c) => c.path === '/agent/start').map((c) => c.body?.mode);
    expect(starts).toEqual(['quran', 'hadith']);
    t.lesson.dispose();
  });

  it('a voice call: the surah ends → the hadith part follows by itself — not a fallback', async () => {
    const t = make({
      server: new FakeAgentServer(endAsks(114)),
      // every answer is heard at once (the child speaks)
      presence: {
        waitForSpeech: async (_s, p) => {
          p?.onVoiced?.(1200);
          return 'spoke';
        },
      },
    });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.lesson.state.value.segment).toBe('hadith'), { timeout: 3000 });
    expect(t.lesson.state.value.phase).not.toBe('fallback');
    expect(t.server.messages()).not.toContain('أكتفي اليوم');
    t.lesson.dispose();
  });
});

describe("ServerLesson — the server's distress filter on an ayah («مِن شَرِّ…»)", () => {
  // Live (2026-10-03): repeating An-Nas 4 / Al-Falaq 3 by sending the ayah's text makes
  // the server answer with a comfort line («تبي نكمل ولا تحتاج دقيقة؟»), forever.
  const stages = [
    { id: 'recitation', label: 'التلاوة' },
    { id: 'done', label: 'الختام' },
  ];
  const turn = (o: Record<string, unknown>) => ({
    session_id: 's1',
    teacher: 'المعلمة سارة',
    female: true,
    stage: 'recitation',
    stage_index: 0,
    max_stage_index: 0,
    stages,
    surah_no: 112,
    quick_replies: [],
    actions: [],
    ...o,
  });
  const repeat2 = turn({
    say: 'استمع للآية 2 ثم ردّدها',
    expects: 'repeat',
    quick_replies: ['تخطّي الآية', 'أعد الآية'],
    actions: [
      { type: 'play_ayah', ayah: 2, text: 'نص الآية', url: EVERYAYAH(2) },
      { type: 'show_ayat', ayat: ['V-1', 'V-2', 'V-3', 'V-4'], first: 1, current: 2 },
    ],
  });
  const comfort = turn({
    say: 'يا بطل، الله معك… تبي نكمل ولا تحتاج دقيقة؟',
    expects: 'continue',
    quick_replies: ['أنا جاهز نكمل', 'أعطني دقيقة'],
  });
  const end = turn({ say: 'أحسنت', expects: 'none', stage: 'done', stage_index: 1, max_stage_index: 1 });

  it('an ayah the server answered with a comfort line is skipped with its own «تخطّي الآية» next time', async () => {
    const sent: string[] = [];
    const replies = [repeat2, comfort, repeat2, end];
    const fetchFn = async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as { text?: string }) : {};
      if (url.endsWith('/agent/message')) sent.push(String(body.text));
      const j = url.endsWith('/agent/start') ? replies[0] : replies[sent.length];
      return new Response(JSON.stringify(j ?? end), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const t = make({ api: new AgentApi('https://ai.test', fetchFn, []) });
    void t.lesson.start();
    // the repeat (presence) → the ayah's text; the comfort line → «أنا جاهز نكمل» (a tap here)
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toBe('نص الآية');
    await vi.waitFor(() => expect(t.lesson.state.value.expects).toBe('continue'));
    t.lesson.continueTapped();
    // the same ayah again → the server's own skip, not the text that trips its filter
    await vi.waitFor(() => expect(sent.length).toBeGreaterThanOrEqual(3));
    expect(sent[2]).toBe(SKIP_AYAH);
    t.lesson.dispose();
  });
});
