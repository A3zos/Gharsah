import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MouthFrame } from '../../lesson/mouth';
import { Observable } from '../../lesson/observable';
import { TEACHER_NAME } from './teacherCharacter';
import { TeacherSprite } from './TeacherSprite';

const visible = (container: HTMLElement) =>
  [...container.querySelectorAll('img')]
    .filter((i) => i.className.includes('opacity-100'))
    .map((i) => i.getAttribute('src'));

afterEach(() => vi.useRealTimers());

describe('TeacherSprite', () => {
  it('boys get المعلم عبدالله, girls المعلمة سارة — all 7 frames preloaded, stacked', () => {
    const { container, rerender } = render(
      <TeacherSprite gender="boy" pose="speaking" talking={false} fallback="SVG" />,
    );
    expect(screen.getByRole('button', { name: TEACHER_NAME.boy })).toBeInTheDocument();
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(
      ['idle', 'mouth-small', 'mouth-open', 'mouth-wide', 'mouth-o', 'blink', 'happy'].map(
        (f) => `/characters/teacher-boy/${f}.webp`,
      ),
    );
    expect(visible(container)).toEqual(['/characters/teacher-boy/idle.webp']);
    rerender(<TeacherSprite gender="girl" pose="speaking" talking={false} fallback="SVG" />);
    expect(screen.getByRole('button', { name: 'المعلمة سارة' })).toBeInTheDocument();
    expect(visible(container)).toEqual(['/characters/teacher-girl/idle.webp']);
  });

  it('talking: the mouth follows the lip-sync frames', () => {
    const mouth = new Observable<MouthFrame>('idle');
    const { container } = render(
      <TeacherSprite gender="boy" pose="speaking" talking mouth={mouth} fallback="SVG" />,
    );
    act(() => {
      mouth.value = 'mouth-wide';
    });
    expect(visible(container)).toEqual(['/characters/teacher-boy/mouth-wide.webp']);
    act(() => {
      mouth.value = 'mouth-o';
    });
    expect(visible(container)).toEqual(['/characters/teacher-boy/mouth-o.webp']);
  });

  it('blinks (~120 ms) every 2–6 s while quiet', () => {
    vi.useFakeTimers();
    const { container } = render(
      <TeacherSprite gender="girl" pose="speaking" talking={false} fallback="SVG" />,
    );
    let blinked = false;
    for (let i = 0; i < 70 && !blinked; i++) {
      act(() => vi.advanceTimersByTime(100));
      blinked = visible(container)[0]?.endsWith('blink.webp') ?? false;
    }
    expect(blinked).toBe(true);
    act(() => vi.advanceTimersByTime(130));
    expect(visible(container)).toEqual(['/characters/teacher-girl/idle.webp']);
  });

  it('happy for ~1.5 s on a cue', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <TeacherSprite gender="boy" pose="speaking" talking={false} cheerKey={0} fallback="SVG" />,
    );
    rerender(<TeacherSprite gender="boy" pose="speaking" talking={false} cheerKey={1} fallback="SVG" />);
    expect(visible(container)).toEqual(['/characters/teacher-boy/happy.webp']);
    act(() => vi.advanceTimersByTime(1600));
    expect(visible(container)[0]).not.toContain('happy');
  });

  it('listening: no image change, a small tilt', () => {
    const { container } = render(
      <TeacherSprite gender="boy" pose="listening" talking={false} fallback="SVG" />,
    );
    expect(visible(container)).toEqual(['/characters/teacher-boy/idle.webp']);
    expect(container.querySelector('.rotate-\\[-3deg\\]')).not.toBeNull();
  });

  it('a frame that fails to load → the SVG teacher', () => {
    const { container } = render(
      <TeacherSprite gender="boy" pose="speaking" talking={false} fallback={<span>SVG-TEACHER</span>} />,
    );
    fireEvent.error(container.querySelectorAll('img')[3]!);
    expect(screen.getByText('SVG-TEACHER')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
});
