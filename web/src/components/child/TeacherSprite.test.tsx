import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MouthFrame } from '../../lesson/mouth';
import { Observable } from '../../lesson/observable';
import { getTeacher } from '../../content/teachers';
import { TeacherSprite } from './TeacherSprite';

const visible = (container: HTMLElement) =>
  [...container.querySelectorAll('img')]
    .filter((i) => i.className.includes('opacity-100'))
    .map((i) => i.getAttribute('src'));

/** The frames arrive (a frame is only shown once it has loaded). */
const loadAll = (container: HTMLElement) =>
  container.querySelectorAll('img').forEach((i) => fireEvent.load(i));

afterEach(() => vi.useRealTimers());

describe('TeacherSprite', () => {
  it('boys get المعلم عبدالله, girls المعلمة سارة — all 7 frames preloaded, stacked', () => {
    const { container, rerender } = render(
      <TeacherSprite teacher={getTeacher('ar', 'boy')} pose="speaking" talking={false} fallback="SVG" />,
    );
    loadAll(container);
    expect(screen.getByRole('button', { name: 'المعلم عبدالله' })).toBeInTheDocument();
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(
      ['idle', 'mouth-small', 'mouth-open', 'mouth-wide', 'mouth-o', 'blink', 'happy'].map(
        (f) => `/characters/teacher-boy/${f}.webp`,
      ),
    );
    expect(visible(container)).toEqual(['/characters/teacher-boy/idle.webp']);
    rerender(
      <TeacherSprite teacher={getTeacher('ar', 'girl')} pose="speaking" talking={false} fallback="SVG" />,
    );
    loadAll(container);
    expect(screen.getByRole('button', { name: 'المعلمة سارة' })).toBeInTheDocument();
    expect(visible(container)).toEqual(['/characters/teacher-girl/idle.webp']);
  });

  it('talking: the mouth follows the lip-sync frames', () => {
    const mouth = new Observable<MouthFrame>('idle');
    const { container } = render(
      <TeacherSprite
        teacher={getTeacher('ar', 'boy')}
        pose="speaking"
        talking
        mouth={mouth}
        fallback="SVG"
      />,
    );
    loadAll(container);
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
      <TeacherSprite teacher={getTeacher('ar', 'girl')} pose="speaking" talking={false} fallback="SVG" />,
    );
    loadAll(container);
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
      <TeacherSprite
        teacher={getTeacher('ar', 'boy')}
        pose="speaking"
        talking={false}
        cheerKey={0}
        fallback="SVG"
      />,
    );
    loadAll(container);
    rerender(
      <TeacherSprite
        teacher={getTeacher('ar', 'boy')}
        pose="speaking"
        talking={false}
        cheerKey={1}
        fallback="SVG"
      />,
    );
    expect(visible(container)).toEqual(['/characters/teacher-boy/happy.webp']);
    act(() => vi.advanceTimersByTime(1600));
    expect(visible(container)[0]).not.toContain('happy');
  });

  it('listening: no image change, a small tilt', () => {
    const { container } = render(
      <TeacherSprite teacher={getTeacher('ar', 'boy')} pose="listening" talking={false} fallback="SVG" />,
    );
    loadAll(container);
    expect(visible(container)).toEqual(['/characters/teacher-boy/idle.webp']);
    expect(container.querySelector('.rotate-\\[-3deg\\]')).not.toBeNull();
  });

  it('while loading: a soft placeholder and no frame switching — never the SVG', () => {
    const mouth = new Observable<MouthFrame>('mouth-wide');
    const { container } = render(
      <TeacherSprite
        teacher={getTeacher('ar', 'boy')}
        pose="speaking"
        talking
        mouth={mouth}
        fallback={<span>SVG-TEACHER</span>}
      />,
    );
    expect(screen.queryByText('SVG-TEACHER')).toBeNull();
    expect(visible(container)).toEqual([]); // nothing shown before it loads
    const idle = container.querySelector('img[src$="/idle.webp"]')!;
    fireEvent.load(idle);
    // mouth-wide isn't loaded yet → stays on idle instead of blanking
    expect(visible(container)).toEqual(['/characters/teacher-boy/idle.webp']);
  });

  it("an en / id teacher's frame that fails twice → the Arabic teacher of the same gender", () => {
    const { container } = render(
      <TeacherSprite
        teacher={getTeacher('en', 'girl')}
        pose="speaking"
        talking={false}
        fallback={<span>SVG-TEACHER</span>}
      />,
    );
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/characters/teacher-en-girl/idle.webp');
    const wide = () => container.querySelectorAll('img')[3]!;
    fireEvent.error(wide());
    fireEvent.error(wide());
    // the whole set switches (never a mix of two teachers); not the SVG
    expect(screen.queryByText('SVG-TEACHER')).toBeNull();
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs.every((src) => src!.startsWith('/characters/teacher-girl/'))).toBe(true);
  });

  it('every teacher renders in the same box, contained and bottom-aligned', () => {
    for (const lang of ['ar', 'en', 'id'] as const)
      for (const gender of ['boy', 'girl'] as const) {
        const { container, unmount } = render(
          <TeacherSprite teacher={getTeacher(lang, gender)} pose="quiet" talking={false} fallback="SVG" />,
        );
        const box = container.querySelector<HTMLElement>('[style*="aspect-ratio"]')!;
        expect(box.style.aspectRatio).toBe('591 / 990');
        const img = container.querySelector('img')!;
        expect(img.className).toContain('object-contain');
        expect(img.className).toContain('object-bottom');
        unmount();
      }
  });

  it('a frame that fails is retried once; a second failure → the SVG teacher', () => {
    const { container } = render(
      <TeacherSprite
        teacher={getTeacher('ar', 'boy')}
        pose="speaking"
        talking={false}
        fallback={<span>SVG-TEACHER</span>}
      />,
    );
    const wide = () => container.querySelectorAll('img')[3]!;
    fireEvent.error(wide());
    expect(screen.queryByText('SVG-TEACHER')).toBeNull();
    expect(wide().getAttribute('src')).toBe('/characters/teacher-boy/mouth-wide.webp?retry=1');
    fireEvent.error(wide());
    expect(screen.getByText('SVG-TEACHER')).toBeInTheDocument();
  });

  it('the jaw eases down 1–2 px when the mouth opens', () => {
    const mouth = new Observable<MouthFrame>('mouth-small');
    const { container } = render(
      <TeacherSprite
        teacher={getTeacher('ar', 'boy')}
        pose="speaking"
        talking
        mouth={mouth}
        fallback="SVG"
      />,
    );
    loadAll(container);
    expect(container.querySelector('[class~="translate-y-[1.5px]"]')).toBeNull();
    act(() => {
      mouth.value = 'mouth-open';
    });
    expect(container.querySelector('[class~="translate-y-[1.5px]"]')).not.toBeNull();
  });
});
