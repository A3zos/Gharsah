// Project reports the child recorded (frame 22), as the parent sees them.
// Port of app/lib/features/dashboard/data/submissions_repository.dart: the
// audio is read through Storage rules (parent only) — never a shareable URL.
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { deleteObject, getBytes, ref } from 'firebase/storage';

import { firebase } from '../firebase/app';

export interface ProjectSubmission {
  id: string;
  projectId: string;
  lessonId: string;
  storagePath: string;
  durationMs: number;
  createdAt: Date;
}

const MAX_BYTES = 8 * 1024 * 1024;

export function watchSubmissions(
  uid: string,
  childId: string,
  next: (s: ProjectSubmission[]) => void,
  error?: (e: unknown) => void,
) {
  return onSnapshot(
    query(
      collection(firebase().db, 'parents', uid, 'children', childId, 'submissions'),
      orderBy('createdAt', 'desc'),
    ),
    (q) =>
      next(
        q.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            projectId: String(v.projectId ?? ''),
            lessonId: String(v.lessonId ?? ''),
            storagePath: String(v.storagePath ?? ''),
            durationMs: typeof v.durationMs === 'number' ? v.durationMs : 0,
            createdAt: v.createdAt instanceof Timestamp ? v.createdAt.toDate() : new Date(),
          };
        }),
      ),
    error,
  );
}

/** The recording as an object URL (revoke it when done). */
export async function loadRecording(s: ProjectSubmission): Promise<string> {
  const bytes = await getBytes(ref(firebase().storage, s.storagePath), MAX_BYTES);
  const type = s.storagePath.endsWith('.wav') ? 'audio/wav' : 'audio/mp4';
  return URL.createObjectURL(new Blob([bytes], { type }));
}

/** The parent deletes a recording (audio + record); onSubmissionDeleted recomputes stats. */
export async function deleteSubmission(uid: string, childId: string, s: ProjectSubmission): Promise<void> {
  try {
    await deleteObject(ref(firebase().storage, s.storagePath));
  } catch (e) {
    if ((e as { code?: string }).code !== 'storage/object-not-found') throw e;
  }
  await deleteDoc(doc(firebase().db, 'parents', uid, 'children', childId, 'submissions', s.id));
}

/** «٠:٤٤» */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const ar = (n: number) => n.toLocaleString('ar-SA-u-nu-arab', { useGrouping: false });
  return `${ar(m)}:${ar(s).padStart(2, '٠')}`;
}
