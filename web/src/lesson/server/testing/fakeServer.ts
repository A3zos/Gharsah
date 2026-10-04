// An in-memory stand-in for the AI server's /agent/* state machine (ai/API_web.md),
// behind a fake `fetch` — tests drive the real AgentApi + parser + ServerLesson.
import type { FetchLike } from '../api';

export interface StageSpec {
  id: string;
  label: string;
  say: string;
  expects: 'text' | 'continue' | 'repeat' | 'choice' | 'none';
  quick?: string[];
  actions?: (n: number) => unknown[];
  /** How many child messages this stage takes before moving on (repeat: one per ayah). */
  turns?: number;
  /** Extra response fields. */
  extra?: Record<string, unknown>;
}

export interface Call {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
  query: Record<string, string>;
}

interface Session {
  mode: 'quran' | 'hadith';
  idx: number;
  max: number;
  n: number;
}

export const SURAH = 112;
export const EVERYAYAH = (a: number) =>
  `https://everyayah.com/data/Alafasy_128kbps/112${String(a).padStart(3, '0')}.mp3`;

export const QURAN_STAGES: StageSpec[] = [
  {
    id: 'greet',
    label: 'الترحيب',
    say: 'السلام عليكم! أنا المعلم عبدالله. كيف حالك يا بطل؟',
    expects: 'text',
    quick: ['الحمد لله بخير', 'تمام'],
  },
  { id: 'name', label: 'التعارف', say: 'وش اسمك؟', expects: 'text' },
  {
    id: 'surah',
    label: 'السورة',
    say: 'وش رأيك نحفظ سورة الإخلاص؟',
    expects: 'choice',
    quick: ['الإخلاص', 'الناس', 'الفلق'],
  },
  {
    id: 'lesson_intro',
    label: 'المقدمة',
    say: 'سورة الإخلاص أربع آيات.',
    expects: 'continue',
    extra: { surah_no: SURAH, lesson_title: 'سورة الإخلاص' },
  },
  {
    id: 'tafsir',
    label: 'التفسير',
    say: 'معنى السورة…',
    expects: 'continue',
    actions: () => [
      {
        type: 'show_ayat',
        ayat: ['SERVER-TEXT-1', 'SERVER-TEXT-2', 'SERVER-TEXT-3', 'SERVER-TEXT-4'],
        first: 1,
        surah_name: 'الإخلاص',
      },
      { type: 'set_step', step: 2 },
    ],
  },
  { id: 'fadl', label: 'الفضائل', say: 'فضلها عظيم.', expects: 'continue' },
  {
    id: 'recitation',
    label: 'التلاوة',
    say: 'استمع ثم ردّد.',
    expects: 'repeat',
    turns: 4,
    actions: (n) => [{ type: 'play_ayah', ayah: n + 1, text: `REF-AYAH-${n + 1}`, url: EVERYAYAH(n + 1) }],
  },
  {
    id: 'tajweed',
    label: 'التجويد',
    say: 'أحسنت!',
    expects: 'continue',
    actions: () => [{ type: 'play_all', urls: [1, 2, 3, 4].map(EVERYAYAH) }],
  },
  { id: 'plan', label: 'الخطة', say: 'بكرة نراجع.', expects: 'continue' },
  { id: 'done', label: 'النهاية', say: 'في أمان الله.', expects: 'none' },
];

export const HADITH_STAGES: StageSpec[] = [
  { id: 'greet', label: 'الترحيب', say: 'أهلًا من جديد!', expects: 'text', quick: ['تمام'] },
  { id: 'name', label: 'التعارف', say: 'ذكّرني باسمك؟', expects: 'text' },
  { id: 'intro', label: 'المقدمة', say: 'حديث اليوم عن برّ الوالدين.', expects: 'continue' },
  {
    id: 'text',
    label: 'النص',
    say: 'اسمع الحديث.',
    expects: 'continue',
    actions: () => [
      { type: 'show_ayat', ayat: ['SERVER-HADITH-TEXT'], hadith_title: 'برّ الوالدين', source: 'متفق عليه' },
    ],
  },
  {
    id: 'words',
    label: 'الكلمات',
    say: 'كلمات جديدة.',
    expects: 'continue',
    actions: () => [{ type: 'show_words', words: [{ word: 'البر', meaning: 'الإحسان' }] }],
  },
  { id: 'meaning', label: 'المعنى', say: 'المعنى…', expects: 'continue' },
  { id: 'example', label: 'مثال', say: 'مثال…', expects: 'continue' },
  {
    id: 'memorize',
    label: 'الحفظ',
    say: 'ردّد الحديث.',
    expects: 'repeat',
    extra: { recitation_scores: [{ hadith: 9, score: 0.9, tries: 1 }] },
  },
  {
    id: 'quiz',
    label: 'سؤال',
    say: 'من أحق الناس بحسن صحابتي؟',
    expects: 'choice',
    quick: ['الأم', 'الصديق'],
  },
  { id: 'action', label: 'التطبيق', say: 'ساعد أمك اليوم.', expects: 'continue' },
  { id: 'project', label: 'مشروعي', say: 'وش بتسوي لأمك؟', expects: 'text' },
  { id: 'done', label: 'النهاية', say: 'بارك الله فيك.', expects: 'none' },
];

export class FakeAgentServer {
  readonly calls: Call[] = [];
  private sessions = new Map<string, Session>();
  private seq = 0;
  /** Queue of forced HTTP statuses for the next matching requests: [path, status]. */
  readonly failures: [string, number][] = [];
  /** Hadith ids reported by /agent/progress (grows when a hadith session ends). */
  completedHadith: number[] = [];
  scoreAvailable = true;
  /** /agent/score-recitation's score (0..1). */
  scoreValue = 0.8;
  readyTaseem: unknown[] = [];

  constructor(
    private readonly quran: StageSpec[] = QURAN_STAGES,
    private readonly hadith: StageSpec[] = HADITH_STAGES,
  ) {}

  readonly fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    this.calls.push({
      path: u.pathname,
      method: init?.method ?? 'GET',
      body,
      query: Object.fromEntries(u.searchParams),
    });
    const f = this.failures.findIndex(([p]) => p === u.pathname);
    if (f >= 0) {
      const [, status] = this.failures.splice(f, 1)[0]!;
      return json(
        status === 404 ? { detail: 'session expired, please start again' } : { detail: 'x' },
        status,
      );
    }
    switch (u.pathname) {
      case '/agent/status':
        // 2026-10-04: + asr (diagnostics only — the client never reads it)
        return json({
          llm: true,
          model: 'm',
          last_error: null,
          asr: { groq_configured: true, modal_configured: true, modal_last: 'never' },
        });
      case '/agent/start': {
        const id = `s${++this.seq}`;
        const mode = body?.mode === 'hadith' ? 'hadith' : 'quran';
        this.sessions.set(id, { mode, idx: 0, max: 0, n: 0 });
        return json(this.turn(id));
      }
      case '/agent/message': {
        const s = this.sessions.get(String(body?.session_id));
        if (!s) return json({ detail: 'session expired, please start again' }, 404);
        const spec = this.stages(s)[s.idx]!;
        s.n++;
        if (s.n >= (spec.turns ?? 1)) {
          s.idx = Math.min(s.idx + 1, this.stages(s).length - 1);
          s.n = 0;
          s.max = Math.max(s.max, s.idx);
          if (this.stages(s)[s.idx]!.expects === 'none' && s.mode === 'hadith') this.completedHadith.push(9);
        }
        return json(this.turn(String(body?.session_id)));
      }
      case '/agent/jump': {
        const s = this.sessions.get(String(body?.session_id));
        if (!s) return json({ detail: 'session expired, please start again' }, 404);
        const to = this.stages(s).findIndex((x) => x.id === body?.stage);
        if (to >= 0 && to <= s.max) {
          s.idx = to;
          s.n = 0;
        }
        return json(this.turn(String(body?.session_id)));
      }
      case '/agent/taseem/start':
        // A one-step memory test that ends at once (enough to drive the segment flow).
        return json({
          session_id: `t${++this.seq}`,
          kind: 'taseem',
          teacher: 'المعلم عبدالله',
          female: false,
          stage: '0',
          stage_index: 0,
          max_stage_index: 0,
          stages: [{ id: '0', label: 'الآية 1' }],
          say: 'سمّع لي السورة من حفظك.',
          actions: [{ type: 'show_ayat', ayat: [''] }],
          expects: 'none',
          quick_replies: [],
        });
      case '/agent/score-recitation':
        return json(
          this.scoreAvailable
            ? {
                available: true,
                transcription: 'قل هو الله أحد',
                score: this.scoreValue,
                tajweed_errors: this.scoreValue < 0.9 ? [{ rule: 'مطابقة النص', position: 'أحد' }] : [],
              }
            : { available: false },
        );
      case '/agent/taseem/status':
      case '/agent/htaseem/status':
        return json({ items: this.readyTaseem });
      case '/agent/progress':
        return json({
          quran: { completed_chunks: [] },
          hadith: { completed: this.completedHadith.map(String) },
        });
      case '/agent/actions':
        return json({ items: [{ hadith_id: 9, title: 'برّ الوالدين', action: 'ساعد أمك', done: false }] });
      case '/agent/actions/done':
        return json({ ok: true });
      case '/speak/status':
        return json({ elevenlabs: false });
      default:
        return json({ detail: 'Not Found' }, 404);
    }
  };

  private stages(s: Session): StageSpec[] {
    return s.mode === 'quran' ? this.quran : this.hadith;
  }

  private turn(id: string): Record<string, unknown> {
    const s = this.sessions.get(id)!;
    const stages = this.stages(s);
    const spec = stages[s.idx]!;
    return {
      session_id: id,
      ...(s.mode === 'hadith' ? { kind: 'hadith' } : {}),
      teacher: 'المعلم عبدالله',
      female: false,
      stage: spec.id,
      stage_index: s.idx,
      max_stage_index: s.max,
      stages: stages.map((x) => ({ id: x.id, label: x.label })),
      say: spec.say,
      actions: spec.actions?.(s.n) ?? [],
      expects: spec.expects,
      quick_replies: spec.quick ?? [],
      profile: {},
      child_name: 'يا بطل',
      llm: true,
      recitation_scores: [],
      // like the real server: its default surah_no 1 until «which surah?» is answered
      ...(s.mode === 'quran'
        ? s.idx >= 3
          ? { surah_no: SURAH, lesson_title: 'سورة الإخلاص' }
          : { surah_no: 1 }
        : {}),
      ...(spec.extra ?? {}),
    };
  }

  messages(): string[] {
    return this.calls.filter((c) => c.path === '/agent/message').map((c) => String(c.body?.text));
  }
}

function json(v: unknown, status = 200): Response {
  return new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
}
