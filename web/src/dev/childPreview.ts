// DEV-ONLY child preview: walk the child area (home, review, lesson) without a
// pairing code or Firebase — sample data in memory, nothing read or written.
// Open /child/home?preview=1 on `npm run dev` (close the tab to leave). Every entry point checks
// import.meta.env.DEV, so production builds drop it (the real child device only
// ever enters with a server-verified pairing code). Like app/lib/core/mock_data.dart
// debug previews: remove together before release (CLAUDE.md §11).
import type { ChildProfile } from '../data/children';
import type { StoredProgress } from '../data/student';
import type { LessonProgressSink, RecordedAudio } from '../lesson/ports';
import type { LessonProgress } from '../lesson/state';

const KEY = 'gh.childPreview';
export const PREVIEW_ID = 'preview';

/** Turns preview on from `?preview=1` (DEV only) and reports whether it is on for this tab. */
export function childPreviewOn(url?: string): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    if (url && new URL(url).searchParams.get('preview') === '1') sessionStorage.setItem(KEY, '1');
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const previewSession = { deviceUid: PREVIEW_ID, parentUid: PREVIEW_ID, childId: PREVIEW_ID };

export const previewChild: ChildProfile = {
  id: PREVIEW_ID,
  name: 'عبدالله (معاينة)',
  age: 10,
  gender: 'boy',
  avatarId: 'b1',
  pairing: null,
  linked: true,
  createdAt: null,
  stats: { streak: 0, surahs: 0, ayat: 0, hadith: 0, projects: 0, planPct: 0, stage: 'seed' },
  leader: null,
  aiVoiceConsent: false,
  schedule: {
    days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
    time: 17 * 60,
    custom: {},
    duration: 45,
    reminder: true,
    reviewDays: ['thu'],
  },
};

/** Lesson checkpoints kept in memory for this tab (so ✕ → «أكمل الحصة» resumes). */
const stored = new Map<string, StoredProgress>();
const listeners = new Set<(m: Map<string, StoredProgress>) => void>();

export function watchPreviewProgress(next: (m: Map<string, StoredProgress>) => void): () => void {
  listeners.add(next);
  next(new Map(stored));
  return () => listeners.delete(next);
}

function save(p: LessonProgress) {
  stored.set(p.lessonId, { progress: p, updatedAt: new Date() });
  for (const l of listeners) l(new Map(stored));
}

/** Keeps progress in memory; the project report is dropped (never uploaded). */
export class PreviewProgressSink implements LessonProgressSink {
  async checkpoint(p: LessonProgress) {
    save(p);
  }
  async completed(p: LessonProgress) {
    save(p);
  }
  async saveReport(_projectId: string, _audio: RecordedAudio) {}
}
