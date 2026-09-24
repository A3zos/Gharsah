// Shared setup for tool/seed_demo.ts and tool/remove_demo.ts (run from app/:
//   node tool/seed_demo.ts   ·   node tool/remove_demo.ts
// Node 24 runs this TypeScript directly).
//
// Credentials — NEVER a committed key: GOOGLE_APPLICATION_CREDENTIALS /
// application-default credentials when set, otherwise your own Firebase CLI
// login (`firebase login`), read at runtime from the CLI's local store.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

// firebase-admin (and the compiled stats code) come from app/functions.
export const req = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, applicationDefault } = req('firebase-admin/app');
export const { getAuth } = req('firebase-admin/auth');
export const { getFirestore, Timestamp, FieldValue } = req('firebase-admin/firestore');
export const { getStorage } = req('firebase-admin/storage');

export const PROJECT = 'nibras-59284';
export const BUCKET = 'nibras-59284.firebasestorage.app';

/// The demo account (for testing and the judging committee). Everything it
/// creates carries isDemo: true. Remove or rotate before public launch.
export const DEMO = {
  email: 'demo@gharsah.app',
  password: 'Gharsah@2026',
  parentName: 'وليّ أمر تجريبي',
  childId: 'demo-abdullah',
  childName: 'عبدالله',
  code: '472918',
  historyLessonId: 'demo-history',
  submissionId: 'demo-report-1',
} as const;

/// Your Firebase CLI login as a temporary application-default credential file
/// in the OS temp folder (Firestore's client only takes ADC or a service
/// account). The file is deleted when the script exits; nothing is committed.
function useCliLoginAsAdc() {
  const store = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(store)) throw new Error('No Firebase CLI login found — run `firebase login` first.');
  const refresh = JSON.parse(fs.readFileSync(store, 'utf8'))?.tokens?.refresh_token;
  if (!refresh) throw new Error('Firebase CLI is not logged in — run `firebase login` first.');
  const cli = path.join(execSync('npm root -g').toString().trim(), 'firebase-tools', 'lib', 'api.js');
  const api = req(cli);
  const file = path.join(os.tmpdir(), `gharsah-adc-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify({
    type: 'authorized_user',
    client_id: api.clientId(),
    client_secret: api.clientSecret(),
    refresh_token: refresh,
    quota_project_id: PROJECT,
  }), { mode: 0o600 });
  const cleanup = () => { try { fs.unlinkSync(file); } catch { /* already gone */ } };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = file;
}

export function adminApp() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) useCliLoginAsAdc();
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT, storageBucket: BUCKET });
}

/// True when the Storage bucket exists (Firebase Storage set up in the console).
export async function bucketReady(): Promise<boolean> {
  try {
    const [ok] = await getStorage().bucket().exists();
    return ok;
  } catch {
    return false;
  }
}
