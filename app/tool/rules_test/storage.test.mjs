// Storage rules tests. Run from app/:
//   tool/emu_test.sh firestore,storage "node tool/rules_test/storage.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject, getDownloadURL, listAll, updateMetadata } from 'firebase/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const hostPort = (v, d) => { const [h, p] = (v ?? d).split(':'); return { host: h, port: +p }; };
const env = await initializeTestEnvironment({
  projectId: 'nibras-59284',
  firestore: {
    rules: fs.readFileSync(path.join(here, '..', '..', 'firestore.rules'), 'utf8'),
    ...hostPort(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8180'),
  },
  storage: {
    rules: fs.readFileSync(path.join(here, '..', '..', 'storage.rules'), 'utf8'),
    ...hostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9299'),
  },
});

await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), 'parents/alice/children/kid1'), { name: 'سارة', ownerUid: 'alice', linkedDeviceUid: 'dev1' });
  await setDoc(doc(c.firestore(), 'parents/alice/children/kid2'), { name: 'يوسف', ownerUid: 'alice' });
});

const anonTok = { firebase: { sign_in_provider: 'anonymous' } };
const pwTok = (email) => ({ email, firebase: { sign_in_provider: 'password' } });
const alice = env.authenticatedContext('alice', pwTok('a@x.com')).storage();
const bob = env.authenticatedContext('bob', pwTok('b@x.com')).storage();
const dev1 = env.authenticatedContext('dev1', anonTok).storage();
const dev2 = env.authenticatedContext('dev2', anonTok).storage();
const anonAlice = env.authenticatedContext('alice', anonTok).storage(); // anonymous user with a parent's uid
const nobody = env.unauthenticatedContext().storage();

const audio = (n = 1024) => new Uint8Array(n).fill(7);
const m4a = { contentType: 'audio/mp4' };
const wav = { contentType: 'audio/wav' };
const rec = (s, p = 'recordings/alice/kid1/s1.m4a') => ref(s, p);

let pass = 0, fail = 0;
async function t(name, p) {
  try { await p; pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}

// ── create: only the linked child device, audio only, ≤ 5 MB, no overwrite ──
await t('linked device uploads its report (m4a)', assertSucceeds(uploadBytes(rec(dev1), audio(), m4a)));
await t('linked device uploads a web report (wav)', assertSucceeds(uploadBytes(rec(dev1, 'recordings/alice/kid1/s2.wav'), audio(), wav)));
await t('cannot overwrite an existing recording', assertFails(uploadBytes(rec(dev1), audio(), m4a)));
await t('other device cannot upload for the child', assertFails(uploadBytes(rec(dev2, 'recordings/alice/kid1/s3.m4a'), audio(), m4a)));
await t('device cannot upload for an unlinked child', assertFails(uploadBytes(rec(dev1, 'recordings/alice/kid2/s4.m4a'), audio(), m4a)));
await t('device cannot upload to another parent', assertFails(uploadBytes(rec(dev1, 'recordings/bob/kid1/s5.m4a'), audio(), m4a)));
await t('parent cannot upload a report', assertFails(uploadBytes(rec(alice, 'recordings/alice/kid1/s6.m4a'), audio(), m4a)));
await t('signed-out cannot upload', assertFails(uploadBytes(rec(nobody, 'recordings/alice/kid1/s7.m4a'), audio(), m4a)));
await t('wrong content type rejected', assertFails(uploadBytes(rec(dev1, 'recordings/alice/kid1/s8.m4a'), audio(), { contentType: 'image/png' })));
await t('extension must match type', assertFails(uploadBytes(rec(dev1, 'recordings/alice/kid1/s9.wav'), audio(), m4a)));
await t('non-audio file name rejected', assertFails(uploadBytes(rec(dev1, 'recordings/alice/kid1/x.exe'), audio(), m4a)));
await t('empty file rejected', assertFails(uploadBytes(rec(dev1, 'recordings/alice/kid1/s10.m4a'), new Uint8Array(0), m4a)));
await t('over 5 MB rejected', assertFails(uploadBytes(rec(dev1, 'recordings/alice/kid1/s11.m4a'), audio(5 * 1024 * 1024 + 1), m4a)));
await t('metadata update rejected', assertFails(updateMetadata(rec(dev1), { customMetadata: { a: 'b' } })));

// ── read / delete: the parent only ──
await t('parent reads the recording', assertSucceeds(getBytes(rec(alice))));
await t('parent gets a download URL', assertSucceeds(getDownloadURL(rec(alice))));
await t('child device cannot read it back', assertFails(getBytes(rec(dev1))));
await t('other parent cannot read', assertFails(getBytes(rec(bob))));
await t('anonymous user with the parent uid cannot read', assertFails(getBytes(rec(anonAlice))));
await t('signed-out cannot read', assertFails(getBytes(rec(nobody))));
await t('other device cannot list', assertFails(listAll(ref(dev2, 'recordings/alice/kid1'))));
await t('other parent cannot delete', assertFails(deleteObject(rec(bob))));
await t('child device cannot delete', assertFails(deleteObject(rec(dev1))));
await t('parent deletes the recording', assertSucceeds(deleteObject(rec(alice))));

// ── everything else is denied ──
await t('no other paths (write)', assertFails(uploadBytes(ref(alice, 'public/x.m4a'), audio(), m4a)));
await t('no other paths (read)', assertFails(getBytes(ref(alice, 'public/x.m4a'))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
