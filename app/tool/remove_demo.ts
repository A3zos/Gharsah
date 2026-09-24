// Deletes ALL demo data from nibras-59284: the demo auth user, its parent tree
// (children, progress, submissions, subscription), isDemo pairing codes, the
// demo child's device sessions, and its Storage recordings.
// Run from app/:  node tool/remove_demo.ts
import { adminApp, bucketReady, DEMO, getAuth, getFirestore, getStorage } from './demo_admin.ts';

async function main() {
  adminApp();
  const auth = getAuth();
  const db = getFirestore();

  let uid: string | null = null;
  try {
    uid = (await auth.getUserByEmail(DEMO.email)).uid;
  } catch (e: any) {
    if (e?.code !== 'auth/user-not-found') throw e;
  }

  for (const d of (await db.collection('pairingCodes').where('isDemo', '==', true).get()).docs) {
    await d.ref.delete();
    console.log('deleted code', d.id);
  }
  if (uid) {
    for (const d of (await db.collection('childSessions').where('parentUid', '==', uid).get()).docs) {
      await d.ref.delete();
    }
    if (await bucketReady()) {
      await getStorage().bucket().deleteFiles({ prefix: `recordings/${uid}/` });
      console.log('deleted recordings', `recordings/${uid}/`);
    }
    await db.recursiveDelete(db.doc(`parents/${uid}`));
    await auth.deleteUser(uid);
    console.log('deleted parent', uid);
  } else {
    console.log('no demo user found');
  }
  console.log('demo removed');
}

main().then(() => process.exit(0), (e) => {
  console.error('remove failed:', e?.message ?? e);
  process.exit(1);
});
