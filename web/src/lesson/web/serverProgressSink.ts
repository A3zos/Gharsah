// Server-lesson progress → Supabase `progress` (child_id, lesson_id). Same RLS and
// column grants as the built-in lesson's sink: the device writes only stage,
// step_index and done_refs; stars / started_at / completed_at come from the
// database (progress_guard). Stages only move forward and refs only accumulate.
import type { ChildRef } from '../../data/student';
import { supabase } from '../../supabase/client';
import { withRetry, writeWithOptional, type ProgressStage } from './progressSink';
import { maxStage, stageRank, type ProgressUpdate, type ServerProgressSink } from '../server/progressMap';

interface Known {
  stage: ProgressStage;
  refs: Set<string>;
  exists: boolean;
  quizUnscored: boolean;
  notRepeated: Set<string>;
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
        quizUnscored: false,
        notRepeated: new Set(),
      };
      this.known.set(u.lessonId, k);
    }
    const stage = maxStage(k.stage, u.stage);
    const refs = new Set([...k.refs, ...u.doneRefs]);
    const unscored = !!u.quizUnscored && !k.quizUnscored;
    const notRepeated = new Set([...k.notRepeated, ...(u.notRepeatedRefs ?? [])]);
    const moreNotRepeated = notRepeated.size > k.notRepeated.size;
    if (
      k.exists &&
      stageRank(stage) === stageRank(k.stage) &&
      refs.size === k.refs.size &&
      !unscored &&
      !moreNotRepeated
    )
      return;
    // «لم يُردَّد» — only when there is one (optional column, see writeWithOptional)
    const optional: Record<string, unknown> = notRepeated.size ? { not_repeated_refs: [...notRepeated] } : {};
    const flow = {
      stage,
      step_index: Math.min(99, Math.max(0, u.stepIndex)),
      done_refs: [...refs],
      // the quiz answered on the device (no words known) → «لم يُقيَّم» for the parent
      ...(unscored ? { quiz_unscored: true } : {}),
    };
    if (!k.exists) {
      const { error } = await writeWithOptional(optional, (extra) =>
        db.from('progress').insert({ child_id: childId, lesson_id: u.lessonId, ...flow, ...extra }),
      );
      // 23505 = the row appeared meanwhile (another tab) → update below.
      if (error && error.code !== '23505') throw error;
      k.exists = true;
      if (!error) {
        k.stage = stage;
        k.refs = refs;
        k.quizUnscored ||= unscored;
        k.notRepeated = notRepeated;
        return;
      }
    }
    const { error } = await writeWithOptional(optional, (extra) =>
      db
        .from('progress')
        .update({ ...flow, ...extra })
        .eq('child_id', childId)
        .eq('lesson_id', u.lessonId),
    );
    if (error?.code === 'P0001') {
      // progress-stage-backwards: another writer got further — re-read next time.
      this.known.delete(u.lessonId);
      return;
    }
    if (error) throw error;
    k.stage = stage;
    k.refs = refs;
    k.quizUnscored ||= unscored;
    k.notRepeated = notRepeated;
  }
}
