import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nContext, MESSAGES } from '../../i18n/i18n';
import { initialLessonState, type LessonState } from '../../lesson/state';
import { LessonView, ReadyingCall, type LessonActions } from './LessonView';

const actions = Object.fromEntries(
  [
    'tapTeacher',
    'micTap',
    'continueTapped',
    'replayAyah',
    'play',
    'reRecord',
    'repeatTapped',
    'exit',
    'goHome',
  ].map((k) => [k, vi.fn()]),
) as unknown as LessonActions;
const level = { value: 0, subscribe: () => () => {} };
const state: LessonState = {
  ...initialLessonState,
  screen: 'intro',
  beat: 'speaking',
  teacherSpeaking: true,
  caption: 'وهي قصيرة — أربع آيات فقط!',
};
const view = (voiceMissing: boolean, gender: 'boy' | 'girl' = 'boy') =>
  render(
    <LessonView
      state={state}
      plan={{ hasProject: false }}
      glance={{ surahsTotal: 0, streak: 0, streakDays: [] }}
      actions={actions}
      level={level}
      desktop={false}
      voiceMissing={voiceMissing}
      gender={gender}
    />,
  );

describe('LessonView (built-in) — only the teacher talks', () => {
  it('no caption while a voice speaks', () => {
    view(false);
    expect(screen.queryByText('وهي قصيرة — أربع آيات فقط!')).toBeNull();
    expect(screen.getByText('المعلم عبدالله')).toBeInTheDocument();
  });

  it('the line is written only when no voice can say it', () => {
    view(true, 'girl');
    expect(screen.getByText('وهي قصيرة — أربع آيات فقط!')).toBeInTheDocument();
    expect(screen.getByText('المعلمة سارة')).toBeInTheDocument();
  });

  it('English: labels, the teacher, the plan (surah name, Latin digits) — Arabic nowhere in the chrome', () => {
    render(
      <I18nContext.Provider value={{ lang: 'en', m: MESSAGES.en, dir: 'ltr' }}>
        <LessonView
          state={{ ...state, lineIndex: 1 }}
          plan={{ surahName: 'الإخلاص', surahAyat: 4, hadithTitle: 'حديث برّ الوالدين', hasProject: true }}
          glance={{ surahsTotal: 0, streak: 0, streakDays: [] }}
          actions={actions}
          level={level}
          desktop={false}
          gender="girl"
        />
      </I18nContext.Provider>,
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Teacher Sarah')).toBeInTheDocument();
    expect(screen.getByText("Today's plan")).toBeInTheDocument();
    expect(screen.getByText('Surah Al-Ikhlas')).toBeInTheDocument();
    expect(screen.getByText('4 ayat')).toBeInTheDocument();
    expect(screen.getByText('Hadith on kindness to parents')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(screen.getByRole('button', { name: 'End the call' })).toBeInTheDocument();
  });

  it('Indonesian: the surah card keeps the ayat Arabic and right-to-left; the labels are Indonesian', () => {
    render(
      <I18nContext.Provider value={{ lang: 'id', m: MESSAGES.id, dir: 'ltr' }}>
        <LessonView
          state={{
            ...initialLessonState,
            screen: 'ayah',
            beat: 'reciting',
            stage: 2,
            repeatsTarget: 5,
            surahName: 'الإخلاص',
            ayahRef: { surah: 112, ayah: 2 },
            surahAyat: [{ ayah: 1, text: 'نص' }],
          }}
          plan={{ hasProject: false }}
          glance={{ surahsTotal: 0, streak: 0, streakDays: [] }}
          actions={actions}
          level={level}
          desktop={false}
        />
      </I18nContext.Provider>,
    );
    expect(screen.getByText('Tahap 2 dari 3 — Ayat demi ayat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Surah Al-Ikhlas · Ayat 2' })).toBeInTheDocument();
    const ayat = screen.getByText('نص').closest('[dir]');
    expect(ayat).toHaveAttribute('dir', 'rtl');
    expect(ayat).toHaveAttribute('lang', 'ar');
  });

  it('«المعلم يتجهز…» before the lesson starts (the character, no SVG)', () => {
    render(<ReadyingCall gender="boy" desktop={false} onExit={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('المعلّم يتجهّز');
    expect(document.querySelector('img[src="/characters/teacher-boy/idle.webp"]')).not.toBeNull();
  });
});
