// design/v3 ParentWebDash «تسجيلات المشاريع» row: play button, title + status
// pill, a line under it, the 32-bar waveform (played part in deep green) and the
// duration. The audio loads on first play through Storage rules (parent only).
import { useEffect, useRef, useState } from 'react';

import { formatDuration, loadRecording, type ProjectSubmission } from '../../data/submissions';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';

/** The design's fixed bar heights (px). */
const BARS = [
  9, 15, 22, 12, 19, 26, 10, 17, 24, 14, 20, 27, 11, 18, 25, 13, 21, 16, 9, 14, 23, 28, 17, 12, 8, 19, 24, 15,
  10, 7,
];

export function Waveform({ played }: { played: number }) {
  const on = Math.round(played * BARS.length);
  return (
    <span className="flex shrink-0 items-center gap-[3px]" aria-hidden="true">
      {BARS.map((h, i) => (
        <span
          key={i}
          className={cx('w-[3px] rounded-px-2', i < on ? 'bg-deep-green' : 'bg-voice-bar-off')}
          style={{ height: h }}
        />
      ))}
    </span>
  );
}

/** Loads the recording on first play (Storage rules, parent only) and plays it. */
function useRecording(submission: ProjectSubmission) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [error, setError] = useState(false);

  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  const toggle = async () => {
    setError(false);
    try {
      if (!audio.current) {
        url.current = await loadRecording(submission);
        const a = new Audio(url.current);
        a.addEventListener('timeupdate', () => a.duration && setPlayed(a.currentTime / a.duration));
        a.addEventListener('ended', () => {
          setPlaying(false);
          setPlayed(1);
        });
        audio.current = a;
      }
      if (playing) {
        audio.current.pause();
        setPlaying(false);
      } else {
        await audio.current.play();
        setPlaying(true);
      }
    } catch {
      setError(true);
      setPlaying(false);
    }
  };

  return { playing, played, error, toggle, position: played * submission.durationMs };
}

export function RecordingRow({
  submission,
  title,
  pill,
  line,
  childName,
}: {
  submission: ProjectSubmission;
  title: string;
  pill: string;
  line: string;
  childName: string;
}) {
  const { playing, played, error, toggle } = useRecording(submission);
  const active = playing || played > 0;
  return (
    <div
      className={cx(
        'flex items-center gap-[18px] rounded-px-24 border-[1.5px] bg-surface px-[22px] py-[20px]',
        active ? 'border-primary' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? `إيقاف تسجيل ${childName}` : `استمع إلى تسجيل ${childName}`}
        aria-pressed={playing}
        className={cx(
          'flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border-0',
          active ? 'bg-deep-green' : 'bg-green-tint',
        )}
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.5" fill={C.surface} />
            <rect x="14" y="5" width="4" height="14" rx="1.5" fill={C.surface} />
          </svg>
        ) : (
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 4.5 L19 12 L7 19.5 Z" fill={active ? C.surface : C.deepGreen} />
          </svg>
        )}
      </button>
      <span className="flex min-w-0 grow flex-col gap-[7px]">
        <span className="flex flex-wrap items-center gap-[10px]">
          <span className="text-[16.5px] font-extrabold">{title}</span>
          <span className="rounded-pill bg-green-tint px-[11px] py-[5px] text-[11.5px] font-extrabold text-deep-green">
            {pill}
          </span>
        </span>
        <span className={cx('text-[13.5px] leading-[1.8]', error ? 'text-error-text' : 'text-text-muted')}>
          {error ? 'تعذّر تشغيل التسجيل — حاول مرة أخرى.' : line}
        </span>
      </span>
      <Waveform played={played} />
      <span className="shrink-0 font-heading text-[14px] font-bold text-text-muted">
        {formatDuration(submission.durationMs)}
      </span>
    </div>
  );
}

/** A project assigned but not reported yet («بانتظار حكايته غدًا»). */
export function PendingRecordingRow({ title, childName }: { title: string; childName: string }) {
  return (
    <div className="flex items-center gap-[18px] rounded-px-24 border-[1.5px] border-border bg-surface px-[22px] py-[20px]">
      <span
        className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-green-tint"
        aria-hidden="true"
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <path d="M7 4.5 L19 12 L7 19.5 Z" fill={C.deepGreen} />
        </svg>
      </span>
      <span className="flex min-w-0 grow flex-col gap-[7px]">
        <span className="flex flex-wrap items-center gap-[10px]">
          <span className="text-[16.5px] font-extrabold">{title}</span>
          <span className="rounded-pill bg-gold-tint px-[11px] py-[5px] text-[11.5px] font-extrabold text-warning-text">
            بانتظار حكايته غدًا
          </span>
        </span>
        <span className="text-[13.5px] leading-[1.8] text-text-muted">
          يحكي {childName} غدًا ماذا فعل — ثم يظهر التسجيل هنا.
        </span>
      </span>
      <Waveform played={0} />
      <span className="shrink-0 font-heading text-[14px] font-bold text-text-muted">—</span>
    </div>
  );
}

function PlayPauseGlyph({ playing }: { playing: boolean }) {
  return playing ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.5" fill={C.surface} />
      <rect x="14" y="5" width="4" height="14" rx="1.5" fill={C.surface} />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4.5 L19 12 L7 19.5 Z" fill={C.surface} />
    </svg>
  );
}

/** design/v3 DashProjects player: 52px button, waveform, position · «بصوت …» · duration. */
export function CompactPlayer({
  submission,
  childName,
}: {
  submission: ProjectSubmission;
  childName: string;
}) {
  const { playing, played, error, toggle, position } = useRecording(submission);
  return (
    <div className="flex items-center gap-[12px] rounded-px-18 border-[1.5px] border-border bg-surface p-[9px]">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? `إيقاف تسجيل ${childName}` : `استمع إلى تسجيل ${childName}`}
        aria-pressed={playing}
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-0 bg-deep-green"
      >
        <PlayPauseGlyph playing={playing} />
      </button>
      <div className="flex min-w-0 grow flex-col gap-[7px]">
        <div className="flex h-[32px] items-center overflow-hidden">
          <Waveform played={played} />
        </div>
        <div className="flex items-center justify-between gap-[8px]">
          <span className="text-[11.5px] font-bold text-text-muted">{formatDuration(position)}</span>
          <span className={cx('text-[11.5px]', error ? 'text-error-text' : 'text-text-muted')}>
            {error ? 'تعذّر التشغيل' : `بصوت ${childName}`}
          </span>
          <span className="text-[11.5px] font-bold text-text-muted">
            {formatDuration(submission.durationMs)}
          </span>
        </div>
      </div>
    </div>
  );
}
