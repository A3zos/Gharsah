// Admin statistics — ONE call, public.admin_stats(): aggregates only (counts and
// percentages), no names, emails, recordings or per-child data. The database
// raises 'forbidden' (42501) for anyone who isn't in public.admins.
import { supabase } from '../supabase/client';

export interface DailyPoint {
  day: string; // YYYY-MM-DD (Riyadh)
  newParents: number;
  lessonsCompleted: number;
}

export interface LessonRow {
  lessonId: string;
  title: string;
  started: number;
  completed: number;
  rate: number;
}

export interface AdminStats {
  generatedAt: string;
  parents: { total: number; today: number; last7: number; last30: number };
  children: {
    total: number;
    byAge: { '8-9': number; '10-11': number; '12-13': number };
    byGender: { boy: number; girl: number };
  };
  pairedDevices: number;
  subscriptions: { monthly: number; annual: number; trial: number; none: number; active: number };
  lessons: { started: number; completed: number; completionRate: number; byLesson: LessonRow[] };
  memorization: { ayat: number; surahs: number; hadith: number };
  projects: { assigned: number; reported: number; reportRate: number };
  engagement: { activeToday: number; active7: number; lessonsPerActiveChild: number };
  daily: DailyPoint[];
}

export type AdminLoad =
  | { kind: 'loading' }
  | { kind: 'ok'; stats: AdminStats; loadedAt: Date }
  | { kind: 'forbidden' }
  | { kind: 'error'; code: string };

export async function loadAdminStats(): Promise<AdminLoad> {
  const { data, error } = await supabase().rpc('admin_stats');
  if (error) {
    if (error.code === '42501' || /forbidden/.test(error.message)) return { kind: 'forbidden' };
    console.error('[gharsah] admin_stats failed', error.code, error.message);
    return { kind: 'error', code: error.code ?? 'unknown' };
  }
  return { kind: 'ok', stats: data as AdminStats, loadedAt: new Date() };
}
