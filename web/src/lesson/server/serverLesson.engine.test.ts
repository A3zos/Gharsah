// One engine at a time + no dead ends (the live «frozen lesson» bug, girl account).
import { describe, expect, it, vi } from 'vitest';

import { lessonLogEntries } from '../lessonLog';
import { AgentApi } from './api';
import { ServerLesson, stopForToday, type LessonPlan, type ServerLessonDeps } from './serverLesson';
import { FakeAgentServer, QURAN_STAGES, type StageSpec } from './testing/fakeServer';

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

  it('answers «أكتفي اليوم» (one surah a day) — never the next surah', async () => {
    const t = make({ server: new FakeAgentServer(endAsks(112)) });
    void t.lesson.start();
    await vi.waitFor(() => expect(t.lesson.state.value.expects).toBe('text'));
    t.lesson.answer('تمام');
    for (const stage of ['lesson_intro', 'tafsir', 'fadl', 'tajweed', 'plan', 'done']) {
      await vi.waitFor(() => {
        const s = t.lesson.state.value;
        expect(s.stages[s.stageIndex]?.id).toBe(stage);
        expect(s.expects).toBe('continue');
      });
      if (stage !== 'done') t.lesson.continueTapped();
    }
    expect(stopForToday(['نعم، سورة الناس', 'أكتفي اليوم'])).toBe('أكتفي اليوم');
    expect(stopForToday(['نعم', 'لا، شكرًا'])).toBe('لا، شكرًا');
    expect(stopForToday(['نعم، سورة الناس'])).toBeNull();
  });

  it('the server moving on to another surah after today’s is the end of the Quran part — not a fallback', async () => {
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
    expect(t.server.messages()).toContain('أكتفي اليوم');
    t.lesson.dispose();
  });
});
