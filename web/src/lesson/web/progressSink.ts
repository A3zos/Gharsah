// Lesson checkpoints → `progress` (child_id, lesson_id), and the project report →
// the private `recordings` bucket + `submissions`. Shapes follow the RLS policies
// and column grants (supabase/migrations/…_rls.sql): the device writes only the
// flow columns; stars / started_at / completed_at are set by the database; the
// recording is uploaded before its submission row (which checks it exists).
import type { ChildRef } from '../../data/student';
import { supabase } from '../../supabase/client';
import type { LessonProgressSink, RecordedAudio } from '../ports';
import type { LessonScript } from '../script';
import type { LessonProgress } from '../state';

export type ProgressStage = 'listen_full' | 'ayah_repeat' | 'full_twice' | 'hadith' | 'done';

/**
 * The database stage of a checkpoint. Until the 3-stage agent flow lands
 * (review notes C9), the stage follows the script step the child is on;
 * it only ever moves forward, like the steps.
 */
export function stageOf(script: LessonScript, p: LessonProgress): ProgressStage {
  if (p.completed) return 'done';
  switch (script.steps[p.stepIndex]?.type) {
    case 'ayah_loop':
      return 'ayah_repeat';
    case 'surah_done':
      return 'full_twice';
    case 'hadith_loop':
    case 'project_assign':
    case 'lesson_end':
      return 'hadith';
    default:
      return 'listen_full';
  }
}

export class SupabaseProgressSink implements LessonProgressSink {
  /** Whether this lesson's row exists (read once, then tracked). */
  private exists: boolean | undefined = undefined;
  /** The agent fires checkpoints without awaiting — they are written one at a time, in order. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly session: ChildRef,
    private readonly script: LessonScript,
  ) {}

  private write(p: LessonProgress): Promise<void> {
    const run = this.queue.then(() => this.writeNow(p));
    // A failed write must not block the ones after it (the caller still sees the error).
    this.queue = run.catch(() => {});
    return run;
  }

  private async writeNow(p: LessonProgress): Promise<void> {
    const db = supabase();
    const { childId } = this.session;
    const lessonId = this.script.lessonId;
    const flow = {
      stage: stageOf(this.script, p),
      step_index: p.stepIndex,
      done_refs: [...p.doneRefs],
      project_assigned: p.projectAssigned,
      reported_project: p.reportedProject,
    };
    if (this.exists === undefined) {
      const { data } = await db
        .from('progress')
        .select('lesson_id')
        .eq('child_id', childId)
        .eq('lesson_id', lessonId)
        .maybeSingle();
      this.exists = !!data;
    }
    if (!this.exists) {
      const { error } = await db.from('progress').insert({ child_id: childId, lesson_id: lessonId, ...flow });
      if (!error) {
        this.exists = true;
        return;
      }
      // 23505 = another writer (a second tab, a remounted call) created it first → update below.
      if (error.code !== '23505') throw error;
      this.exists = true;
    }
    const { error } = await db
      .from('progress')
      .update(flow)
      .eq('child_id', childId)
      .eq('lesson_id', lessonId);
    if (error) throw error;
  }

  checkpoint(progress: LessonProgress): Promise<void> {
    return this.write(progress);
  }

  completed(progress: LessonProgress): Promise<void> {
    return this.write(progress);
  }

  async saveReport(projectId: string, audio: RecordedAudio): Promise<void> {
    if (!audio.blob) throw new Error('No recording to save');
    const db = supabase();
    const { parentUid, childId } = this.session;
    const id = crypto.randomUUID();
    const storagePath = `${parentUid}/${childId}/${id}.wav`;
    // Upload first: the submission row must point at a stored recording.
    const up = await db.storage.from('recordings').upload(storagePath, audio.blob, {
      contentType: 'audio/wav',
      upsert: false,
    });
    if (up.error) throw up.error;
    const { error } = await db.from('submissions').insert({
      id,
      child_id: childId,
      lesson_id: this.script.lessonId,
      stage: 'project',
      project_id: projectId,
      storage_path: storagePath,
      duration_ms: Math.min(180_000, Math.max(1000, Math.round(audio.durationMs))),
    });
    if (error) throw error;
  }
}
