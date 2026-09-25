// The interim teacher-line bank exists twice (Dart + TS) until the AI developer's
// reviewed bank replaces both. This fails if the two copies ever differ.
import fs from 'node:fs';
import path from 'node:path';

import { TEACHER_CAPTIONS, TEACHER_LINES } from './teacherLines';

const dartFile = path.resolve(__dirname, '../../../app/lib/features/lesson/ai/teacher_lines.dart');

function dartMap(src: string, name: string): Record<string, string> {
  const start = src.indexOf(`static const Map<String, String> ${name} = {`);
  const body = src.slice(start, src.indexOf('};', start));
  const out: Record<string, string> = {};
  // 'id':\n?  'text',   (the Dart formatter may wrap the value onto the next line)
  for (const m of body.matchAll(/'([^']+)':\s*'([^']*)'/g)) out[m[1]!] = m[2]!;
  return out;
}

test('TS teacher lines and captions equal the Flutter bank', () => {
  const src = fs.readFileSync(dartFile, 'utf8');
  expect(TEACHER_LINES).toEqual(dartMap(src, 'lines'));
  expect(TEACHER_CAPTIONS).toEqual(dartMap(src, 'captions'));
});
