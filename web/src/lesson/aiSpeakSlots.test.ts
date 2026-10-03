// The ai-speak allow-lists (supabase/functions/ai-speak/slots.json, slots.en.json,
// slots.id.json) are exactly what our content + the bank's helpers produce — and never
// the child's name.
// Regenerate after a content change: UPDATE_AI_SPEAK_SLOTS=1 npx vitest run src/lesson/aiSpeakSlots.test.ts
import fs from 'node:fs';
import path from 'node:path';

import { QURANIC } from '../../../supabase/functions/ai-speak/resolve';
import { aiSpeakSlotAllowList, NAME_SLOT, slotKeysOf } from './aiSpeakSlots';
import { line, localizedSlots, TEACHER_LINES } from './teacherLines';
import type { LineLang } from './teacherLinesI18n';

const dir = path.resolve(__dirname, '../../../supabase/functions/ai-speak');
const LANGS: { lang: LineLang; file: string }[] = [
  { lang: 'ar', file: 'slots.json' },
  { lang: 'en', file: 'slots.en.json' },
  { lang: 'id', file: 'slots.id.json' },
];

test.each(LANGS)('$file equals the allow-list built from our content', ({ lang, file }) => {
  const built = aiSpeakSlotAllowList(lang);
  const p = path.join(dir, file);
  if (process.env.UPDATE_AI_SPEAK_SLOTS === '1') fs.writeFileSync(p, `${JSON.stringify(built, null, 2)}\n`);
  expect(JSON.parse(fs.readFileSync(p, 'utf8'))).toEqual(built);
});

test.each(LANGS)(
  '$lang: every slot of a server-voiced line has an allow-list; the name has none',
  ({ lang }) => {
    const allow = aiSpeakSlotAllowList(lang);
    expect(Object.keys(allow)).not.toContain(NAME_SLOT);
    for (const id of Object.keys(TEACHER_LINES)) {
      const keys = slotKeysOf(id);
      if (keys.includes(NAME_SLOT)) continue; // stays on the device
      for (const k of keys) expect(allow[k], `${id} {${k}}`).toBeDefined();
    }
  },
);

test.each(LANGS)(
  '$lang: allow-listed values carry no Quranic marks (the second check would refuse them)',
  ({ lang }) => {
    for (const [k, values] of Object.entries(aiSpeakSlotAllowList(lang))) {
      for (const v of values) expect(QURANIC.test(v), `${k}: ${v}`).toBe(false);
    }
  },
);

test('the values the client sends for en / id are in their allow-lists', () => {
  const ar = aiSpeakSlotAllowList('ar');
  for (const lang of ['en', 'id'] as const) {
    const allow = aiSpeakSlotAllowList(lang);
    for (const [key, values] of Object.entries(ar)) {
      for (const v of values) {
        const id = Object.keys(TEACHER_LINES).find(
          (x) => slotKeysOf(x).length === 1 && slotKeysOf(x)[0] === key,
        );
        if (!id) continue;
        const sent = localizedSlots(lang, line(id, { [key]: v }));
        if (sent) expect(allow[key], `${lang} ${key}: ${v}`).toContain(sent[key]);
      }
    }
  }
});
