// Firestore rules tests. Run from the repo root:
//   firebase emulators:exec -c firebase.test.json --only firestore --project nibras-59284 "node tool/rules_test/rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, Timestamp,
  query, where, collectionGroup,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = await initializeTestEnvironment({
  projectId: 'nibras-59284',
  firestore: {
    rules: fs.readFileSync(path.join(here, '..', '..', 'firestore.rules'), 'utf8'),
    // Set by `firebase emulators:exec` (see firebase.test.json for the ports).
    host: (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':')[0],
    port: +(process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':')[1],
  },
});

const alice = env.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
const bob = env.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
const anon = env.unauthenticatedContext().firestore();
const parent = (email) => ({ name: 'Parent', email, createdAt: serverTimestamp(), role: 'parent' });
const days = (n) => Timestamp.fromMillis(Date.now() + n * 86400000);
const sub = (plan, expiresInDays, extra = {}) => ({
  plan, status: 'active', provider: 'mock', startedAt: serverTimestamp(), expiresAt: days(expiresInDays), ...extra,
});
const subRef = (db, uid) => doc(db, `parents/${uid}/subscription/current`);

let pass = 0, fail = 0;
async function t(name, p) {
  try { await p; pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}

// ── parents/{uid} ──
await t('owner creates valid parent doc', assertSucceeds(setDoc(doc(alice, 'parents/alice'), parent('alice@example.com'))));
await t('owner reads own doc', assertSucceeds(getDoc(doc(alice, 'parents/alice'))));
await t('other user cannot read', assertFails(getDoc(doc(bob, 'parents/alice'))));
await t('signed-out cannot read', assertFails(getDoc(doc(anon, 'parents/alice'))));
await t('other user cannot write', assertFails(setDoc(doc(bob, 'parents/alice'), parent('bob@example.com'))));
await t('cannot create for another uid', assertFails(setDoc(doc(alice, 'parents/bob'), parent('alice@example.com'))));
await t('role must be parent', assertFails(setDoc(doc(bob, 'parents/bob'), { ...parent('bob@example.com'), role: 'admin' })));
await t('extra fields rejected', assertFails(setDoc(doc(bob, 'parents/bob'), { ...parent('bob@example.com'), isAdmin: true })));
await t('email must match token', assertFails(setDoc(doc(bob, 'parents/bob'), parent('alice@example.com'))));
await t('client createdAt rejected', assertFails(setDoc(doc(bob, 'parents/bob'), { ...parent('bob@example.com'), createdAt: new Date(0) })));
await t('owner updates name', assertSucceeds(updateDoc(doc(alice, 'parents/alice'), { name: 'Alice B' })));
await t('owner cannot change role', assertFails(updateDoc(doc(alice, 'parents/alice'), { role: 'admin' })));
await t('cannot list parents', assertFails(getDocs(collection(bob, 'parents'))));
await t('other collections denied (write)', assertFails(setDoc(doc(alice, 'children/x'), { a: 1 })));
await t('other collections denied (read)', assertFails(getDoc(doc(alice, 'children/x'))));

// ── parents/{uid}/subscription/current ──
await t('sub: no parent doc yet → denied', assertFails(setDoc(subRef(bob, 'bob'), sub('annual', 365))));
await t('sub: owner buys annual', assertSucceeds(setDoc(subRef(alice, 'alice'), sub('annual', 365))));
await t('sub: owner reads it', assertSucceeds(getDoc(subRef(alice, 'alice'))));
await t('sub: other user cannot read', assertFails(getDoc(subRef(bob, 'alice'))));
await t('sub: signed-out cannot read', assertFails(getDoc(subRef(anon, 'alice'))));
await t('sub: other user cannot write', assertFails(setDoc(subRef(bob, 'alice'), sub('annual', 365))));
// Length limits on a first purchase (bob has a parent doc but no subscription).
await t('sub: bob creates parent doc', assertSucceeds(setDoc(doc(bob, 'parents/bob'), parent('bob@example.com'))));
await t('sub: annual longer than 366 days → denied', assertFails(setDoc(subRef(bob, 'bob'), sub('annual', 400))));
await t('sub: monthly longer than 31 days → denied', assertFails(setDoc(subRef(bob, 'bob'), sub('monthly', 60))));
await t('sub: monthly 30 days → allowed', assertSucceeds(setDoc(subRef(bob, 'bob'), sub('monthly', 30))));
await t('sub: already expired → denied', assertFails(setDoc(subRef(alice, 'alice'), sub('monthly', -1))));
await t('sub: unknown plan → denied', assertFails(setDoc(subRef(alice, 'alice'), sub('lifetime', 30))));
await t('sub: provider must be mock', assertFails(setDoc(subRef(alice, 'alice'), sub('annual', 365, { provider: 'play' }))));
await t('sub: status must be active', assertFails(setDoc(subRef(alice, 'alice'), sub('annual', 365, { status: 'gift' }))));
await t('sub: client startedAt rejected', assertFails(setDoc(subRef(alice, 'alice'), sub('annual', 365, { startedAt: new Date(0) }))));
await t('sub: extra fields rejected', assertFails(setDoc(subRef(alice, 'alice'), sub('annual', 365, { price: 0 }))));
await t('sub: missing field rejected', assertFails(setDoc(subRef(alice, 'alice'), (({ provider, ...r }) => r)(sub('annual', 365)))));
await t('sub: only doc id "current"', assertFails(setDoc(doc(alice, 'parents/alice/subscription/other'), sub('annual', 365))));
await t('sub: cannot list subscriptions', assertFails(getDocs(collection(alice, 'parents/alice/subscription'))));
await t('sub: cannot delete', assertFails(deleteDoc(subRef(alice, 'alice'))));

// Renewal extends from the current expiry: seed 100 days left, then renew.
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'parents/alice/subscription/current'), {
    plan: 'annual', status: 'active', provider: 'mock', startedAt: Timestamp.now(), expiresAt: days(100),
  });
});
await t('sub: renewal = remaining 100 + 365 days', assertSucceeds(setDoc(subRef(alice, 'alice'), sub('annual', 100 + 365))));
await t('sub: renewal beyond remaining + period → denied', assertFails(setDoc(subRef(alice, 'alice'), sub('annual', 100 + 365 + 400))));

// ── parents/{uid}/children/{childId} ──
const schedule = (over = {}) => ({ days: ['sat', 'sun', 'mon', 'wed'], time: 1020, custom: { mon: 1050 }, duration: 45, reminder: true, ...over });
const child = (over = {}) => ({
  name: 'سارة', age: 10, gender: 'girl', avatar: 'g1', schedule: schedule(),
  ownerUid: 'alice', createdAt: serverTimestamp(), ...over,
});
const kidRef = (db, uid, id = 'kid1') => doc(db, `parents/${uid}/children/${id}`);

await t('child: owner creates valid child', assertSucceeds(setDoc(kidRef(alice, 'alice'), child())));
await t('child: owner reads it', assertSucceeds(getDoc(kidRef(alice, 'alice'))));
await t('child: owner lists own children', assertSucceeds(getDocs(collection(alice, 'parents/alice/children'))));
await t('child: other user cannot read', assertFails(getDoc(kidRef(bob, 'alice'))));
await t('child: other user cannot list', assertFails(getDocs(collection(bob, 'parents/alice/children'))));
await t('child: signed-out cannot read', assertFails(getDoc(kidRef(anon, 'alice'))));
await t('child: other user cannot create', assertFails(setDoc(kidRef(bob, 'alice', 'kid2'), child())));
await t('child: ownerUid must be the parent', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ ownerUid: 'bob' }))));
await t('child: client createdAt rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ createdAt: new Date(0) }))));
await t('child: extra field rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ email: 'x@y.z' }))));
await t('child: missing field rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), (({ avatar, ...r }) => r)(child()))));
await t('child: empty name rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ name: '' }))));
await t('child: 41-char name rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ name: 'ا'.repeat(41) }))));
await t('child: age 7 rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ age: 7 }))));
await t('child: age 14 rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ age: 14 }))));
await t('child: age as string rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ age: '10' }))));
await t('child: unknown gender rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ gender: 'x' }))));
await t('child: unknown avatar rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ avatar: 'z9' }))));
await t('child: no lesson days rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ schedule: schedule({ days: [] }) }))));
await t('child: unknown day rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ schedule: schedule({ days: ['sat', 'funday'] }) }))));
await t('child: time out of range rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ schedule: schedule({ time: 1440 }) }))));
await t('child: bad custom time rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ schedule: schedule({ custom: { mon: 5000 } }) }))));
await t('child: bad custom day rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ schedule: schedule({ custom: { someday: 60 } }) }))));
await t('child: duration 90 rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ schedule: schedule({ duration: 90 }) }))));
await t('child: extra schedule key rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ schedule: { ...schedule(), x: 1 } }))));
// Server-only fields: pairing (Functions), linkedDeviceUid, stats.
const exp = { code: '123456', expiresAt: days(1), status: 'active' };
await t('child: client cannot set pairing on create', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ pairing: exp }))));
await t('child: client cannot set linkedDeviceUid on create', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ linkedDeviceUid: 'dev' }))));
await t('child: client cannot set stats on create', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ stats: { ayat: 295 } }))));
await t('child: update name/schedule ok', assertSucceeds(updateDoc(kidRef(alice, 'alice'), { name: 'سارة أحمد', 'schedule.duration': 60 })));
await t('child: update keeps validation (age 20)', assertFails(updateDoc(kidRef(alice, 'alice'), { age: 20 })));
// Seed server fields as the Admin SDK would, then try to touch them as the parent.
await env.withSecurityRulesDisabled(async (ctx) => {
  await updateDoc(doc(ctx.firestore(), 'parents/alice/children/kid1'), { pairing: exp, linkedDeviceUid: 'dev1', stats: { ayat: 4 } });
});
await t('child: update with server fields present still ok', assertSucceeds(updateDoc(kidRef(alice, 'alice'), { name: 'سارة' })));
await t('child: cannot change pairing code', assertFails(updateDoc(kidRef(alice, 'alice'), { 'pairing.code': '000000' })));
await t('child: cannot extend pairing expiry', assertFails(updateDoc(kidRef(alice, 'alice'), { 'pairing.expiresAt': days(30) })));
await t('child: cannot change linkedDeviceUid', assertFails(updateDoc(kidRef(alice, 'alice'), { linkedDeviceUid: 'evil' })));
await t('child: cannot forge stats', assertFails(updateDoc(kidRef(alice, 'alice'), { 'stats.ayat': 295 })));
await t('child: cannot add a new field', assertFails(updateDoc(kidRef(alice, 'alice'), { note: 'x' })));
await t('child: cannot change ownerUid', assertFails(updateDoc(kidRef(alice, 'alice'), { ownerUid: 'bob' })));
await t('child: cannot change createdAt', assertFails(updateDoc(kidRef(alice, 'alice'), { createdAt: new Date(0) })));
await t('child: other user cannot delete', assertFails(deleteDoc(kidRef(bob, 'alice'))));
await t('child: owner deletes', assertSucceeds(deleteDoc(kidRef(alice, 'alice'))));
const carol = env.authenticatedContext('carol', { email: 'c@example.com' }).firestore();
await t('child: no parent doc → denied', assertFails(setDoc(kidRef(carol, 'carol', 'k'), child({ ownerUid: 'carol' }))));

// ── server-only collections: default deny for every client ──
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'pairingCodes/123456'), { parentUid: 'alice', childId: 'kid1', status: 'active' });
  await setDoc(doc(ctx.firestore(), 'childSessions/dev1'), { parentUid: 'alice', childId: 'kid1' });
});
const device = env.authenticatedContext('dev1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
for (const [who, db] of [['parent', alice], ['anonymous device', device], ['signed-out', anon]]) {
  await t(`pairingCodes: ${who} cannot read a code`, assertFails(getDoc(doc(db, 'pairingCodes/123456'))));
  await t(`pairingCodes: ${who} cannot list codes`, assertFails(getDocs(collection(db, 'pairingCodes'))));
  await t(`pairingCodes: ${who} cannot write a code`, assertFails(setDoc(doc(db, 'pairingCodes/654321'), { parentUid: 'alice', childId: 'kid1', status: 'active' })));
  await t(`childSessions: ${who} cannot write`, assertFails(setDoc(doc(db, 'childSessions/dev1'), { parentUid: 'alice', childId: 'kid1' })));
  await t(`rateLimits: ${who} cannot write`, assertFails(setDoc(doc(db, 'rateLimits/dev1'), { attempts: 0 })));
}
await t('child: anonymous device cannot read a child (not linked yet)', assertFails(getDoc(kidRef(device, 'alice'))));

// ── linked child device (claimPairingCode set linkedDeviceUid + childSessions/dev1) ──
await env.withSecurityRulesDisabled(async (ctx) => {
  const f = ctx.firestore();
  await setDoc(doc(f, 'parents/alice/children/kid9'), { ...child(), createdAt: Timestamp.now(), linkedDeviceUid: 'dev1' });
});
const device2 = env.authenticatedContext('dev2', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const anonAlice = env.authenticatedContext('alice', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
await t('device: linked device reads its child', assertSucceeds(getDoc(kidRef(device, 'alice', 'kid9'))));
await t('device: other device cannot read the child', assertFails(getDoc(kidRef(device2, 'alice', 'kid9'))));
await t('device: cannot list the parent\'s children', assertFails(getDocs(collection(device, 'parents/alice/children'))));
await t('device: cannot update its child', assertFails(updateDoc(kidRef(device, 'alice', 'kid9'), { name: 'x' })));
await t('device: cannot unlink/relink itself', assertFails(updateDoc(kidRef(device, 'alice', 'kid9'), { linkedDeviceUid: 'dev2' })));
await t('device: cannot delete its child', assertFails(deleteDoc(kidRef(device, 'alice', 'kid9'))));
await t('device: cannot read the parent doc', assertFails(getDoc(doc(device, 'parents/alice'))));
await t('device: cannot read the subscription', assertFails(getDoc(subRef(device, 'alice'))));
await t('device: reads its own session', assertSucceeds(getDoc(doc(device, 'childSessions/dev1'))));
await t('device: cannot read another session', assertFails(getDoc(doc(device2, 'childSessions/dev1'))));
await t('device: cannot list sessions', assertFails(getDocs(collection(device, 'childSessions'))));
await t('parent: cannot read a device session', assertFails(getDoc(doc(alice, 'childSessions/dev1'))));
await t('anonymous user with a parent uid is not the owner', assertFails(getDoc(doc(anonAlice, 'parents/alice'))));
await t('anonymous user cannot create a child', assertFails(setDoc(kidRef(anonAlice, 'alice', 'k2'), child())));

// ── progress/{lessonId} (child device checkpoints) ──
const progRef = (db, id = 'm01-w03-ikhlas') => doc(db, `parents/alice/children/kid9/progress/${id}`);
const prog = (over = {}) => ({
  lessonId: 'm01-w03-ikhlas', stepIndex: 2, doneRefs: ['112:1'], surahsCompleted: [], hadithDone: [],
  projectAssigned: null, reportedProject: null, completed: false,
  startedAt: serverTimestamp(), updatedAt: serverTimestamp(), ...over,
});
await t('progress: linked device creates', assertSucceeds(setDoc(progRef(device), prog())));
let started;
await env.withSecurityRulesDisabled(async (c) => {
  started = (await getDoc(doc(c.firestore(), 'parents/alice/children/kid9/progress/m01-w03-ikhlas'))).data().startedAt;
});
await t('progress: linked device updates', assertSucceeds(setDoc(progRef(device), prog({ stepIndex: 3, startedAt: started }))));
await t('progress: startedAt is fixed', assertFails(setDoc(progRef(device), prog({ stepIndex: 4, startedAt: Timestamp.fromMillis(0) }))));
await t('progress: parent reads', assertSucceeds(getDoc(progRef(alice))));
await t('progress: parent cannot write', assertFails(setDoc(progRef(alice, 'x'), prog({ lessonId: 'x' }))));
await t('progress: other device cannot write', assertFails(setDoc(progRef(device2, 'm01-w03-day2'), prog({ lessonId: 'm01-w03-day2' }))));
await t('progress: other device cannot read', assertFails(getDoc(progRef(device2))));
await t('progress: lessonId must match doc id', assertFails(setDoc(progRef(device, 'm01-w03-day2'), prog())));
await t('progress: extra field rejected', assertFails(setDoc(progRef(device, 'm01-w03-day2'), prog({ lessonId: 'm01-w03-day2', ayat: 295 }))));
await t('progress: client updatedAt rejected', assertFails(setDoc(progRef(device, 'm01-w03-day2'), prog({ lessonId: 'm01-w03-day2', updatedAt: new Date(0) }))));
await t('progress: stepIndex bounded', assertFails(setDoc(progRef(device, 'm01-w03-day2'), prog({ lessonId: 'm01-w03-day2', stepIndex: 500 }))));
await t('progress: bad lesson id rejected', assertFails(setDoc(progRef(device, 'BAD_ID!'), prog({ lessonId: 'BAD_ID!' }))));
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), 'parents/alice/children/kid9/progress/done'), { ...prog({ lessonId: 'done', completed: true }), startedAt: Timestamp.now(), updatedAt: Timestamp.now() });
});
await t('progress: finished lesson cannot be un-finished', assertFails(updateDoc(progRef(device, 'done'), { completed: false, updatedAt: serverTimestamp() })));
await t('progress: device cannot delete', assertFails(deleteDoc(progRef(device))));

// ── submissions/{id} (project report) ──
const subDoc = (db, id = 's1') => doc(db, `parents/alice/children/kid9/submissions/${id}`);
const submission = (id = 's1', over = {}) => ({
  projectId: 'birr-3-acts', lessonId: 'm01-w03-day2', storagePath: `recordings/alice/kid9/${id}.m4a`,
  durationMs: 12000, createdAt: serverTimestamp(), ...over,
});
await t('submission: linked device creates', assertSucceeds(setDoc(subDoc(device), submission())));
await t('submission: parent reads', assertSucceeds(getDoc(subDoc(alice))));
await t('submission: parent lists', assertSucceeds(getDocs(collection(alice, 'parents/alice/children/kid9/submissions'))));
await t('submission: device cannot read back', assertFails(getDoc(subDoc(device))));
await t('submission: device cannot update', assertFails(updateDoc(subDoc(device), { durationMs: 5000 })));
await t('submission: other device cannot create', assertFails(setDoc(subDoc(device2, 's2'), submission('s2'))));
await t('submission: parent cannot create', assertFails(setDoc(subDoc(alice, 's3'), submission('s3'))));
await t('submission: storagePath must be its own file', assertFails(setDoc(subDoc(device, 's4'), submission('s4', { storagePath: 'recordings/alice/kid9/other.m4a' }))));
await t('submission: other child path rejected', assertFails(setDoc(subDoc(device, 's5'), submission('s5', { storagePath: 'recordings/bob/kid1/s5.m4a' }))));
await t('submission: too long rejected', assertFails(setDoc(subDoc(device, 's6'), submission('s6', { durationMs: 999999 }))));
await t('submission: extra field rejected', assertFails(setDoc(subDoc(device, 's7'), submission('s7', { text: 'x' }))));
await t('submission: parent deletes', assertSucceeds(deleteDoc(subDoc(alice))));

// ── leaderboard (anonymous): no child can learn another child's identity ──
await env.withSecurityRulesDisabled(async (c) => {
  const f = c.firestore();
  await setDoc(doc(f, 'leaderboard/current'), { weekKey: '2026-09-19', total: 2, rows: [{ rank: 1, points: 420 }, { rank: 2, points: 10 }], updatedAt: Timestamp.now() });
  await setDoc(doc(f, 'parents/bob/children/kidB'), { name: 'يوسف', avatar: 'b2', ownerUid: 'bob', linkedDeviceUid: 'devB',
    stats: { weekKey: '2026-09-19', weekPoints: 420 }, leader: { rank: 1, points: 420, total: 2, topPercent: 50, gapToAbove: null } });
});
await t('leaderboard: linked child device reads the board', assertSucceeds(getDoc(doc(device, 'leaderboard/current'))));
await t('leaderboard: board rows carry rank + points only', (async () => {
  const board = await getDoc(doc(device, 'leaderboard/current'));
  for (const r of board.data().rows) {
    if (Object.keys(r).sort().join() !== 'points,rank') throw new Error('extra keys in row: ' + Object.keys(r));
  }
  if (Object.keys(board.data()).sort().join() !== 'rows,total,updatedAt,weekKey') throw new Error('extra board keys');
})());
await t('leaderboard: device cannot list leaderboard docs', assertFails(getDocs(collection(device, 'leaderboard'))));
await t('leaderboard: device cannot read other board docs', assertFails(getDoc(doc(device, 'leaderboard/2026-09-19'))));
await t('leaderboard: device cannot write the board', assertFails(setDoc(doc(device, 'leaderboard/current'), { rows: [] })));
await t('leaderboard: parent cannot write the board', assertFails(setDoc(doc(alice, 'leaderboard/current'), { rows: [] })));
await t('leaderboard: signed-out cannot read the board', assertFails(getDoc(doc(anon, 'leaderboard/current'))));
await t("leaderboard: device cannot read the top child's doc (name/avatar/leader)", assertFails(getDoc(doc(device, 'parents/bob/children/kidB'))));
await t('leaderboard: device cannot query children across families', assertFails(getDocs(query(collectionGroup(device, 'children'), where('stats.weekKey', '==', '2026-09-19')))));
await t('leaderboard: device cannot query other children by points', assertFails(getDocs(query(collection(device, 'parents/bob/children'), where('stats.weekPoints', '>', 0)))));
await t('leaderboard: device reads only its own standing', assertSucceeds(getDoc(kidRef(device, 'alice', 'kid9'))));
await t('leaderboard: parent cannot set leader on a child', assertFails(updateDoc(kidRef(alice, 'alice', 'kid9'), { leader: { rank: 1 } })));
await t('leaderboard: parent cannot set week points', assertFails(updateDoc(kidRef(alice, 'alice', 'kid9'), { 'stats.weekPoints': 9999 })));
await t('leaderboard: device cannot set its own points', assertFails(updateDoc(kidRef(device, 'alice', 'kid9'), { 'stats.weekPoints': 9999 })));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
