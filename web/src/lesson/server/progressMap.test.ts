import { describe, expect, it } from 'vitest';

import { parseTurn } from './parse';
import { normalizeArabic } from './serverLesson';
import { doneRefsOf, hadithMatchesTopic, mappedStage } from './progressMap';
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

// One row per pilot day: the surah part fills the first stages, then «hadith»; the
// hadith session finishes the day.
describe('mappedStage (the day ladder)', () => {
  it.each([
    ['greet', 'listen_full'],
    ['tafsir', 'listen_full'],
    ['recitation', 'ayah_repeat'],
    ['tajweed', 'full_twice'],
    ['plan', 'hadith'],
    ['done', 'hadith'],
  ])('quran %s → %s', (stage, want) => {
    expect(mappedStage(turn('quran', stage, stage))).toBe(want);
  });

  it.each([
    ['greet', 'hadith'],
    ['memorize', 'hadith'],
    ['project', 'hadith'],
    ['done', 'done'],
  ])('hadith %s → %s', (stage, want) => {
    expect(mappedStage(turn('hadith', stage, stage))).toBe(want);
  });

  it('after a jump back, the furthest stage reached is kept (stages never go backwards)', () => {
    expect(mappedStage(turn('quran', 'fadl', 'tajweed'))).toBe('full_twice');
    expect(mappedStage(turn('hadith', 'text', 'done'))).toBe('done');
  });

  it('review sessions write nothing', () => {
    expect(
      mappedStage(
        parseTurn({ session_id: 's', kind: 'taseem', stages: [{ id: '0', label: 'الآية 1' }] }, 'quran'),
      ),
    ).toBeNull();
  });
});

describe('hadithMatchesTopic', () => {
  const m = (title: string, topic: string) => hadithMatchesTopic(title, topic, normalizeArabic);
  it('matches the day topic in any spelling or form', () => {
    expect(m('بر الوالدين', 'برّ الوالدين')).toBe(true);
    expect(m('حديث: برّ الوالدين', 'برّ الوالدين')).toBe(true);
    expect(m('الكذب', 'الكذب')).toBe(true);
    expect(m('لا تغضب', 'الغضب')).toBe(true);
  });
  it('rejects another topic', () => {
    expect(m('الكذب', 'برّ الوالدين')).toBe(false);
    expect(m('بر الوالدين', 'الغضب')).toBe(false);
    expect(m('الصدقة', 'الكذب')).toBe(false);
  });
});

describe('doneRefsOf', () => {
  it('the recited ayat while learning, the whole surah once its part is done', () => {
    const t = turn('quran', 'recitation', 'recitation', {
      surah_no: 112,
      recitation_scores: [{ ayah: 1 }, { ayah: 2 }],
    });
    expect(doneRefsOf(t, 'ayah_repeat', 112, () => 4)).toEqual(['112:1', '112:2']);
    expect(doneRefsOf(t, 'hadith', 112, () => 4)).toEqual(['112:1', '112:2', '112:3', '112:4']);
  });
  it('the hadith session keeps the day surah; before recitation nothing', () => {
    expect(doneRefsOf(turn('hadith', 'memorize', 'memorize'), 'hadith', 114, () => 6)).toEqual([]);
    expect(doneRefsOf(turn('hadith', 'done', 'done'), 'done', 114, () => 6)).toHaveLength(6);
    expect(doneRefsOf(turn('quran', 'greet', 'greet'), 'listen_full', 112, () => 4)).toEqual([]);
  });
});
