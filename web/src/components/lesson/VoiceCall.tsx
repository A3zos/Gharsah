// The pieces of a pure voice call shared by both lessons: the mic (listening /
// «I heard you» — an animation, no text, no button) and the ONE allowed button: a
// full-screen «سماح» prompt when the mic (or the sound) needs the child's tap.
import { useEffect, useState } from 'react';

import { fill, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { type TeacherGender } from '../child/teacherCharacter';
import { getTeacher, teacherName, type Teacher } from '../../content/teachers';
import { C } from '../ui/color';
import { MicIndicator, type LevelSource } from './LessonView';

/** The mic at the bottom of the call: dim while the teacher talks, live while listening, a ✓ when heard. */
export function VoiceMic({
  live,
  heardKey,
  level,
  label,
}: {
  live: boolean;
  /** Each change → a short «I heard you» on the mic. */
  heardKey: number;
  level?: LevelSource;
  /** For screen readers only. */
  label: string;
}) {
  const { m } = useI18n();
  const [flashFor, setFlashFor] = useState(heardKey);
  const flashing = heardKey !== 0 && flashFor !== heardKey;
  useEffect(() => {
    if (!flashing) return;
    const t = setTimeout(() => setFlashFor(heardKey), 900);
    return () => clearTimeout(t);
  }, [heardKey, flashing]);
  return (
    <div className="relative flex shrink-0 justify-center">
      <MicIndicator live={live} level={level} label={flashing ? m.lesson.heard : label} hideLabel />
      {flashing && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 flex h-[76px] w-[76px] -translate-x-1/2 animate-[gh-pop_.5s_ease-out_both] items-center justify-center rounded-full bg-primary"
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5 L10 17.5 L19 7"
              stroke={C.surface}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </div>
  );
}

/**
 * The one button of the call: allow the mic (or the sound). Full screen, friendly,
 * a single big «سماح». TODO(design): no designed mic-permission screen yet.
 */
export function AllowPrompt({
  reason,
  gender,
  onAllow,
  teacher: locked,
}: {
  reason: 'mic' | 'sound';
  gender: TeacherGender;
  onAllow: () => void;
  /** The call's teacher (locked at the call's start); default: the UI language's. */
  teacher?: Teacher;
}) {
  const { lang, m } = useI18n();
  const t = m.lesson.teacher[gender];
  const teacher = teacherName(m, locked ?? getTeacher(lang, gender));
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="allow-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-[24px]"
    >
      <div className="flex w-full max-w-[420px] flex-col items-center gap-[18px] text-center">
        <span
          aria-hidden="true"
          className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-gold shadow-lesson-mic-live"
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            {reason === 'mic' ? (
              <>
                <rect x="9" y="3" width="6" height="11" rx="3" fill={C.surface} />
                <path
                  d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V21.2"
                  stroke={C.surface}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <path
                d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z M16.5 8.5 C18 10 18 14 16.5 15.5"
                stroke={C.surface}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
          </svg>
        </span>
        <h2 id="allow-title" className="m-0 font-heading text-[26px] leading-[1.4] font-bold">
          {reason === 'mic'
            ? fill(lang, t.allowMicTitle, { teacher })
            : fill(lang, m.lesson.allow.soundTitle, { teacher })}
        </h2>
        <p className="m-0 text-[17px] leading-[1.8] font-bold text-text-muted">
          {reason === 'mic' ? t.allowMicBody : t.allowSoundBody}
        </p>
        <button
          type="button"
          onClick={onAllow}
          autoFocus
          className={cx(
            'flex h-[64px] w-full max-w-[320px] cursor-pointer items-center justify-center rounded-px-22 border-0 bg-deep-green font-heading text-[22px] font-bold text-surface shadow-lesson-home-button',
          )}
        >
          {m.lesson.allow.button}
        </button>
      </div>
    </div>
  );
}
