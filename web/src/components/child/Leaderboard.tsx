// «المتصدّرون هذا الأسبوع» on the child home: ranks 1–5 (dense; ties share a rank),
// then — when the child isn't among them — «⋯» and the child's own row with the real
// rank. Other children are never identified: rank + a neutral avatar + points only.
// The data is get_leaderboard() (aggregate only, server-side).
import { buildBoard, daysUntilReset, type BoardRow, type LeaderBoard } from '../../data/student';
import { toArabicDigits } from '../../lib/arabicDigits';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';
import { ChildAvatar } from './ChildAvatar';

export function Leaderboard({
  board,
  myFirstName,
  avatarId,
}: {
  board: LeaderBoard | null;
  myFirstName: string;
  avatarId: string;
}) {
  const { rows, own, separator, note } = buildBoard(board, `${myFirstName} — أنت`);
  const left = daysUntilReset();
  return (
    <section
      aria-labelledby="board-title"
      className="flex shrink-0 animate-[gh-rise_.5s_ease-out_.15s_both] flex-col gap-[12px] rounded-px-28 bg-surface px-[16px] pt-[18px] pb-[16px] shadow-card"
    >
      <div className="flex items-center justify-between gap-[10px]">
        <h2
          id="board-title"
          className="m-0 flex items-center gap-[8px] font-heading text-[18px] leading-[1.5] font-bold"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 20 H17 M12 16.5 V20" stroke={C.goldDeep} strokeWidth="2" strokeLinecap="round" />
            <path d="M7 3.5 H17 V9 C17 12 14.8 14.5 12 14.5 C9.2 14.5 7 12 7 9 Z" fill={C.gold} />
            <path
              d="M7 5.5 H4.5 V7 C4.5 8.9 5.6 10.3 7 10.7 M17 5.5 H19.5 V7 C19.5 8.9 18.4 10.3 17 10.7"
              stroke={C.goldDeep}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          المتصدّرون هذا الأسبوع
        </h2>
        <span className="rounded-pill bg-border-soft px-[10px] py-[5px] text-[11px] font-extrabold whitespace-nowrap text-text-muted">
          يتبقّى {left === 1 ? 'يوم' : left === 2 ? 'يومان' : `${toArabicDigits(left)} أيام`}
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-[7px] p-0">
        {rows.map((r, i) => (
          <LeaderRow key={`${i}-${r.rank}`} row={r} avatarId={avatarId} />
        ))}
        {separator && (
          <li aria-hidden="true" className="text-center font-heading text-[18px] leading-[1] text-text-muted">
            ⋯
          </li>
        )}
        {own && <LeaderRow row={own} avatarId={avatarId} />}
      </ol>
      {note && (
        <div className="flex items-center gap-[10px] rounded-px-16 bg-green-tint px-[13px] py-[11px]">
          <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2.8 L14.3 9.2 L21 9.4 L15.7 13.5 L17.6 20 L12 16.2 L6.4 20 L8.3 13.5 L3 9.4 L9.7 9.2 Z"
              fill={C.primary}
            />
          </svg>
          <span className="grow text-[13px] leading-[1.7] font-bold">{note}</span>
        </div>
      )}
      <span className="text-center text-[11.5px] text-text-muted">
        تبدأ المنافسة من جديد كل أسبوع — فرصة جديدة للجميع.
      </span>
    </section>
  );
}

function LeaderRow({ row, avatarId }: { row: BoardRow; avatarId: string }) {
  const medal = row.me
    ? 'bg-deep-green text-surface'
    : row.rank === 1
      ? 'bg-gold text-on-gold'
      : row.rank === 2
        ? 'bg-medal-silver text-medal-silver-text'
        : row.rank === 3
          ? 'bg-avatar-skin-mid text-avatar-features'
          : 'bg-border-soft text-text-muted';
  return (
    <li
      aria-current={row.me ? 'true' : undefined}
      className={cx(
        'flex items-center gap-[10px] rounded-px-18 px-[10px] py-[8px]',
        row.me ? 'border-[2px] border-deep-green bg-green-tint' : 'border border-border-soft bg-background',
      )}
    >
      <span
        className={cx(
          'flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full font-heading text-[14px] font-extrabold',
          medal,
        )}
      >
        {toArabicDigits(row.rank)}
      </span>
      <span className="shrink-0">
        {row.me ? (
          <ChildAvatar id={avatarId} size={38} />
        ) : (
          // Other children never show a personal avatar — one generic one.
          <svg width="38" height="38" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <circle cx="32" cy="32" r="32" fill={C.borderSoft} />
            <circle cx="32" cy="26" r="10" fill={C.stageOffStem} />
            <path d="M14 54 C14 43 22 38 32 38 C42 38 50 43 50 54 Z" fill={C.stageOffStem} />
          </svg>
        )}
      </span>
      {/* Other children: rank + a neutral avatar + points only — never a name. */}
      <span className="grow text-[14.5px] font-extrabold text-deep-green">{row.label}</span>
      <span
        className={cx(
          'font-heading text-[16px] font-extrabold',
          row.me ? 'text-deep-green' : 'text-text-dark',
        )}
      >
        {toArabicDigits(row.points)} <span aria-label="نجوم">⭐</span>
      </span>
    </li>
  );
}
