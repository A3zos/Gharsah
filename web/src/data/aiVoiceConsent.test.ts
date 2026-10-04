import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { childFromRow } from './children';

test('children.ai_voice_consent is still read, but gates nothing: the lesson always hears the child', () => {
  const row = childFromRow({
    id: 'c1',
    name: 'راكان',
    gender: 'boy',
    avatar: 'boy-1',
    ai_voice_consent: false,
  });
  expect(row.aiVoiceConsent).toBe(false);
  // the lesson wiring never looks at it (PO, 2026-10-04 — disclosed at sign-up instead)
  for (const f of ['../components/lesson/ServerLessonCall.tsx', '../lesson/web/createServerLesson.ts']) {
    expect(readFileSync(resolve(__dirname, f), 'utf-8')).not.toMatch(/aiVoiceConsent|consent:/);
  }
});
