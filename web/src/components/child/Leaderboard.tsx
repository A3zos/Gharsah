// «المتصدّرون هذا الأسبوع» on the child home: ranks 1–5 (dense; ties share a rank),
// then — when the child isn't among them — «⋯» and the child's own row with the real
// rank. Every row (product rule 2026-10-05): [rank] [avatar] «عمر» + « عبدالعزيز» [flag]
// … [stars]; «بطل» / «بطلة» when the parent turned names off. First names only — the
// data is get_leaderboard() (server-side; never a last name, email, age or id).
import { buildBoard, daysUntilReset, type BoardRow, type LeaderBoard } from '../../data/student';
import { countPhrase, formatNumber, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { C } from '../ui/color';
import { FlagIcon } from '../ui/FlagIcon';
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
  const { lang, m } = useI18n();
  const t = m.child.board;
  const { rows, own, separator, note } = buildBoard(board, t.me.replace('{name}', myFirstName), lang);
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
          {t.title}
        </h2>
        <span className="rounded-pill bg-border-soft px-[10px] py-[5px] text-[11px] font-extrabold whitespace-nowrap text-text-muted">
          {countPhrase(lang, left, t.left)}
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
      <span className="text-center text-[11.5px] text-text-muted">{t.reset}</span>
    </section>
  );
}

/** «عمر» bold + « عبدالعزيز» muted (+ « — أنت»); «بطل» / «بطلة»; ellipsis when long. */
function RowName({ row }: { row: BoardRow }) {
  const t = useI18n().m.child.board;
  const [before = '', after = ''] = t.me.split('{name}');
  if ((!row.firstName && !row.hero) || (row.me && !row.firstName && row.label)) {
    // an older database (only the own row has a name), or the child's own row with names
    // turned off for others: the child still sees their own first name
    return (
      <span className="min-w-0 grow truncate text-[14.5px] font-extrabold text-deep-green">{row.label}</span>
    );
  }
  const name = row.firstName ? (
    <>
      <span className="font-extrabold">{row.firstName}</span>
      {row.fatherName && <span className="font-semibold text-text-muted"> {row.fatherName}</span>}
    </>
  ) : (
    <span className="font-extrabold">{t.hero[row.hero!]}</span>
  );
  return (
    <span
      dir="auto"
      className={cx('min-w-0 grow truncate text-[14.5px]', row.me ? 'text-deep-green' : 'text-text-dark')}
    >
      {row.me ? (
        <>
          {before}
          {name}
          <span className="font-extrabold">{after}</span>
        </>
      ) : (
        name
      )}
    </span>
  );
}

function LeaderRow({ row, avatarId }: { row: BoardRow; avatarId: string }) {
  const { lang, m } = useI18n();
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
        {formatNumber(lang, row.rank)}
      </span>
      <span className="shrink-0">
        <ChildAvatar id={row.me ? avatarId : (row.avatar ?? 'neutral')} size={38} />
      </span>
      <RowName row={row} />
      {row.country && <FlagIcon country={row.country} size={18} />}
      <span
        className={cx(
          'font-heading text-[16px] font-extrabold',
          row.me ? 'text-deep-green' : 'text-text-dark',
        )}
      >
        {formatNumber(lang, row.points)} <span aria-label={m.child.board.starsLabel}>⭐</span>
      </span>
    </li>
  );
}
