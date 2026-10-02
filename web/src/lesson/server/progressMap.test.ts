import { describe, expect, it } from 'vitest';

import { parseTurn } from './parse';
import { doneRefsOf, hadithLessonId, mappedStage, quranLessonId } from './progressMap';
import { HADITH_STAGES, QURAN_STAGES } from './testing/fakeServer';

const turn = (mode: 'quran' | 'hadith', stage: string, max: string, extra: Record<string, unknown> = {}) => {
  const stages = (mode === 'quran' ? QURAN_STAGES : HADITH_STAGES).map((s) => ({ id: s.id, label: s.label }));
  return parseTurn(
    {
      session_id: 's',
      stage,
      stage_index: stages.findIndex((s) => s.id === stage),
      max_stage_index: stages.findIndex((s) => s.id === max),
      stages,
      ...extra,
    },
    mode,
  );
};

describe('mappedStage', () => {
  it.each([
    ['greet', 'listen_full'],
    ['tafsir', 'listen_full'],
    ['recitation', 'ayah_repeat'],
    ['tajweed', 'full_twice'],
    ['plan', 'hadith'],
    ['done', 'done'],
  ])('quran %s → %s', (stage, want) => {
    expect(mappedStage(turn('quran', stage, stage))).toBe(want);
  });

  it.each([
    ['text', 'listen_full'],
    ['memorize', 'ayah_repeat'],
    ['quiz', 'full_twice'],
    ['project', 'hadith'],
    ['done', 'done'],
  ])('hadith %s → %s', (stage, want) => {
    expect(mappedStage(turn('hadith', stage, stage))).toBe(want);
  });

  it('after a jump back, the furthest stage reached is kept (stages never go backwards)', () => {
    expect(mappedStage(turn('quran', 'fadl', 'tajweed'))).toBe('full_twice');
  });

  it('review sessions write nothing', () => {
    expect(
      mappedStage(
        parseTurn({ session_id: 's', kind: 'taseem', stages: [{ id: '0', label: 'الآية 1' }] }, 'quran'),
      ),
    ).toBeNull();
  });
});

describe('lesson ids', () => {
  it('pilot surahs and the Fatiha intro; others none', () => {
    expect([1, 112, 113, 114, 2, null].map(quranLessonId)).toEqual([
      'surah-1',
      'surah-112',
      'surah-113',
      'surah-114',
      null,
      null,
    ]);
  });
  it('pilot hadith ids → our catalogue', () => {
    expect([9, 10, 6, 1, null].map(hadithLessonId)).toEqual([
      'hadith-birr-alwalidayn',
      'hadith-al-kadhib',
      'hadith-al-ghadab',
      null,
      null,
    ]);
  });
});

describe('doneRefsOf', () => {
  it('the recited ayat while learning, the whole surah once done', () => {
    const t = turn('quran', 'recitation', 'recitation', {
      surah_no: 112,
      recitation_scores: [{ ayah: 1 }, { ayah: 2 }],
    });
    expect(doneRefsOf(t, 'ayah_repeat', () => 4)).toEqual(['112:1', '112:2']);
    expect(doneRefsOf(t, 'done', () => 4)).toEqual(['112:1', '112:2', '112:3', '112:4']);
  });
  it('nothing for hadith or an unknown surah', () => {
    expect(doneRefsOf(turn('hadith', 'done', 'done'), 'done', () => 4)).toEqual([]);
    expect(doneRefsOf(turn('quran', 'greet', 'greet'), 'listen_full', () => 4)).toEqual([]);
  });
});
