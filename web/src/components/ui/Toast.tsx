import { CheckIcon } from './icons';

/** A short confirmation at the bottom of the screen («تم النسخ»). No design frame — styled with the app's pills. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(28px+env(safe-area-inset-bottom))] z-50 flex justify-center"
    >
      {message && (
        <span className="flex animate-[gh-rise_.25s_ease-out_both] items-center gap-[8px] rounded-pill bg-deep-green px-[18px] py-[11px] text-[14.5px] font-extrabold text-surface shadow-green-12-24-26">
          <CheckIcon size={16} color="surface" />
          {message}
        </span>
      )}
    </div>
  );
}
