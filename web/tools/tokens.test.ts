import { execFileSync } from 'node:child_process';
import path from 'node:path';

// tokens/design-tokens.json is the single source for both apps; this fails if
// the generated Dart / CSS / TS files were edited by hand or not regenerated.
test('generated design-token files are up to date', () => {
  const script = path.resolve(__dirname, '../../tokens/build.mjs');
  expect(() => execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' })).not.toThrow();
});
