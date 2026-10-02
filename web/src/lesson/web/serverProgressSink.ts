// Server-lesson progress → Supabase `progress` (child_id, lesson_id). Same RLS and
// column grants as the built-in lesson's sink: the device writes only stage,
// step_index and done_refs; stars / started_at / completed_at come from the
// database (progress_guard). Stages only move forward and refs only accumulate.
import type { ChildRef } from '../../data/student';
import { supabase } from '../../supabase/client';
import { withRetry, type ProgressStage } from './progressSink';
import { maxStage, stageRank, type ProgressUpdate, type ServerProgressSink } from '../server/progressMap';

interface Known {
  stage: ProgressStage;
  refs: Set<string>;
  exists: boolean;
}

export class SupabaseServerProgressSink implements ServerProgressSink {
  private readonly known = new Map<string, Known>();
  /** One write at a time, in order (the lesson doesn't await them). */
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly session: ChildRef) {}

  record(u: ProgressUpdate): Promise<void> {
    const run = this.queue.then(() => withRetry('progress save', () => this.write(u)));
    this.queue = run.catch(() => {});
    return run;
  }

  private async write(u: ProgressUpdate): Promise<void> {
    const db = supabase();
    const { childId } = this.session;
    let k = this.known.get(u.lessonId);
    if (!k) {
      const { data, error } = await db
        .from('progress')
        .select('stage, done_refs')
        .eq('child_id', childId)
        .eq('lesson_id', u.lessonId)
        .maybeSingle();
      if (error) throw error;
      const row = data as { stage?: ProgressStage; done_refs?: string[] } | null;
      k = {
        stage: row?.stage ?? 'listen_full',
        refs: new Set(row?.done_refs ?? []),
        exists: !!row,
      };
      this.known.set(u.lessonId, k);
    }
    const stage = maxStage(k.stage, u.stage);
    const refs = new Set([...k.refs, ...u.doneRefs]);
    if (k.exists && stageRank(stage) === stageRank(k.stage) && refs.size === k.refs.size) return;
    const flow = { stage, step_index: Math.min(99, Math.max(0, u.stepIndex)), done_refs: [...refs] };
    if (!k.exists) {
      const { error } = await db
        .from('progress')
        .insert({ child_id: childId, lesson_id: u.lessonId, ...flow });
      // 23505 = the row appeared meanwhile (another tab) → update below.
      if (error && error.code !== '23505') throw error;
      k.exists = true;
      if (!error) {
        k.stage = stage;
        k.refs = refs;
        return;
      }
    }
    const { error } = await db
      .from('progress')
      .update(flow)
      .eq('child_id', childId)
      .eq('lesson_id', u.lessonId);
    if (error?.code === 'P0001') {
      // progress-stage-backwards: another writer got further — re-read next time.
      this.known.delete(u.lessonId);
      return;
    }
    if (error) throw error;
    k.stage = stage;
    k.refs = refs;
  }
}
