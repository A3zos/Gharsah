import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nContext, MESSAGES } from '../../i18n/i18n';
import { initialServerState, type ServerLessonState } from '../../lesson/server/serverLesson';
import { ServerLessonView, type ServerLessonActions } from './ServerLessonView';

const actions = (): ServerLessonActions => ({
  allowTapped: vi.fn(),
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
  it('is the built-in call: «مباشر», timer, the teacher — nothing he says is written, no stages bar', () => {
    view(live({ expects: 'text', quickReplies: ['تمام'], speaking: true }));
    expect(screen.getByText('مباشر')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'المعلم عبدالله' })).toBeInTheDocument();
    expect(screen.getByText('المعلم عبدالله')).toBeInTheDocument(); // the name under the character
    expect(screen.queryByText('كيف حالك يا بطل؟')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText('الترحيب')).toBeNull();
    expect(screen.queryByText('اختيار السورة')).toBeNull();
  });

  it('a girl gets المعلمة سارة (the stored gender)', () => {
    render(
      <ServerLessonView
        state={live({ expects: 'text' })}
        actions={actions()}
        desktop={false}
        gender="girl"
      />,
    );
    expect(screen.getByRole('button', { name: 'المعلمة سارة' })).toBeInTheDocument();
    expect(document.querySelector('img[src="/characters/teacher-girl/idle.webp"]')).not.toBeNull();
  });

  it('the line shows as text only when no voice could say it', () => {
    view(live({ expects: 'text', voiceMissing: true }));
    expect(screen.getByText('كيف حالك يا بطل؟')).toBeInTheDocument();
  });

  it('show_words: the words table under the hadith card', () => {
    view(
      live({
        segment: 'hadith',
        hadith: { title: 'الكذب', source: null },
        words: [{ word: 'الصدق', meaning: 'قول الحق' }],
      }),
    );
    expect(screen.getByText('كلمات جديدة')).toBeInTheDocument();
    expect(screen.getByText('قول الحق')).toBeInTheDocument();
  });

  it('a pure voice call: no reply buttons, no «اكتب», no text field — only the end-call ✕', () => {
    for (const expects of ['text', 'continue', 'choice', 'repeat'] as const) {
      const { unmount } = render(
        <ServerLessonView
          state={live({ expects, quickReplies: ['الأم', 'الصديق'], canSpeak: expects !== 'repeat' })}
          actions={actions()}
          desktop={false}
        />,
      );
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByText('اكتب')).toBeNull();
      expect(screen.queryByText('أكمل')).toBeNull();
      expect(screen.queryByText('ردّدت')).toBeNull();
      expect(screen.queryByText('الأم')).toBeNull();
      // buttons: the ✕ and the character (a tap target, not an answer)
      const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
      expect(names.sort()).toEqual(['إنهاء المكالمة', 'المعلم عبدالله'].sort());
      unmount();
    }
  });

  it('while listening, the mic is live; its words are for screen readers only', () => {
    view(live({ expects: 'text', hearing: true }));
    const label = screen.getByText('دورك… أنا أسمعك');
    expect(label.closest('.sr-only')).not.toBeNull();
  });

  it('heard the child → a short ✓ on the mic', () => {
    const { rerender } = render(
      <ServerLessonView state={live({ heard: 0 })} actions={actions()} desktop={false} />,
    );
    rerender(<ServerLessonView state={live({ heard: 1 })} actions={actions()} desktop={false} />);
    expect(screen.getByText('سمعتك')).toBeInTheDocument();
  });

  it('mic blocked → the one full-screen «سماح» prompt', () => {
    const a = view(live({ expects: 'text', micPrompt: true }));
    expect(screen.getByRole('dialog')).toHaveTextContent('المعلم عبدالله يريد أن يسمعك');
    fireEvent.click(screen.getByRole('button', { name: 'سماح' }));
    expect(a.allowTapped).toHaveBeenCalled();
  });

  it('sound blocked → the same «سماح» prompt (to hear the teacher)', () => {
    const a = view(live({ playbackBlocked: true, speaking: true }));
    expect(screen.getByRole('dialog')).toHaveTextContent('لنسمع المعلم عبدالله');
    fireEvent.click(screen.getByRole('button', { name: 'سماح' }));
    expect(a.allowTapped).toHaveBeenCalled();
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

  it('the server hadith text is shown like the ayat, with its word table (2026-10-05)', () => {
    view(
      live({
        segment: 'hadith',
        hadith: { title: 'برّ الوالدين', source: 'متفق عليه' },
        hadithText: 'HADITH-TEXT',
        words: [{ word: 'صحابتي', meaning: 'مصاحبتي' }],
      }),
    );
    expect(screen.getByText('حديث اليوم عن برّ الوالدين')).toBeInTheDocument();
    expect(screen.getByText('«HADITH-TEXT»')).toBeInTheDocument();
    expect(screen.getByText('صحابتي')).toBeInTheDocument();
    expect(screen.getByText('مصاحبتي')).toBeInTheDocument();
    expect(screen.queryByText('قيد المراجعة الشرعية')).toBeNull();
  });

  it('warming: the teacher getting ready, no input yet', () => {
    view({ ...initialServerState, phase: 'warming' });
    expect(screen.getByText('المعلّم يتجهّز… لحظات ونبدأ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ردّدت' })).toBeNull();
  });

  it('the lesson over: «عودة للرئيسية» (the call is done)', () => {
    const a = view(live({ phase: 'finished' }));
    fireEvent.click(screen.getByRole('button', { name: 'عودة للرئيسية' }));
    expect(a.goHome).toHaveBeenCalled();
  });

  describe('in English', () => {
    const en = (s: ServerLessonState) =>
      render(
        <I18nContext.Provider value={{ lang: 'en', m: MESSAGES.en, dir: 'ltr' }}>
          <ServerLessonView state={s} actions={actions()} desktop={false} />
        </I18nContext.Provider>,
      );

    it('the call chrome, the surah card label and the mic line are English; the ayat stay Arabic', () => {
      en(
        live({
          ayat: [{ ayah: 1, text: 'AYAH-ONE' }],
          currentAyah: 1,
          surahName: 'الإخلاص',
          reciting: true,
        }),
      );
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Teacher Adam' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Surah Al-Ikhlas' })).toBeInTheDocument();
      expect(screen.getByText('The reciter is reciting… listen')).toBeInTheDocument();
      expect(screen.getByText('AYAH-ONE').closest('[dir]')).toHaveAttribute('dir', 'rtl');
    });

    it('the hadith card and the review badge; the finished call', () => {
      const { unmount } = en(live({ segment: 'hadith', hadith: { title: 'برّ الوالدين', source: null } }));
      expect(screen.getByText("Today's hadith is about kindness to parents")).toBeInTheDocument();
      expect(screen.getByText('Under Sharia review')).toBeInTheDocument();
      unmount();
      en(live({ phase: 'finished' }));
      expect(screen.getByRole('button', { name: 'Back to home' })).toBeInTheDocument();
      expect(screen.getByText("Today's lesson complete ✓")).toBeInTheDocument();
    });
  });
});
