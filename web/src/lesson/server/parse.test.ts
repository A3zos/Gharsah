import { describe, expect, it } from 'vitest';

import {
  parseAction,
  parseActionItems,
  parseCompletedHadith,
  parseReady,
  parseScore,
  parseTurn,
  safeAudioUrl,
  TurnParseError,
} from './parse';

const base = {
  session_id: 'abc',
  teacher: 'المعلمة سارة',
  female: true,
  stage: 'tafsir',
  stage_index: 4,
  max_stage_index: 5,
  stages: [
    { id: 'greet', label: 'الترحيب' },
    { id: 'name', label: 'الاسم' },
    { id: 'surah', label: 'السورة' },
    { id: 'lesson_intro', label: 'المقدمة' },
    { id: 'tafsir', label: 'التفسير' },
    { id: 'fadl', label: 'الفضائل' },
  ],
  say: 'هلا',
  actions: [],
  expects: 'continue',
  quick_replies: ['أكمل', '', 3],
  surah_no: 112,
  lesson_title: 'سورة الإخلاص',
  recitation_scores: [{ ayah: 1, score: 0.9, tries: 1 }, { ayah: 2 }, { ayah: 1 }],
};

describe('parseTurn', () => {
  it('reads the documented response shape', () => {
    const t = parseTurn(base, 'quran');
    expect(t).toMatchObject({
      sessionId: 'abc',
      kind: 'quran',
      teacher: 'المعلمة سارة',
      female: true,
      stage: 'tafsir',
      stageIndex: 4,
      maxStageIndex: 5,
      say: 'هلا',
      expects: 'continue',
      quickReplies: ['أكمل'],
      surahNo: 112,
      lessonTitle: 'سورة الإخلاص',
      recitedAyat: [1, 2],
    });
    expect(t.stages).toHaveLength(6);
  });

  it('kind is absent on the quran path — the mode we started with decides', () => {
    expect(parseTurn(base, 'quran').kind).toBe('quran');
    expect(parseTurn({ ...base, kind: 'hadith' }, 'hadith').kind).toBe('hadith');
    // kind only overrides for the review sessions
    expect(parseTurn({ ...base, kind: 'hadith' }, 'quran').kind).toBe('quran');
    expect(parseTurn({ ...base, kind: 'taseem' }, 'quran').kind).toBe('taseem');
    expect(parseTurn({ ...base, kind: 'htaseem' }, 'hadith').kind).toBe('htaseem');
  });

  it.each(['text', 'continue', 'repeat', 'choice', 'none'] as const)('keeps expects=%s', (e) => {
    expect(parseTurn({ ...base, expects: e }, 'quran').expects).toBe(e);
  });

  it('an unknown or missing expects falls back to continue (never a dead end)', () => {
    expect(parseTurn({ ...base, expects: 'dance' }, 'quran').expects).toBe('continue');
    expect(parseTurn({ ...base, expects: undefined }, 'quran').expects).toBe('continue');
  });

  it('clamps stage indexes; max never below the current stage', () => {
    const t = parseTurn({ ...base, stage_index: 99, max_stage_index: 1 }, 'quran');
    expect(t.stageIndex).toBe(5);
    expect(t.maxStageIndex).toBe(5);
    expect(parseTurn({ ...base, stage_index: -3, max_stage_index: 'x' }, 'quran').stageIndex).toBe(0);
  });

  it('rejects a response without a session id or not an object', () => {
    expect(() => parseTurn({ ...base, session_id: undefined }, 'quran')).toThrow(TurnParseError);
    expect(() => parseTurn(null, 'quran')).toThrow(TurnParseError);
    expect(() => parseTurn([], 'quran')).toThrow(TurnParseError);
  });

  it('tolerates missing optional fields', () => {
    const t = parseTurn({ session_id: 'z' }, 'hadith');
    expect(t).toMatchObject({
      kind: 'hadith',
      stages: [],
      actions: [],
      quickReplies: [],
      surahNo: null,
      say: '',
    });
  });

  it('reads hadith ids from recitation_scores', () => {
    expect(
      parseTurn({ ...base, recitation_scores: [{ hadith: 9 }, { hadith: '6' }] }, 'hadith').hadithIds,
    ).toEqual([9, 6]);
  });
});

describe('parseAction', () => {
  it('show_ayat: first defaults to 1; current as ayah number or as index', () => {
    expect(parseAction({ type: 'show_ayat', ayat: ['a', 'b'] })).toMatchObject({ first: 1, current: null });
    expect(parseAction({ type: 'show_ayat', ayat: ['a', 'b', 'c'], first: 2, current: 3 })).toMatchObject({
      current: 3,
    });
    expect(parseAction({ type: 'show_ayat', ayat: ['a', 'b', 'c'], first: 5, current: 1 })).toMatchObject({
      current: 6,
    });
    expect(parseAction({ type: 'show_ayat', ayat: ['a'], first: 5, current: 40 })).toMatchObject({
      current: null,
    });
  });

  it('show_ayat hadith fields', () => {
    expect(
      parseAction({ type: 'show_ayat', ayat: ['…'], hadith_title: 'برّ', source: 'متفق عليه' }),
    ).toMatchObject({
      hadithTitle: 'برّ',
      source: 'متفق عليه',
    });
  });

  it('show_words keeps valid words (an empty list is fine)', () => {
    expect(
      parseAction({ type: 'show_words', words: [{ word: 'البر', meaning: 'الإحسان' }, { meaning: 'x' }, 3] }),
    ).toEqual({
      type: 'show_words',
      words: [{ word: 'البر', meaning: 'الإحسان' }],
    });
    expect(parseAction({ type: 'show_words', words: [] })).toEqual({ type: 'show_words', words: [] });
  });

  it('play_all / play_ayah only with everyayah https URLs', () => {
    const ok = 'https://everyayah.com/data/Alafasy_128kbps/112001.mp3';
    expect(
      parseAction({
        type: 'play_all',
        urls: [ok, 'http://everyayah.com/x.mp3', 'https://evil.example/x.mp3'],
      }),
    ).toEqual({
      type: 'play_all',
      urls: [ok],
    });
    expect(parseAction({ type: 'play_all', urls: ['https://evil.example/x.mp3'] })).toBeNull();
    expect(parseAction({ type: 'play_ayah', ayah: 1, text: 't', url: ok })).toEqual({
      type: 'play_ayah',
      ayah: 1,
      text: 't',
      url: ok,
    });
    expect(parseAction({ type: 'play_ayah', ayah: 1, url: 'javascript:alert(1)' })).toBeNull();
  });

  it('ignores set_step and unknown actions', () => {
    expect(parseAction({ type: 'set_step', step: 3 })).toBeNull();
    expect(parseAction({ type: 'launch' })).toBeNull();
    expect(parseAction('show_ayat')).toBeNull();
  });

  it('safeAudioUrl accepts subdomains only of the reciter host', () => {
    expect(safeAudioUrl('https://www.everyayah.com/a.mp3')).toBe('https://www.everyayah.com/a.mp3');
    expect(safeAudioUrl('https://everyayah.com.evil.io/a.mp3')).toBeNull();
    expect(safeAudioUrl('not a url')).toBeNull();
  });
});

describe('other responses', () => {
  it('parseScore', () => {
    expect(parseScore({ available: false })).toEqual({ available: false, transcription: null });
    expect(parseScore({ available: true, transcription: ' قل هو الله ', score: 0.8 })).toEqual({
      available: true,
      transcription: 'قل هو الله',
    });
    expect(parseScore({ available: true, transcription: '' })).toEqual({
      available: true,
      transcription: null,
    });
    expect(parseScore('nope')).toEqual({ available: false, transcription: null });
  });

  it('parseReady keeps ready items only', () => {
    expect(
      parseReady({
        items: [
          { item_key: '112:0', ready: true, surah_no: 112, chunk: 0 },
          { item_key: '113:0', ready: false, surah_no: 113, chunk: 0 },
          { ready: true, hadith_id: 6 },
          { ready: true },
        ],
      }),
    ).toEqual([{ surahNo: 112, chunk: 0 }, { hadithId: 6 }]);
    expect(parseReady({})).toEqual([]);
  });

  it('parseCompletedHadith reads string or number ids', () => {
    expect(parseCompletedHadith({ quran: {}, hadith: { completed: ['6', 9, 'x'] } })).toEqual([6, 9]);
    expect(parseCompletedHadith({ completed_surahs: [] })).toEqual([]);
  });

  it('parseActionItems', () => {
    expect(
      parseActionItems({
        items: [{ hadith_id: 6, title: 'الغضب', action: 'اهدأ', done: true }, { title: 'x' }],
      }),
    ).toEqual([{ hadithId: 6, title: 'الغضب', action: 'اهدأ', done: true }]);
  });
});
