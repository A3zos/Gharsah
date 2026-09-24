import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getStorage } from 'firebase-admin/storage';

import { claimCode } from './claim';
import { issueCode, requireId } from './pairing';
import {
  cleanup,
  deleteChildData,
  FileStore,
  recomputeStats,
  verifySubmission,
} from './progress';

// Same region as Firestore (nam5 → us-central1).
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
initializeApp();

/** A signed-in parent (email/password) — never an anonymous child device. */
function requireParent(req: CallableRequest): string {
  const auth = req.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'sign-in-required');
  if (auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'parent-only');
  }
  return auth.uid;
}

/** Frame 11 — the child's pairing code (existing valid one, or a new one). */
export const createPairingCode = onCall(async (req) => {
  const uid = requireParent(req);
  const childId = requireId(req.data?.childId, 'childId');
  return issueCode(getFirestore(), uid, childId, { revoke: false });
});

/** Frame 11 «إصدار رمز جديد» — old code dies, linked device unlinked, new code. */
export const revokePairingCode = onCall(async (req) => {
  const uid = requireParent(req);
  const childId = requireId(req.data?.childId, 'childId');
  return issueCode(getFirestore(), uid, childId, { revoke: true });
});

/**
 * Login «الطفل» tab — an anonymous child device claims its code. Rate-limited
 * per device; links the device to the child and returns only the child's
 * first name + avatar. Frame 03 states: wrong → `not-found`.
 */
export const claimPairingCode = onCall(async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'sign-in-required');
  if (auth.token.firebase?.sign_in_provider !== 'anonymous') {
    throw new HttpsError('permission-denied', 'child-device-only');
  }
  return claimCode(getFirestore(), auth.uid, req.data?.code);
});

// ── Progress → stats (parent dashboard + child home) ────────────────────────

const files: FileStore = {
  async exists(path) {
    const [ok] = await getStorage().bucket().file(path).exists();
    return ok;
  },
  async delete(path) {
    await getStorage().bucket().file(path).delete({ ignoreNotFound: true });
  },
  async deletePrefix(prefix) {
    await getStorage().bucket().deleteFiles({ prefix });
  },
};

const PROGRESS = 'parents/{uid}/children/{childId}/progress/{lessonId}';
const SUBMISSION = 'parents/{uid}/children/{childId}/submissions/{submissionId}';

/** A lesson checkpoint changed → recompute the child's stats. */
export const onProgressWritten = onDocumentWritten(PROGRESS, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const completedNow = after?.completed === true && before?.completed !== true;
  await recomputeStats(getFirestore(), event.params.uid, event.params.childId, { completedNow });
});

/** A project report arrived → verify its recording exists, then recompute. */
export const onSubmissionCreated = onDocumentCreated(SUBMISSION, async (event) => {
  const { uid, childId, submissionId } = event.params;
  const db = getFirestore();
  if (await verifySubmission(db, files, uid, childId, submissionId)) {
    await recomputeStats(db, uid, childId, { completedNow: false });
  }
});

/** A recording was deleted (parent or 90-day cleanup) → recompute. */
export const onSubmissionDeleted = onDocumentDeleted(SUBMISSION, async (event) => {
  await recomputeStats(getFirestore(), event.params.uid, event.params.childId, {
    completedNow: false,
  });
});

/** The parent removed a child → delete its progress, recordings, code, session. */
export const onChildDeleted = onDocumentDeleted(
  'parents/{uid}/children/{childId}',
  async (event) => {
    const data = event.data?.data() ?? {};
    await deleteChildData(getFirestore(), files, event.params.uid, event.params.childId, data);
  },
);

/** Daily: recordings older than 90 days, expired pairing codes, rate limits. */
export const scheduledCleanup = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Asia/Riyadh' },
  async () => {
    const r = await cleanup(getFirestore(), files);
    console.log('cleanup', r);
  },
);
