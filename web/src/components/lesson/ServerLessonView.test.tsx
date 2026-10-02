import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { initialServerState, type ServerLessonState } from '../../lesson/server/serverLesson';
import { ServerLessonView, type ServerLessonActions } from './ServerLessonView';

const actions = (): ServerLessonActions => ({
  answer: vi.fn(),
  continueTapped: vi.fn(),
  repeatTapped: vi.fn(),
  speakAnswer: vi.fn(),
  playTapped: vi.fn(),
  markProjectDone: vi.fn(),
  exit: vi.fn(),
  goHome: vi.fn(),
});

const live = (patch: Partial<ServerLessonState>): ServerLessonState => ({
  ...initialServerState,
  phase: 'live',
  segment: 'quran',
  teacher: 'المعلم عبدالله',
  busy: false,
  stages: [
    { id: 'greet', label: 'الترحيب' },
    { id: 'surah', label: 'اختيار السورة' },
  ],
  caption: 'كيف حالك يا بطل؟',
  ...patch,
});

const view = (s: ServerLessonState, a = actions()) => {
  render(<ServerLessonView state={s} actions={a} desktop={false} />);
  return a;
};

describe('ServerLessonView — the live call', () => {
  it('is the built-in call: «مباشر», timer, the teacher and only the current line — no stages bar', () => {
    view(live({ expects: 'text', quickReplies: ['تمام'] }));
    expect(screen.getByText('مباشر')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'المعلّم' })).toBeInTheDocument();
    expect(screen.getByText('كيف حالك يا بطل؟')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText('الترحيب')).toBeNull();
    expect(screen.queryByText('اختيار السورة')).toBeNull();
  });

  it('with consent + speech: the mic is the answer, replies are small chips', () => {
    const a = view(live({ expects: 'choice', canSpeak: true, quickReplies: ['الإخلاص', 'الناس'] }));
    fireEvent.click(screen.getByRole('button', { name: 'افتح الميكروفون' }));
    expect(a.speakAnswer).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'الإخلاص' }));
    expect(a.answer).toHaveBeenCalledWith('الإخلاص');
  });

  it('while listening, the mic is live (no tap needed)', () => {
    view(live({ expects: 'text', canSpeak: true, hearing: true }));
    expect(screen.getByText('دورك… أنا أسمعك')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'افتح الميكروفون' })).toBeNull();
  });

  it('without consent: big reply buttons, no mic', () => {
    const a = view(live({ expects: 'choice', canSpeak: false, quickReplies: ['الأم', 'الصديق'] }));
    expect(screen.queryByRole('button', { name: 'افتح الميكروفون' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'الأم' }));
    expect(a.answer).toHaveBeenCalledWith('الأم');
  });

  it('the text field hides behind «اكتب», only when expects is text', () => {
    const a = view(live({ expects: 'text', quickReplies: ['تمام'] }));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'اكتب' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'بخير' } });
    fireEvent.click(screen.getByRole('button', { name: 'أرسل' }));
    expect(a.answer).toHaveBeenCalledWith('بخير');
  });

  it('no «اكتب» on continue or choice; «أكمل» leads on continue', () => {
    const a = view(live({ expects: 'continue', quickReplies: ['عندي سؤال'] }));
    expect(screen.queryByRole('button', { name: 'اكتب' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'أكمل' }));
    expect(a.continueTapped).toHaveBeenCalled();
  });

  it('repeat: the live mic with «ردّدت»', () => {
    const a = view(live({ expects: 'repeat', repeat: 'listening' }));
    expect(screen.getByText('دورك… ردّد وأنا أسمعك')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ردّدت' }));
    expect(a.repeatTapped).toHaveBeenCalled();
  });

  it('the surah card from the verified ayat; the hadith as the built-in «قيد المراجعة» card', () => {
    const { unmount } = render(
      <ServerLessonView
        state={live({
          ayat: [
            { ayah: 1, text: 'AYAH-ONE' },
            { ayah: 2, text: 'AYAH-TWO' },
          ],
          currentAyah: 2,
          surahName: 'الإخلاص',
          reciting: true,
        })}
        actions={actions()}
        desktop={false}
      />,
    );
    expect(screen.getByText('AYAH-TWO')).toBeInTheDocument();
    expect(screen.getByText('القارئ يقرأ… استمع')).toBeInTheDocument();
    unmount();
    view(live({ segment: 'hadith', hadith: { title: 'برّ الوالدين', source: 'متفق عليه' } }));
    expect(screen.getByText('حديث اليوم عن برّ الوالدين')).toBeInTheDocument();
    expect(screen.getByText('قيد المراجعة الشرعية')).toBeInTheDocument();
  });

  it('warming: the teacher getting ready, no input yet', () => {
    view({ ...initialServerState, phase: 'warming' });
    expect(screen.getByText('المعلّم يتجهّز… لحظات ونبدأ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ردّدت' })).toBeNull();
  });

  it('blocked teacher voice → «اضغط لتسمع المعلّم»', () => {
    const a = view(live({ playbackBlocked: true, speaking: true }));
    fireEvent.click(screen.getByRole('button', { name: 'اضغط لتسمع المعلّم' }));
    expect(a.playTapped).toHaveBeenCalled();
  });
});
