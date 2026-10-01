// The ai-speak allow-list (supabase/functions/ai-speak/slots.json) is exactly what
// our content + the bank's helpers produce — and never the child's name.
// Regenerate after a content change: UPDATE_AI_SPEAK_SLOTS=1 npx vitest run src/lesson/aiSpeakSlots.test.ts
import fs from 'node:fs';
import path from 'node:path';

import { QURANIC } from '../../../supabase/functions/ai-speak/resolve';
import { aiSpeakSlotAllowList, NAME_SLOT, slotKeysOf } from './aiSpeakSlots';
import { TEACHER_LINES } from './teacherLines';

const file = path.resolve(__dirname, '../../../supabase/functions/ai-speak/slots.json');

test('slots.json equals the allow-list built from our content', () => {
  const built = aiSpeakSlotAllowList();
  if (process.env.UPDATE_AI_SPEAK_SLOTS === '1') {
    fs.writeFileSync(file, `${JSON.stringify(built, null, 2)}\n`);
  }
  expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(built);
});

test('every slot of a server-voiced line has an allow-list; the name has none', () => {
  const allow = aiSpeakSlotAllowList();
  expect(Object.keys(allow)).not.toContain(NAME_SLOT);
  for (const id of Object.keys(TEACHER_LINES)) {
    const keys = slotKeysOf(id);
    if (keys.includes(NAME_SLOT)) continue; // stays on the device
    for (const k of keys) expect(allow[k], `${id} {${k}}`).toBeDefined();
  }
});

test('allow-listed values carry no Quranic marks (the second check would refuse them)', () => {
  for (const [k, values] of Object.entries(aiSpeakSlotAllowList())) {
    for (const v of values) expect(QURANIC.test(v), `${k}: ${v}`).toBe(false);
  }
});
