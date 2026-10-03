// The AI lesson's fixed client lines: Arabic byte-identical to the constants; English /
// Indonesian for every line (both genders), never Arabic or Quranic text.
import { QURANIC } from '../../../../supabase/functions/ai-speak/resolve';
import {
  FIXED_LINES,
  fixedLine,
  HADITH_LATER,
  MOVE_ON_UNREPEATED,
  NUDGE_ANSWER,
  NUDGE_REPEAT,
  REPEATS_START,
  REPEATS_START_REPLY,
  TO_HADITH,
  WHOLE_SURAH_TURN,
  type FixedLine,
} from './serverLesson';

const KEYS = Object.keys(FIXED_LINES.ar) as FixedLine[];

test('Arabic: exactly the constants', () => {
  for (const g of ['boy', 'girl'] as const) {
    expect(fixedLine('ar', 'nudgeAnswer', g)).toBe(NUDGE_ANSWER[g]);
    expect(fixedLine('ar', 'nudgeRepeat', g)).toBe(NUDGE_REPEAT[g]);
    expect(fixedLine('ar', 'repeatsStart', g)).toBe(REPEATS_START[g]);
    expect(fixedLine('ar', 'wholeSurahTurn', g)).toBe(WHOLE_SURAH_TURN[g]);
    expect(fixedLine('ar', 'moveOnUnrepeated', g)).toBe(MOVE_ON_UNREPEATED);
    expect(fixedLine('ar', 'repeatsStartReply', g)).toBe(REPEATS_START_REPLY);
    expect(fixedLine('ar', 'toHadith', g)).toBe(TO_HADITH);
    expect(fixedLine('ar', 'hadithLater', g)).toBe(HADITH_LATER);
  }
});

test.each(['en', 'id'] as const)('%s: every fixed line, for both genders, in that language', (lang) => {
  expect(Object.keys(FIXED_LINES[lang]).sort()).toEqual([...KEYS].sort());
  for (const k of KEYS) {
    for (const g of ['boy', 'girl'] as const) {
      const t = fixedLine(lang, k, g);
      expect(t.length, `${lang} ${k}`).toBeGreaterThan(0);
      expect(/[؀-ۿ]/.test(t), `${lang} ${k}: no Arabic`).toBe(false);
      expect(QURANIC.test(t)).toBe(false);
    }
  }
});
