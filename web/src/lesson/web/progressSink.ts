// Lesson checkpoints → parents/{p}/children/{c}/progress/{lessonId}, and the
// project report → Storage + submissions/{id}. Port of the Dart
// FirestoreLessonProgressSink; shapes follow app/firestore.rules + storage.rules:
// startedAt is the server time on create and never changes; updatedAt is always
// the server time; the recording is uploaded before its submission record.
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

import { childPath, type ChildRef } from '../../data/student';
import { firebase } from '../../firebase/app';
import type { LessonProgressSink, RecordedAudio } from '../ports';
import type { LessonProgress } from '../state';

export class FirestoreProgressSink implements LessonProgressSink {
  /** Whether the checkpoint doc exists (read once, then tracked). */
  private exists: boolean | undefined = undefined;
  /** The agent fires checkpoints without awaiting — they are written one at a time, in order. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly session: ChildRef,
    private readonly lessonId: string,
  ) {}

  private get progressDoc() {
    return doc(firebase().db, `${childPath(this.session)}/progress/${this.lessonId}`);
  }

  private write(p: LessonProgress): Promise<void> {
    const run = this.queue.then(() => this.writeNow(p));
    // A failed write must not block the ones after it (the caller still sees the error).
    this.queue = run.catch(() => {});
    return run;
  }

  private async writeNow(p: LessonProgress): Promise<void> {
    const d = this.progressDoc;
    this.exists ??= (await getDoc(d)).exists();
    const data = {
      lessonId: this.lessonId,
      stepIndex: p.stepIndex,
      doneRefs: [...p.doneRefs],
      surahsCompleted: [...p.surahsCompleted],
      hadithDone: [...p.hadithDone],
      projectAssigned: p.projectAssigned,
      reportedProject: p.reportedProject,
      completed: p.completed,
      updatedAt: serverTimestamp(),
    };
    if (this.exists) {
      // Merge keeps the stored startedAt untouched (the rules require it unchanged).
      await setDoc(d, data, { merge: true });
    } else {
      try {
        await setDoc(d, { ...data, startedAt: serverTimestamp() });
      } catch (e) {
        // Another writer (a second tab, a remounted call) created it first → update instead.
        if (!(await getDoc(d)).exists()) throw e;
        await setDoc(d, data, { merge: true });
      }
      this.exists = true;
    }
  }

  checkpoint(progress: LessonProgress): Promise<void> {
    return this.write(progress);
  }

  completed(progress: LessonProgress): Promise<void> {
    return this.write(progress);
  }

  async saveReport(projectId: string, audio: RecordedAudio): Promise<void> {
    if (!audio.blob) throw new Error('No recording to save');
    const { db, storage } = firebase();
    const { parentUid, childId } = this.session;
    const sub = doc(collection(db, `${childPath(this.session)}/submissions`));
    const storagePath = `recordings/${parentUid}/${childId}/${sub.id}.wav`;
    // Upload first: the submission record must point at a stored recording.
    await uploadBytes(ref(storage, storagePath), audio.blob, { contentType: 'audio/wav' });
    await setDoc(sub, {
      projectId,
      lessonId: this.lessonId,
      storagePath,
      durationMs: Math.min(180_000, Math.max(1000, Math.round(audio.durationMs))),
      createdAt: serverTimestamp(),
    });
  }
}
