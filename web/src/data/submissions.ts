// Project reports the child recorded (frame 22), as the parent sees them.
// The audio sits in the PRIVATE bucket `recordings`; the parent plays it through
// a short-lived signed URL (storage policy: parent reads own children only).
import { supabase } from '../supabase/client';
import { watch } from '../supabase/live';

export interface ProjectSubmission {
  id: string;
  projectId: string;
  lessonId: string;
  storagePath: string;
  durationMs: number;
  createdAt: Date;
}

const SIGNED_URL_SECONDS = 10 * 60;

export function watchSubmissions(
  _uid: string,
  childId: string,
  next: (s: ProjectSubmission[]) => void,
  error?: (e: unknown) => void,
) {
  return watch(
    [{ table: 'submissions', filter: `child_id=eq.${childId}` }],
    async () => {
      const { data, error: e } = await supabase()
        .from('submissions')
        .select('id, project_id, lesson_id, storage_path, duration_ms, created_at')
        .eq('child_id', childId)
        .order('created_at', { ascending: false });
      if (e) throw e;
      return (data ?? []).map((v) => ({
        id: String(v.id),
        projectId: String(v.project_id ?? ''),
        lessonId: String(v.lesson_id ?? ''),
        storagePath: String(v.storage_path ?? ''),
        durationMs: typeof v.duration_ms === 'number' ? v.duration_ms : 0,
        createdAt: typeof v.created_at === 'string' ? new Date(v.created_at) : new Date(),
      }));
    },
    next,
    error,
  );
}

/** A signed URL (10 min) the audio element can play. */
export async function loadRecording(s: ProjectSubmission): Promise<string> {
  const { data, error } = await supabase()
    .storage.from('recordings')
    .createSignedUrl(s.storagePath, SIGNED_URL_SECONDS);
  if (error || !data) throw error ?? new Error('no signed url');
  return data.signedUrl;
}

/** The parent deletes a recording (audio + record). */
export async function deleteSubmission(_uid: string, _childId: string, s: ProjectSubmission): Promise<void> {
  // The row delete also queues the file for storage-cleanup; removing it now is immediate.
  await supabase().storage.from('recordings').remove([s.storagePath]);
  const { error } = await supabase().from('submissions').delete().eq('id', s.id);
  if (error) throw error;
}

/** «٠:٤٤» */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const ar = (n: number) => n.toLocaleString('ar-SA-u-nu-arab', { useGrouping: false });
  return `${ar(m)}:${ar(s).padStart(2, '٠')}`;
}
