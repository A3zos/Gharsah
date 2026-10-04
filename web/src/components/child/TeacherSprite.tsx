// The teacher character from the sprite frames in public/characters/<folder>/ — the
// teacher of the UI language for the child's gender (content/teachers.ts: المعلم عبدالله
// / المعلمة سارة, Teacher Adam / Maryam, Ustaz Ahmad / Ustazah Aisyah). The SAME character
// on every lesson screen of a call (CLAUDE.md §5). All frames are loaded up front and
// stacked; only opacity changes, so there is no flicker or layout shift. The sets have
// different aspect ratios: one box ratio for all, frames object-contain + bottom-aligned
// at the full height, so every teacher's face is the same size.
//   speaking → the mouth follows the voice (lip-sync, ~8 fps)
//   quiet    → blinks every 2–6 s; «happy» for ~1.5 s on a cue
//   listening → no image change: a ~3° tilt with a soft scale (not under reduced motion)
// Any frame that fails to load → `fallback` (the old SVG teacher).
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useI18n } from '../../i18n/i18n';
import type { MouthFrame } from '../../lesson/mouth';
import type { Subscribe } from '../../lesson/observable';
import { cx } from '../../lib/cx';

import { arabicTeacher, teacherName } from '../../content/teachers';
import {
  FRAMES,
  teacherFrameSrc,
  type Teacher,
  type TeacherFrame,
  type TeacherGender,
} from './teacherCharacter';

export type { Teacher, TeacherGender };
type Frame = TeacherFrame;

/** One box for every teacher: the widest set's ratio (teacher-boy 591×990); slimmer sets sit centered. */
const BOX_ASPECT = '591 / 990';

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
  teacher,
  pose,
  talking,
  happy = false,
  cheerKey = 0,
  mouth = QUIET_MOUTH,
  onTap,
  fallback,
}: {
  /** Locked for the call (a language change applies from the next lesson). */
  teacher: Teacher;
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
  const { m } = useI18n();
  const [failed, setFailed] = useState(false);
  // A frame that 404s twice → the whole set switches to the Arabic teacher of the same
  // gender (never a mix of two teachers); that one failing too → the SVG teacher.
  const [shownTeacher, setShownTeacher] = useState(teacher);
  const [forTeacher, setForTeacher] = useState(teacher);
  if (forTeacher.folder !== teacher.folder) {
    setForTeacher(teacher);
    setShownTeacher(teacher);
  }
  // Frames that have loaded, and frames already retried once (a second failure → SVG).
  const [loaded, setLoaded] = useState<ReadonlySet<Frame>>(() => new Set());
  const [retried, setRetried] = useState<ReadonlySet<Frame>>(() => new Set());
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

  const wanted: Frame = cheering ? 'happy' : talking ? mouthFrame : blinking ? 'blink' : 'idle';
  // Never switch to a frame that isn't there yet (it would blank the character).
  const shown: Frame = loaded.has(wanted) ? wanted : 'idle';
  const jaw = shown === 'mouth-open' || shown === 'mouth-wide' || shown === 'mouth-o';
  const listening = pose === 'listening';
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={teacherName(m, shownTeacher)}
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
        style={{ aspectRatio: BOX_ASPECT }}
      >
        <span className="absolute inset-0 origin-bottom animate-[gh-teacher-breathe_4.2s_ease-in-out_infinite]">
          {/* Until the idle frame is in: a soft placeholder (never the old SVG while loading). */}
          {!loaded.has('idle') && (
            <span
              aria-hidden="true"
              className="absolute inset-x-[18%] top-[6%] bottom-0 animate-[gh-breathe_2.4s_ease-in-out_infinite] rounded-t-full bg-green-tint"
            />
          )}
          {/* a tiny jaw-like ease (1–2 px) when the mouth opens */}
          <span
            className={cx(
              'absolute inset-0 transition-transform duration-100 ease-out motion-reduce:transition-none',
              jaw && 'translate-y-[1.5px]',
            )}
          >
            {FRAMES.map((f) => (
              <img
                key={`${shownTeacher.folder}/${f}`}
                src={
                  retried.has(f)
                    ? `${teacherFrameSrc(shownTeacher, f)}?retry=1`
                    : teacherFrameSrc(shownTeacher, f)
                }
                alt=""
                aria-hidden="true"
                draggable={false}
                loading="eager"
                decoding="async"
                onLoad={() => setLoaded((s) => (s.has(f) ? s : new Set(s).add(f)))}
                onError={() => {
                  if (!retried.has(f)) return setRetried((s) => new Set(s).add(f));
                  const ar = arabicTeacher(shownTeacher.gender);
                  if (ar.folder === shownTeacher.folder) return setFailed(true);
                  setShownTeacher(ar);
                  setLoaded(new Set());
                  setRetried(new Set());
                }}
                className={cx(
                  'pointer-events-none absolute inset-0 h-full w-full object-contain object-bottom select-none',
                  f === shown && loaded.has(f) ? 'opacity-100' : 'opacity-0',
                )}
              />
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}
