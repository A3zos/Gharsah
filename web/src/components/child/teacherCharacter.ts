// The teacher character's data (shared by TeacherSprite and the lesson screens).
export type TeacherGender = 'boy' | 'girl';

/** The teacher's name follows the child's gender. */
export const TEACHER_NAME: Record<TeacherGender, string> = { boy: 'المعلم عبدالله', girl: 'المعلمة سارة' };

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

export const teacherFrameSrc = (g: TeacherGender, f: TeacherFrame) => `/characters/teacher-${g}/${f}.webp`;

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
