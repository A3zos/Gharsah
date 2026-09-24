// Firestore rules tests. Run from the repo root:
//   firebase emulators:exec --only firestore --project nibras-59284 "node tool/rules_test/rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, Timestamp,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = await initializeTestEnvironment({
  projectId: 'nibras-59284',
  firestore: {
    rules: fs.readFileSync(path.join(here, '..', '..', 'firestore.rules'), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
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
  pairing: { code: '472918', provider: 'mock' }, ownerUid: 'alice', createdAt: serverTimestamp(), ...over,
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
await t('child: 5-digit code rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ pairing: { code: '12345', provider: 'mock' } }))));
await t('child: letters in code rejected', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ pairing: { code: '12a456', provider: 'mock' } }))));
await t('child: provider must be mock', assertFails(setDoc(kidRef(alice, 'alice', 'k'), child({ pairing: { code: '123456', provider: 'server' } }))));
await t('child: update name/schedule ok', assertSucceeds(updateDoc(kidRef(alice, 'alice'), { name: 'سارة أحمد', 'schedule.duration': 60 })));
await t('child: cannot change pairing code', assertFails(updateDoc(kidRef(alice, 'alice'), { 'pairing.code': '000000' })));
await t('child: cannot change ownerUid', assertFails(updateDoc(kidRef(alice, 'alice'), { ownerUid: 'bob' })));
await t('child: cannot change createdAt', assertFails(updateDoc(kidRef(alice, 'alice'), { createdAt: new Date(0) })));
await t('child: other user cannot delete', assertFails(deleteDoc(kidRef(bob, 'alice'))));
await t('child: owner deletes', assertSucceeds(deleteDoc(kidRef(alice, 'alice'))));
const carol = env.authenticatedContext('carol', { email: 'c@example.com' }).firestore();
await t('child: no parent doc → denied', assertFails(setDoc(kidRef(carol, 'carol', 'k'), child({ ownerUid: 'carol' }))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
