import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

  it('«المعلم يتجهز…» before the lesson starts (the character, no SVG)', () => {
    render(<ReadyingCall gender="boy" desktop={false} onExit={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('المعلّم يتجهّز');
    expect(document.querySelector('img[src="/characters/teacher-boy/idle.webp"]')).not.toBeNull();
  });
});
