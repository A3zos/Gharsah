// The teacher character from the sprite frames in public/characters/ — المعلم عبدالله
// for boys, المعلمة سارة for girls (the child's stored gender). The SAME character on
// every lesson screen (CLAUDE.md §5). All frames are loaded up front and stacked;
// only opacity changes, so there is no flicker or layout shift.
//   speaking → the mouth follows the voice (lip-sync, ~12 fps)
//   quiet    → blinks every 2–6 s; «happy» for ~1.5 s on a cue
//   listening → no image change: a ~3° tilt with a soft scale (not under reduced motion)
// Any frame that fails to load → `fallback` (the old SVG teacher).
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { MouthFrame } from '../../lesson/mouth';
import type { Subscribe } from '../../lesson/observable';
import { cx } from '../../lib/cx';

import {
  FRAMES,
  TEACHER_NAME,
  teacherFrameSrc,
  type TeacherFrame,
  type TeacherGender,
} from './teacherCharacter';

export type { TeacherGender };
type Frame = TeacherFrame;

/** Natural sizes — every frame of a set has the same size and alignment. */
const ASPECT: Record<TeacherGender, string> = { boy: '591 / 990', girl: '564 / 980' };

const HAPPY_MS = 1500;
const BLINK_MS = 120;
const BLINK_MIN_MS = 2000;
const BLINK_SPREAD_MS = 4000;

export interface MouthSource {
  readonly value: MouthFrame;
  readonly subscribe: Subscribe<MouthFrame>;
}

const QUIET_MOUTH: MouthSource = { value: 'idle', subscribe: () => () => {} };

export function TeacherSprite({
  gender,
  pose,
  talking,
  happy = false,
  cheerKey = 0,
  mouth = QUIET_MOUTH,
  onTap,
  fallback,
}: {
  gender: TeacherGender;
  /** speaking (talks, bobs) · listening (leans in) · quiet (the reciter plays). */
  pose: 'speaking' | 'listening' | 'quiet';
  /** A line is being voiced now — the mouth follows `mouth`. */
  talking: boolean;
  /** Rising edge → «happy» for ~1.5 s (a correct answer, the end of the lesson). */
  happy?: boolean;
  /** Each change (after 0) → «happy» for ~1.5 s too. */
  cheerKey?: number;
  mouth?: MouthSource;
  onTap?: () => void;
  /** Shown when a frame can't load (the SVG teacher). */
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const mouthFrame = useSyncExternalStore(
    mouth.subscribe,
    () => mouth.value,
    () => 'idle' as MouthFrame,
  );

  // «happy» for HAPPY_MS on each cue: a rising edge of `happy`, or a new `cheerKey`.
  // The cue is derived during render (no state set inside an effect); only the timer
  // that ends it sets state.
  const [seen, setSeen] = useState({ happy, cheerKey });
  const [cue, setCue] = useState(0);
  if (seen.happy !== happy || seen.cheerKey !== cheerKey) {
    const rose = (happy && !seen.happy) || (cheerKey !== seen.cheerKey && cheerKey !== 0);
    setSeen({ happy, cheerKey });
    if (rose) setCue((c) => c + 1);
  }
  const [doneCue, setDoneCue] = useState(0);
  const cheering = cue !== doneCue;
  useEffect(() => {
    if (!cheering) return;
    const t = setTimeout(() => setDoneCue(cue), HAPPY_MS);
    return () => clearTimeout(t);
  }, [cue, cheering]);

  // Blink every 2–6 s while not talking.
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (talking || cheering) return;
    let open: ReturnType<typeof setTimeout>;
    let shut: ReturnType<typeof setTimeout>;
    const schedule = () => {
      shut = setTimeout(
        () => {
          setBlinking(true);
          open = setTimeout(() => {
            setBlinking(false);
            schedule();
          }, BLINK_MS);
        },
        BLINK_MIN_MS + Math.random() * BLINK_SPREAD_MS,
      );
    };
    schedule();
    return () => {
      clearTimeout(shut);
      clearTimeout(open);
      setBlinking(false);
    };
  }, [talking, cheering]);

  if (failed) return <>{fallback}</>;

  const shown: Frame = cheering ? 'happy' : talking ? mouthFrame : blinking ? 'blink' : 'idle';
  const listening = pose === 'listening';
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={TEACHER_NAME[gender]}
      className="relative flex h-full w-full cursor-pointer items-end justify-center border-0 bg-transparent p-0"
    >
      {/* soft glow behind the character while it talks or listens */}
      {pose !== 'quiet' && (
        <span
          aria-hidden="true"
          className={cx(
            'absolute bottom-0 left-1/2 aspect-square h-[78%] -translate-x-1/2 animate-[gh-glow-2_2.6s_ease-out_infinite] rounded-full',
            listening ? 'bg-glow-listening' : 'bg-glow-speaking',
          )}
        />
      )}
      <span
        className={cx(
          'relative h-full origin-bottom transition-transform duration-500 ease-out motion-reduce:transition-none',
          listening && 'scale-[1.03] rotate-[-3deg] motion-reduce:scale-100 motion-reduce:rotate-0',
          pose === 'quiet' && 'opacity-90',
        )}
        style={{ aspectRatio: ASPECT[gender] }}
      >
        <span className="absolute inset-0 origin-bottom animate-[gh-teacher-breathe_4.2s_ease-in-out_infinite]">
          {FRAMES.map((f) => (
            <img
              key={f}
              src={teacherFrameSrc(gender, f)}
              alt=""
              aria-hidden="true"
              draggable={false}
              loading="eager"
              decoding="async"
              onError={() => setFailed(true)}
              className={cx(
                'pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom select-none',
                f === shown ? 'opacity-100' : 'opacity-0',
              )}
            />
          ))}
        </span>
      </span>
    </button>
  );
}
