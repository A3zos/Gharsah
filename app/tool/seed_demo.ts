// Seeds the permanent DEMO account on nibras-59284 (idempotent — safe to re-run;
// a re-run also resets the demo child's lesson progress so the live lesson can
// be tried again). Run from app/:  node tool/seed_demo.ts
//
//   Parent: demo@gharsah.app / Gharsah@2026 (email verified), active mock yearly plan
//   Child:  «عبدالله», 10, boy — pairing code 472918 (isDemo: never expires,
//           several devices; enforced only in the claimPairingCode Function)
//   History: Al-Ikhlas + the برّ الوالدين hadith done, a 3-day streak, one
//           project report with a PLACEHOLDER recording.
// Every demo doc carries isDemo: true. Undo with: node tool/remove_demo.ts
import { execSync } from 'node:child_process';

import {
  adminApp, bucketReady, DEMO, FieldValue, getAuth, getFirestore, getStorage, req, Timestamp,
} from './demo_admin.ts';

const DAY = 86400_000;
const now = new Date();
const ago = (days: number) => Timestamp.fromMillis(now.getTime() - days * DAY);
const FAR = Timestamp.fromDate(new Date('2100-01-01T00:00:00Z'));
const SCHEDULE = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'];

/// A clearly-marked placeholder recording: 1.5 s soft tone, 16 kHz mono WAV.
function placeholderWav(): Buffer {
  const rate = 16000, n = Math.round(rate * 1.5);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 800, (n - i) / 800);
    pcm.writeInt16LE(Math.round(2500 * fade * Math.sin((2 * Math.PI * 440 * i) / rate)), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/// The last `count` scheduled days before today (Riyadh), oldest first.
function previousScheduledDays(count: number): string[] {
  const keys: string[] = [];
  const week = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  for (let d = 1; keys.length < count && d < 30; d++) {
    const local = new Date(now.getTime() + 3 * 3600_000 - d * DAY);
    if (SCHEDULE.includes(week[local.getUTCDay()])) keys.unshift(local.toISOString().slice(0, 10));
  }
  return keys;
}

async function main() {
  // The dashboard numbers come from the same code the Functions run.
  execSync('npm --prefix functions run build', { stdio: 'ignore' });
  const { computeStats } = req('./lib/src/stats.js');

  adminApp();
  const auth = getAuth();
  const db = getFirestore();

  // 1 · Parent account (email pre-verified).
  let uid: string;
  try {
    const u = await auth.getUserByEmail(DEMO.email);
    uid = u.uid;
    await auth.updateUser(uid, { password: DEMO.password, emailVerified: true, displayName: DEMO.parentName, disabled: false });
    console.log('parent: updated', uid);
  } catch (e: any) {
    if (e?.code !== 'auth/user-not-found') throw e;
    uid = (await auth.createUser({ email: DEMO.email, password: DEMO.password, emailVerified: true, displayName: DEMO.parentName })).uid;
    console.log('parent: created', uid);
  }
  const parentRef = db.doc(`parents/${uid}`);
  const parent = await parentRef.get();
  await parentRef.set({
    name: DEMO.parentName, email: DEMO.email, role: 'parent', isDemo: true,
    createdAt: parent.get('createdAt') ?? ago(30),
  });
  await db.doc(`parents/${uid}/subscription/current`).set({
    plan: 'annual', status: 'active', provider: 'mock', isDemo: true,
    startedAt: ago(30), expiresAt: Timestamp.fromMillis(now.getTime() + 335 * DAY),
  });

  // 2 · Pairing code 472918 — refuse to take over a real child's live code.
  const codeRef = db.doc(`pairingCodes/${DEMO.code}`);
  const existing = await codeRef.get();
  if (existing.exists && existing.get('isDemo') !== true && existing.get('status') === 'active'
      && (existing.get('expiresAt') as any)?.toMillis() > now.getTime()) {
    throw new Error(`Code ${DEMO.code} is in use by a real child — aborting.`);
  }
  await codeRef.set({
    parentUid: uid, childId: DEMO.childId, status: 'active', isDemo: true,
    createdAt: ago(30), expiresAt: FAR,
  });

  // 3 · Child «عبدالله».
  const childRef = db.doc(`parents/${uid}/children/${DEMO.childId}`);
  const child = await childRef.get();
  await childRef.set({
    name: DEMO.childName, age: 10, gender: 'boy', avatar: 'b1',
    schedule: { days: SCHEDULE, time: 17 * 60, custom: {}, duration: 45, reminder: true },
    ownerUid: uid, createdAt: child.get('createdAt') ?? ago(30), isDemo: true,
    pairing: { code: DEMO.code, expiresAt: FAR, status: 'active' },
    ...(child.get('linkedDeviceUid') ? { linkedDeviceUid: child.get('linkedDeviceUid') } : {}),
  });

  // Reset the live lessons (so the demo child can take the Al-Ikhlas lesson).
  for (const d of (await childRef.collection('progress').get()).docs) {
    if (d.id !== DEMO.historyLessonId) await d.ref.delete();
  }

  // 4 · History: past lessons under their own id (not the live lesson ids).
  await childRef.collection('progress').doc(DEMO.historyLessonId).set({
    lessonId: DEMO.historyLessonId, stepIndex: 0,
    doneRefs: ['112:1', '112:2', '112:3', '112:4'], surahsCompleted: [112],
    hadithDone: ['PLACEHOLDER-birr-alwalidayn'],
    projectAssigned: 'birr-3-acts', reportedProject: 'birr-3-acts',
    completed: true, startedAt: ago(3), updatedAt: ago(1), isDemo: true,
  });

  // 5 · One project report with a PLACEHOLDER recording (needs Storage).
  const subRef = childRef.collection('submissions').doc(DEMO.submissionId);
  const storagePath = `recordings/${uid}/${DEMO.childId}/${DEMO.submissionId}.wav`;
  if (await bucketReady()) {
    await getStorage().bucket().file(storagePath).save(placeholderWav(), {
      contentType: 'audio/wav',
      metadata: { metadata: { isDemo: 'true', note: 'PLACEHOLDER demo recording — not a real child' } },
    });
    await subRef.set({
      projectId: 'birr-3-acts', lessonId: DEMO.historyLessonId, storagePath,
      durationMs: 1500, createdAt: ago(1), isDemo: true,
    });
    console.log('recording: uploaded placeholder', storagePath);
  } else {
    await subRef.delete();
    console.warn('recording: SKIPPED — Firebase Storage is not set up on the project yet.');
  }

  // 6 · Stats (streak over the last 3 scheduled days) — same code as the trigger.
  const [progress, subs] = await Promise.all([childRef.collection('progress').get(), childRef.collection('submissions').get()]);
  const stats = computeStats({
    progress: progress.docs.map((d: any) => d.data()),
    submissions: subs.docs.map((d: any) => ({ projectId: d.get('projectId') })),
    prev: { lessonDays: previousScheduledDays(3), surahsDone: [{ surah: 112, at: ago(3) }], hadithDone: [{ id: 'PLACEHOLDER-birr-alwalidayn', at: ago(3) }] },
    scheduleDays: SCHEDULE,
    completedNow: false,
    now,
  });
  await childRef.update({ stats, leader: FieldValue.delete() });

  console.log(`\nDEMO ready\n  parent: ${DEMO.email} / ${DEMO.password}\n  child code: ${DEMO.code}\n  stats: ayat ${stats.ayat}, surahs ${stats.surahs}, hadith ${stats.hadith}, projects ${stats.projects}, streak ${stats.streak}`);
}

main().then(() => process.exit(0), (e) => {
  console.error('seed failed:', e?.message ?? e);
  process.exit(1);
});
