// design/v3 DashSurahs / DashAyat / DashHadith / DashProjects — the phone
// dashboard with one card open: the four cards stay, the open one is
// highlighted, and its panel (with a caret pointing at it) opens below.
// Names and topics only; the ayah shown comes from the Tanzil asset; hadith
// text is never shown unless approved (else «قيد المراجعة»).
import { Link } from 'react-router';

import { hadithRepo, quranMeta } from '../../content/library';
import { verifiedAyah } from '../../content/verified';
import type { ChildProfile } from '../../data/children';
import type { Headline } from '../../data/stats';
import type { ProjectSubmission } from '../../data/submissions';
import { countPhrase, useI18n } from '../../i18n/i18n';
import { cx } from '../../lib/cx';
import { toDateOrNull } from '../../lib/dates';
import { AyahText } from '../ui/AyahText';
import { C } from '../ui/color';
import { CheckIcon, ForwardIcon } from '../ui/icons';
import { capitalize, dayMonth, fmt, hadithTopic, pctText, projectCopy, surahName } from './parentText';
import { CompactPlayer } from './RecordingRow';

export type DashCard = 'surahs' | 'ayat' | 'hadith' | 'projects';

const ORDER: DashCard[] = ['surahs', 'ayat', 'hadith', 'projects'];
const TINT: Record<DashCard, string> = {
  surahs: 'bg-green-tint',
  ayat: 'bg-sky-tint',
  hadith: 'bg-berry-tint',
  projects: 'bg-gold-tint',
};

const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
const asDate = toDateOrNull;
const surahOk = (n: unknown): n is number => typeof n === 'number' && n >= 1 && n <= 114;

function Icon({ kind }: { kind: DashCard }) {
  switch (kind) {
    case 'surahs':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z"
            stroke={C.deepGreen}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M12 5.8 V18.8" stroke={C.deepGreen} strokeWidth="1.9" />
        </svg>
      );
    case 'ayat':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M8.5 5 C6 7 6 17 8.5 19" stroke={C.skyText} strokeWidth="2" strokeLinecap="round" />
          <path d="M15.5 5 C18 7 18 17 15.5 19" stroke={C.skyText} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="1.8" fill={C.skyText} />
        </svg>
      );
    case 'hadith':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 4 H17 C18.7 4 20 5.3 20 7 V20 H9.5 C8 20 7 18.8 7 17.3 Z"
            stroke={C.berryDeep}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M7 4 C5.3 4 4 5.3 4 7 C4 8.2 4.9 9 6 9 H7"
            stroke={C.berryDeep}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
          <path d="M32 38 V18" stroke={C.ayahBracket} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M32 28 C24 28 19 23 19 15 C27 15 32 20 32 28 Z" fill={C.goldMid} />
          <path
            d="M6 38 C6 50 17 58 32 58 C47 58 58 50 58 38 C58 34 54 32 51 34 L40 41 L24 41 L13 34 C10 32 6 34 6 38 Z"
            fill={C.gold}
          />
        </svg>
      );
  }
}

function Lock({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke={C.textSubtle} strokeWidth="2" />
      <path
        d="M8.5 10.5 V8 C8.5 6 10 4.5 12 4.5 C14 4.5 15.5 6 15.5 8 V10.5"
        stroke={C.textSubtle}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** «بعد الباقة التجريبية — قريبًا» (launch content: 3 surahs, 3 hadith topics). */
function ComingSoonRow() {
  const { m } = useI18n();
  return (
    <div className="flex items-center gap-[11px] rounded-px-18 border-[1.5px] border-dashed border-border-strong bg-transparent p-[14px]">
      <span
        className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-border-soft"
        aria-hidden="true"
      >
        <Lock />
      </span>
      <span className="grow text-[14px] font-bold text-text-subtle">{m.parent.detail.afterPilot}</span>
      <span className="rounded-pill bg-border-soft px-[10px] py-[5px] text-[11.5px] font-extrabold whitespace-nowrap text-text-muted">
        {m.parent.common.soon}
      </span>
    </div>
  );
}

function DoneRow({ name, date, tag }: { name: string; date: string; tag: string }) {
  return (
    <div className="flex items-center gap-[11px] rounded-px-16 bg-background px-[13px] py-[11px]">
      <span
        className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-green-tint"
        aria-hidden="true"
      >
        <CheckIcon size={15} strokeWidth={3.2} />
      </span>
      <span className="grow text-[14.5px] font-bold">{name}</span>
      {date && <span className="text-[11.5px] text-text-muted">{date}</span>}
      <span className="rounded-pill bg-green-tint px-[10px] py-[5px] text-[11.5px] font-extrabold whitespace-nowrap text-deep-green">
        {tag}
      </span>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const { m } = useI18n();
  return (
    <div className="flex items-center justify-between gap-[10px]">
      <div className="flex flex-col gap-[3px]">
        <h2 className="m-0 font-heading text-[18px] leading-[1.5] font-bold">{title}</h2>
        {subtitle && <span className="text-[12px] text-text-muted">{subtitle}</span>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-[40px] items-center gap-[6px] rounded-px-14 border-0 bg-border-soft px-[13px] font-body text-[13px] font-bold text-text-muted"
      >
        {m.parent.detail.hide}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 14.5 L12 8.5 L18 14.5"
            stroke={C.textMuted}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function DashDetail({
  card,
  child,
  h,
  subs,
  onClose,
}: {
  card: DashCard;
  child: ChildProfile;
  h: Headline;
  subs: ProjectSubmission[] | null;
  onClose: () => void;
}) {
  const counts: Record<DashCard, number> = {
    surahs: h.surahs,
    ayat: h.ayat,
    hadith: h.hadith,
    projects: h.projects,
  };
  const { lang, m } = useI18n();
  const label = m.parent.cards;
  const idx = ORDER.indexOf(card);
  const s = child.stats ?? {};
  return (
    <>
      <div className="grid grid-cols-2 gap-[12px]">
        {ORDER.map((kind) => {
          const on = kind === card;
          return (
            <Link
              key={kind}
              to={on ? '?' : `?card=${kind}`}
              aria-current={on ? 'true' : undefined}
              className={cx(
                'relative flex min-h-[134px] flex-col gap-[6px] rounded-px-24 p-[16px] text-text-dark no-underline hover:text-text-dark',
                on
                  ? 'border-[2px] border-deep-green bg-green-tint'
                  : 'border-[1.5px] border-border bg-surface',
              )}
            >
              <span
                className={cx(
                  'flex h-[42px] w-[42px] items-center justify-center rounded-px-14',
                  on ? 'bg-surface' : TINT[kind],
                )}
                aria-hidden="true"
              >
                <Icon kind={kind} />
              </span>
              <span className="font-heading text-[32px] leading-[1.2] font-extrabold">
                {fmt(lang, '{n}', { n: counts[kind] })}
              </span>
              <span
                className={cx(
                  'text-[13px]',
                  on ? 'font-extrabold text-deep-green' : 'font-bold text-text-muted',
                )}
              >
                {label[kind]}
              </span>
              <span className="absolute end-[16px] top-[18px]">
                <ForwardIcon
                  size={18}
                  color={on ? 'deepGreen' : 'textSubtle'}
                  strokeWidth={2.2}
                  className="ltr:-scale-x-100"
                />
              </span>
            </Link>
          );
        })}
      </div>
      <section
        aria-label={label[card]}
        className="relative flex flex-col gap-[12px] rounded-px-26 border-[1.5px] border-border bg-surface p-[18px] shadow-lesson-done-card"
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute -top-[9px] h-[16px] w-[16px] [transform:rotate(-45deg)] border-t-[1.5px] border-r-[1.5px] border-t-border border-r-border bg-surface',
            idx % 2 === 0 ? 'start-[24%]' : 'end-[24%]',
          )}
        />
        {card === 'surahs' && <SurahsPanel s={s} h={h} onClose={onClose} />}
        {card === 'ayat' && <AyatPanel s={s} h={h} notRepeated={child.notRepeatedRefs} onClose={onClose} />}
        {card === 'hadith' && <HadithPanel s={s} child={child} onClose={onClose} />}
        {card === 'projects' && <ProjectsPanel child={child} subs={subs} s={s} onClose={onClose} />}
      </section>
    </>
  );
}

function SurahsPanel({ s, h, onClose }: { s: Record<string, unknown>; h: Headline; onClose: () => void }) {
  const { lang, m } = useI18n();
  const t = m.parent.detail;
  const surah = (n: number) => fmt(lang, m.parent.common.surah, { name: surahName(lang, n) });
  const done = list(s.surahsDone)
    .filter((e) => surahOk(e.surah))
    .reverse();
  const prog = s.surahInProgress as { surah?: number; done?: number } | undefined;
  const inProgress = prog && surahOk(prog.surah) ? prog : null;
  const pct = inProgress
    ? Math.round(((inProgress.done ?? 0) * 100) / quranMeta.ayahCount(inProgress.surah!))
    : 0;
  return (
    <>
      <PanelHeader
        title={t.surahsTitle}
        subtitle={`${fmt(lang, t.surahsSubtitle, { n: h.surahs })}${inProgress ? t.surahsInProgress : ''}`}
        onClose={onClose}
      />
      {inProgress && (
        <div className="flex flex-col gap-[11px] rounded-px-20 border-[1.5px] border-gold-border bg-gold-tint p-[14px]">
          <div className="flex items-center gap-[11px]">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-surface"
              aria-hidden="true"
            >
              <Icon kind="surahs" />
            </span>
            <span className="grow text-[15.5px] font-bold">{surah(inProgress.surah!)}</span>
            <span className="rounded-pill bg-surface px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-warning-text">
              {t.inProgress}
            </span>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="h-[8px] grow overflow-hidden rounded-px-5 bg-surface">
              <div className="h-full rounded-px-5 bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[12px] font-extrabold text-warning-text">{pctText(lang, pct)}</span>
          </div>
        </div>
      )}
      {done.length > 0 && (
        <span className="ps-[4px] text-[12px] font-bold text-text-muted">{t.completed}</span>
      )}
      <div className="flex flex-col gap-[8px]">
        {done.map((e) => {
          const at = asDate(e.at);
          return (
            <DoneRow
              key={String(e.surah)}
              name={surah(e.surah as number)}
              date={at ? dayMonth(lang, at) : ''}
              tag={t.memorized}
            />
          );
        })}
      </div>
      <ComingSoonRow />
    </>
  );
}

/** «surah:ayah» refs → grouped per surah, in order (only surahs/ayat that exist). */
function notRepeatedBySurah(refs: readonly string[]): [number, number[]][] {
  const by = new Map<number, number[]>();
  for (const r of refs) {
    const [s, a] = r.split(':').map(Number);
    if (!surahOk(s) || !a || a < 1 || a > quranMeta.ayahCount(s!)) continue;
    by.set(s!, [...(by.get(s!) ?? []), a]);
  }
  return [...by.entries()]
    .sort(([x], [y]) => x - y)
    .map(([s, a]) => [s, [...new Set(a)].sort((x, y) => x - y)]);
}

function AyatPanel({
  s,
  h,
  notRepeated,
  onClose,
}: {
  s: Record<string, unknown>;
  h: Headline;
  /** «لم يُردَّد»: ayat the child stayed silent on (moved on without a repeat). */
  notRepeated: readonly string[];
  onClose: () => void;
}) {
  const { lang, m } = useI18n();
  const t = m.parent.detail;
  const skipped = notRepeatedBySurah(notRepeated);
  const bySurah = Object.entries((s.ayatBySurah as Record<string, number> | undefined) ?? {})
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([k, v]) => surahOk(k) && typeof v === 'number' && v > 0);
  const full = bySurah.filter(([k, v]) => v >= quranMeta.ayahCount(k));
  const partial = bySurah.filter(([k, v]) => v < quranMeta.ayahCount(k));
  const latest = s.latestAyat as { surah?: number; count?: number } | undefined;
  // The newest memorized ayah, shown from the verified Tanzil text.
  const week = latest && surahOk(latest.surah) ? latest.surah : (partial[0]?.[0] ?? full[0]?.[0]);
  const weekAyah = week
    ? Math.max(
        1,
        Math.min(quranMeta.ayahCount(week), (s.ayatBySurah as Record<string, number>)?.[String(week)] ?? 1),
      )
    : 0;
  const names = full.map(([k]) => surahName(lang, k));
  const ref =
    week && lang !== 'ar'
      ? fmt(lang, t.ayahRef, { name: surahName(lang, week), n: weekAyah })
      : week
        ? verifiedAyah(week, weekAyah).reference
        : '';
  return (
    <>
      <PanelHeader title={t.ayatTitle} onClose={onClose} />
      <div className="flex items-center gap-[16px] rounded-px-22 bg-sky-tint p-[18px]">
        <span className="font-heading text-[44px] leading-[1] font-extrabold text-text-dark">
          {fmt(lang, '{n}', { n: h.ayat })}
        </span>
        <div className="flex flex-col gap-[4px]">
          <span className="text-[15px] font-bold">{t.ayahMemorized}</span>
          {names.length > 0 && (
            <span className="text-[12.5px] text-text-muted">
              {names.length === 1
                ? fmt(lang, t.fromOne, { a: names[0]! })
                : names.length === 2
                  ? fmt(lang, t.fromTwo, { a: names[0]!, b: names[1]! })
                  : fmt(lang, t.fromMany, { n: names.length })}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-[8px]">
        {full.map(([k]) => (
          <span
            key={k}
            className="rounded-pill border border-border bg-background px-[13px] py-[8px] text-[12.5px] font-bold"
          >
            {surahName(lang, k)} · {countPhrase(lang, quranMeta.ayahCount(k), t.ayahCount)}
          </span>
        ))}
        {partial.map(([k]) => (
          <span
            key={k}
            className="rounded-pill border border-gold-border bg-gold-tint px-[13px] py-[8px] text-[12.5px] font-bold text-warning-text"
          >
            {surahName(lang, k)} · {t.inProgress}
          </span>
        ))}
        <span className="rounded-pill border border-dashed border-border-strong bg-transparent px-[13px] py-[8px] text-[12.5px] font-bold text-text-subtle">
          {t.afterPilotSoon}
        </span>
      </div>
      {skipped.length > 0 && (
        <div className="flex flex-col gap-[8px] rounded-px-20 border-[1.5px] border-gold-border bg-gold-tint p-[14px]">
          <span className="text-[13.5px] font-extrabold text-warning-text">{t.notRepeated}</span>
          <span className="text-[12.5px] leading-[1.7] text-on-gold">{t.notRepeatedBody}</span>
          <div className="flex flex-wrap gap-[6px]">
            {skipped.map(([surah, ayat]) =>
              ayat.map((a) => (
                <span
                  key={`${surah}:${a}`}
                  className="rounded-pill border border-gold-border bg-surface px-[11px] py-[5px] text-[12.5px] font-bold text-warning-text"
                >
                  {surahName(lang, surah)} · {fmt(lang, t.ayahN, { n: a })}
                </span>
              )),
            )}
          </div>
        </div>
      )}
      {week && (
        <div className="flex flex-col gap-[11px] rounded-px-20 border-[1.5px] border-border bg-background p-[16px]">
          <span className="text-[13.5px] font-extrabold">
            {fmt(lang, t.weekAyah, { name: surahName(lang, week) })}
          </span>
          <div
            dir="rtl"
            lang="ar"
            className="rounded-px-16 border-[1.5px] border-dashed border-seed-dots bg-green-tint px-[16px] py-[14px]"
          >
            <AyahText text={verifiedAyah(week, weekAyah).text} className="text-[20px] leading-[1.9]" />
          </div>
          <span className="text-center text-[11.5px] text-text-muted">
            {ref}
            {t.tanzilNote}
          </span>
        </div>
      )}
      {latest && surahOk(latest.surah) && (latest.count ?? 0) > 0 && (
        <div className="flex items-center gap-[9px]">
          <svg className="shrink-0" width="18" height="18" viewBox="0 0 76 76" fill="none" aria-hidden="true">
            <path d="M38 60 V34" stroke={C.deepGreen} strokeWidth="6" strokeLinecap="round" />
            <path d="M38 40 C28 40 22 34 22 26 C32 26 38 32 38 40 Z" fill={C.primary} />
            <path d="M38 45 C48 45 54 39 54 31 C44 31 38 37 38 45 Z" fill={C.softGreen} />
          </svg>
          <span className="text-[12.5px] leading-[1.7] text-text-muted">
            {fmt(lang, t.latest, {
              count: countPhrase(lang, latest.count!, t.latestCount),
              name: surahName(lang, latest.surah!),
            })}
          </span>
        </div>
      )}
    </>
  );
}

function HadithPanel({
  s,
  child,
  onClose,
}: {
  s: Record<string, unknown>;
  child: ChildProfile;
  onClose: () => void;
}) {
  const { lang, m } = useI18n();
  const t = m.parent.detail;
  const done = list(s.hadithDone)
    .reverse()
    .flatMap((e) => {
      try {
        return [{ h: hadithRepo.byId(String(e.id)), at: asDate(e.at) }];
      } catch {
        return [];
      }
    });
  const doneIds = new Set(done.map((d) => d.h.id));
  // This week's hadith: the lesson hadith not done yet.
  let current: ReturnType<typeof hadithRepo.byId> | null = null;
  try {
    const h = hadithRepo.byId('PLACEHOLDER-birr-alwalidayn');
    if (!doneIds.has(h.id)) current = h;
  } catch {
    current = null;
  }
  return (
    <>
      <PanelHeader
        title={t.hadithTitle}
        subtitle={`${countPhrase(lang, done.length, t.hadithDone)}${current ? t.hadithThisWeekSuffix : ''}`}
        onClose={onClose}
      />
      {current && (
        <div className="flex flex-col gap-[12px] rounded-px-20 border-[1.5px] border-gold-border bg-gold-tint p-[16px]">
          <div className="flex items-center gap-[11px]">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-surface"
              aria-hidden="true"
            >
              <Icon kind="hadith" />
            </span>
            <span className="grow text-[15.5px] font-bold">
              {fmt(lang, t.hadithAbout, { topic: hadithTopic(lang, current.id, current.topic) })}
            </span>
            <span className="rounded-pill bg-surface px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-warning-text">
              {t.thisWeek}
            </span>
          </div>
          {current.isApproved ? (
            <span
              dir="rtl"
              lang="ar"
              className="block rounded-px-16 border-[1.5px] border-dashed border-avatar-cream bg-hadith-placeholder-bg px-[16px] py-[14px] text-center font-body text-[14px] leading-[1.8] font-bold text-warning-text"
            >
              {current.displayText}
            </span>
          ) : (
            <span className="block rounded-px-16 border-[1.5px] border-dashed border-avatar-cream bg-hadith-placeholder-bg px-[16px] py-[14px] text-center font-body text-[14px] leading-[1.8] font-bold text-warning-text">
              {t.underReview}
            </span>
          )}
          <span dir="rtl" lang="ar" className="text-center text-[11.5px] font-bold text-ayah-bracket">
            {current.displayTakhrij}
          </span>
        </div>
      )}
      {done.length > 0 && (
        <span className="ps-[4px] text-[12px] font-bold text-text-muted">{t.completed}</span>
      )}
      <div className="flex flex-col gap-[8px]">
        {done.map((d) => (
          <DoneRow
            key={d.h.id}
            name={capitalize(hadithTopic(lang, d.h.id, d.h.topic))}
            date={d.at ? dayMonth(lang, d.at) : ''}
            tag={t.done}
          />
        ))}
      </div>
      <ComingSoonRow />
      <div className="flex items-start gap-[10px] rounded-px-18 bg-berry-tint px-[15px] py-[13px]">
        <svg
          className="mt-[2px] shrink-0"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.5" stroke={C.berryDeep} strokeWidth="1.8" />
          <path d="M12 11 V16.5" stroke={C.berryDeep} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="7.8" r="1.3" fill={C.berryDeep} />
        </svg>
        <p className="m-0 text-[12.5px] leading-[1.8] text-text-dark">
          {fmt(lang, t.hadithNote, { name: child.name })}
        </p>
      </div>
    </>
  );
}

function ProjectsPanel({
  child,
  subs,
  s,
  onClose,
}: {
  child: ChildProfile;
  subs: ProjectSubmission[] | null;
  s: Record<string, unknown>;
  onClose: () => void;
}) {
  const { lang, m } = useI18n();
  const t = m.parent.detail;
  const fallback = m.parent.recordings.projectFallback;
  const pending = typeof s.pendingProject === 'string' ? s.pendingProject : null;
  const title = (id: string) => projectCopy(lang, id);
  const n = subs?.length ?? 0;
  return (
    <>
      <PanelHeader
        title={t.projectsTitle}
        subtitle={`${fmt(lang, t.projectsSubtitle, { n })}${pending ? t.projectsPendingSuffix : ''}`}
        onClose={onClose}
      />
      {subs === null && <div aria-busy="true" className="h-[80px]" />}
      {subs?.map((sub) => {
        const p = title(sub.projectId);
        return (
          <div key={sub.id} className="flex flex-col gap-[10px] rounded-px-20 bg-background p-[14px]">
            <div className="flex items-center justify-between gap-[10px]">
              <span className="text-[16px] font-bold">{p?.title ?? fallback}</span>
              <span className="flex items-center gap-[5px] rounded-pill bg-green-tint px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-deep-green">
                <CheckIcon size={12} strokeWidth={3.4} />
                {t.projectDone}
              </span>
            </div>
            <span className="text-[12px] text-text-muted">{dayMonth(lang, sub.createdAt)}</span>
            {p && <p className="m-0 text-[13px] leading-[1.8] text-text-dark">{p.intro}</p>}
            <CompactPlayer submission={sub} childName={child.name} />
          </div>
        );
      })}
      {pending && (
        <div className="flex flex-col gap-[10px] rounded-px-20 border-[1.5px] border-dashed border-border-strong bg-background p-[14px]">
          <div className="flex items-center justify-between gap-[10px]">
            <span className="text-[16px] font-bold text-text-muted">{title(pending)?.title ?? fallback}</span>
            <span className="rounded-pill bg-gold-tint px-[11px] py-[6px] text-[11.5px] font-extrabold whitespace-nowrap text-warning-text">
              {t.projectPending}
            </span>
          </div>
          <div className="flex items-center gap-[10px]">
            <svg
              className="shrink-0"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.6" stroke={C.textMuted} strokeWidth="1.9" />
              <path
                d="M12 7.6 V12 L15 13.8"
                stroke={C.textMuted}
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[12.5px] leading-[1.7] text-text-muted">
              {fmt(lang, t.notRecorded, { name: child.name })}
            </span>
          </div>
        </div>
      )}
      <div className="flex items-start gap-[10px] rounded-px-18 bg-green-tint px-[15px] py-[13px]">
        <svg
          className="mt-[2px] shrink-0"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 3.5 L19.5 6.5 V12 C19.5 16.2 16.4 19.4 12 20.5 C7.6 19.4 4.5 16.2 4.5 12 V6.5 Z"
            stroke={C.deepGreen}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <p className="m-0 text-[12.5px] leading-[1.8] text-text-dark">{t.privacy}</p>
      </div>
    </>
  );
}
