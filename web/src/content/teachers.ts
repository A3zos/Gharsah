// The lesson teacher follows the UI language + the child's stored gender — one place for
// the sprite folder (web/public/characters/<folder>/<frame>.webp, 7 frames each), the
// name (i18n `teachers.<nameKey>`, shown in the current UI language) and the voice.
//   ar: المعلم عبدالله / المعلمة سارة · en: Teacher Adam / Teacher Maryam
//   id: Ustaz Ahmad / Ustazah Aisyah
// A call locks its teacher when it starts; a language change applies from the next lesson.
import type { Messages, UiLanguage } from '../i18n/i18n';

export type TeacherGender = 'boy' | 'girl';
export type TeacherNameKey = keyof Messages['teachers'];

export interface TeacherConfig {
  /** web/public/characters/<folder>/ */
  folder: string;
  nameKey: TeacherNameKey;
  /**
   * The /speak voice for this teacher. Arabic: none — the server's current Arabic voices
   * (picked by gender). en / id: VITE_VOICE_ID_{EN,ID}_{M,F} (empty → the server default).
   */
  voiceId?: string;
}

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
const voice = (key: string): string | undefined => env[key]?.trim() || undefined;

export const TEACHERS: Record<UiLanguage, Record<TeacherGender, TeacherConfig>> = {
  ar: {
    boy: { folder: 'teacher-boy', nameKey: 'abdullah' },
    girl: { folder: 'teacher-girl', nameKey: 'sarah' },
  },
  en: {
    boy: { folder: 'teacher-en-boy', nameKey: 'adam', voiceId: voice('VITE_VOICE_ID_EN_M') },
    girl: { folder: 'teacher-en-girl', nameKey: 'maryam', voiceId: voice('VITE_VOICE_ID_EN_F') },
  },
  id: {
    boy: { folder: 'teacher-id-boy', nameKey: 'ahmad', voiceId: voice('VITE_VOICE_ID_ID_M') },
    girl: { folder: 'teacher-id-girl', nameKey: 'aisyah', voiceId: voice('VITE_VOICE_ID_ID_F') },
  },
};

export interface Teacher extends TeacherConfig {
  readonly locale: UiLanguage;
  readonly gender: TeacherGender;
}

/** The teacher of a UI language for a child's gender. */
export function getTeacher(locale: UiLanguage, gender: TeacherGender): Teacher {
  return { ...TEACHERS[locale][gender], locale, gender };
}

/** The fallback when a teacher's frames can't load: the Arabic teacher of the same gender. */
export const arabicTeacher = (gender: TeacherGender): Teacher => getTeacher('ar', gender);

/** The teacher's name in the current UI language. */
export const teacherName = (m: Messages, t: Pick<Teacher, 'nameKey'>): string => m.teachers[t.nameKey];
