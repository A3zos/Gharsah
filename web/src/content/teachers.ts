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
}

// The voice is the AI server's, by lang + gender (/speak/status) — nothing to configure here.

export const TEACHERS: Record<UiLanguage, Record<TeacherGender, TeacherConfig>> = {
  ar: {
    boy: { folder: 'teacher-boy', nameKey: 'abdullah' },
    girl: { folder: 'teacher-girl', nameKey: 'sarah' },
  },
  en: {
    boy: { folder: 'teacher-en-boy', nameKey: 'adam' },
    girl: { folder: 'teacher-en-girl', nameKey: 'maryam' },
  },
  id: {
    boy: { folder: 'teacher-id-boy', nameKey: 'ahmad' },
    girl: { folder: 'teacher-id-girl', nameKey: 'aisyah' },
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
