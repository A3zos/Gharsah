// The teacher character's frames (shared by TeacherSprite and the lesson screens). WHICH
// teacher (folder, name, voice) comes from content/teachers.ts — the UI language + gender.
import { arabicTeacher, type Teacher, type TeacherGender } from '../../content/teachers';

export type { Teacher, TeacherGender };

export const FRAMES = [
  'idle',
  'mouth-small',
  'mouth-open',
  'mouth-wide',
  'mouth-o',
  'blink',
  'happy',
] as const;
export type TeacherFrame = (typeof FRAMES)[number];

export const teacherFrameSrc = (t: Pick<Teacher, 'folder'>, f: TeacherFrame) =>
  `/characters/${t.folder}/${f}.webp`;

/** Status lines about the teacher, in the teacher's grammatical gender. */
export const TEACHER_TEXT: Record<
  TeacherGender,
  {
    talking: string;
    readying: string;
    resting: string;
    tapToHear: string;
    hearing: string;
    voiceMissing: string;
  }
> = {
  boy: {
    talking: 'المعلّم يتكلم…',
    readying: 'المعلّم يتجهّز… لحظات ونبدأ',
    resting: 'المعلّم يأخذ نفَسًا… لحظات ونكمل.',
    tapToHear: 'اضغط لتسمع المعلّم',
    hearing: 'المعلّم يسمع تلاوتك…',
    voiceMissing: 'صوت المعلّم غير متاح الآن — اقرأ كلامه المكتوب تحته.',
  },
  girl: {
    talking: 'المعلمة تتكلم…',
    readying: 'المعلمة تتجهّز… لحظات ونبدأ',
    resting: 'المعلمة تأخذ نفَسًا… لحظات ونكمل.',
    tapToHear: 'اضغطي لتسمعي المعلمة',
    hearing: 'المعلمة تسمع تلاوتك…',
    voiceMissing: 'صوت المعلمة غير متاح الآن — اقرئي كلامها المكتوب تحتها.',
  },
};

const preloads = new Map<string, Promise<boolean>>();

/**
 * Loads (and decodes) all 7 frames of a teacher — the child home and the lesson call it
 * before the call opens. One retry per frame; true when every frame is ready.
 */
function preloadFrames(t: Pick<Teacher, 'folder'>): Promise<boolean> {
  const known = preloads.get(t.folder);
  if (known) return known;
  const one = (src: string, retry: boolean): Promise<boolean> =>
    new Promise((resolve) => {
      if (typeof Image === 'undefined') return resolve(false);
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(true);
      img.onerror = () => (retry ? resolve(one(`${src}?retry=1`, false)) : resolve(false));
      img.src = src;
    });
  const p = Promise.all(FRAMES.map((f) => one(teacherFrameSrc(t, f), true))).then((ok) => ok.every(Boolean));
  preloads.set(t.folder, p);
  return p;
}

/**
 * Preloads the teacher; resolves to the teacher to show — the same one, or, when one of
 * its frames 404s, the Arabic teacher of the same gender (also preloaded).
 */
export async function preloadTeacher(t: Teacher): Promise<Teacher> {
  if (await preloadFrames(t)) return t;
  const fallback = arabicTeacher(t.gender);
  if (fallback.folder === t.folder) return t;
  await preloadFrames(fallback);
  return fallback;
}
