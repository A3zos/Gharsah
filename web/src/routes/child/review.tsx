import { useParams } from 'react-router';

import { paths } from '../../app/paths';
import { useChildData } from '../../components/child/ChildData';
import { ChildPage } from '../../components/child/ChildShell';
import { useChildTitle } from '../../components/child/useChildTitle';
import { HadithIcon, ProjectIcon, QuranIcon } from '../../components/child/childIcons';
import { BackButton } from '../../components/ui/BackButton';
import { C } from '../../components/ui/color';
import { projectRepo, quranMeta } from '../../content/library';
import { dayMonth, hadithTopic, surahLabel } from '../../content/review';
import { headline } from '../../data/stats';
import type { StoredProgress } from '../../data/student';
import { countPhrase, fill, MESSAGES, useI18n } from '../../i18n/i18n';
import { SERVER_HADITH_BY_PROJECT } from '../../lesson/web/projectVerifier';
import { useVerifiedProjects } from '../../lesson/web/verifiedProjects';
import { cx } from '../../lib/cx';
import { toDateOrNull } from '../../lib/dates';
import type { Route } from './+types/review';

export const meta: Route.MetaFunction = () => [{ title: MESSAGES.ar.child.meta.review }];

type Kind = 'quran' | 'hadith' | 'projects';
interface Item {
  name: string;
  meta: string;
  state: 'done' | 'now';
}

const asDate = toDateOrNull;
const list = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

/** design/v2 ReviewList — what the child has finished (no Quran/hadith text here, names only). */
export default function ReviewRoute() {
  const { kind: raw } = useParams();
  const kind: Kind = raw === 'hadith' || raw === 'projects' ? raw : 'quran';
  const { child, progress, session } = useChildData();
  const { lang, m } = useI18n();
  const t = m.child.review;
  const n = m.child.count;
  useChildTitle(m.child.meta.review);
  // Projects the teacher verified at the start of a later hadith lesson (the AI server's follow-up).
  const verified = useVerifiedProjects(kind === 'projects' ? session.childId : undefined);
  if (!child) {
    return (
      <ChildPage tab="home" blob="page">
        <div aria-busy="true" className="grow" />
      </ChildPage>
    );
  }
  const s = child.stats ?? {};
  const h = headline(child);
  let title: string, count: string, countLabel: string, icon: React.ReactNode, tint: string, ink: string;
  let items: Item[] = [];

  if (kind === 'quran') {
    title = t.quranTitle;
    count = countPhrase(lang, h.surahs, n.surahs);
    countLabel = t.quranCount.replace('{ayat}', countPhrase(lang, h.ayat, n.ayat));
    icon = <QuranIcon size={26} />;
    tint = 'bg-green-tint';
    ink = 'text-deep-green';
    const prog = s.surahInProgress as { surah?: number; done?: number } | undefined;
    if (prog?.surah && prog.surah >= 1 && prog.surah <= 114) {
      items.push({
        name: surahLabel(lang, prog.surah),
        meta: fill(lang, t.inProgress, { done: prog.done ?? 0, total: quranMeta.ayahCount(prog.surah) }),
        state: 'now',
      });
    }
    items.push(
      ...list(s.surahsDone)
        .reverse()
        .filter((e) => typeof e.surah === 'number' && e.surah >= 1 && e.surah <= 114)
        .map((e): Item => {
          const ayat = quranMeta.ayahCount(e.surah as number);
          const at = asDate(e.at);
          return {
            name: surahLabel(lang, e.surah as number),
            meta: `${countPhrase(lang, ayat, n.ayat)}${at ? ` · ${dayMonth(lang, at)}` : ''}`,
            state: 'done',
          };
        }),
    );
  } else if (kind === 'hadith') {
    title = t.hadithTitle;
    count = countPhrase(lang, h.hadith, n.hadith);
    countLabel = t.hadithCount;
    icon = <HadithIcon size={26} />;
    tint = 'bg-berry-tint';
    ink = 'text-berry-deep';
    items = list(s.hadithDone)
      .reverse()
      .flatMap((e): Item[] => {
        try {
          const at = asDate(e.at);
          // Topic only («برّ الوالدين») — never the hadith text.
          return [
            { name: hadithTopic(lang, String(e.id)), meta: at ? dayMonth(lang, at) : '', state: 'done' },
          ];
        } catch {
          return [];
        }
      });
  } else {
    title = t.projectsTitle;
    countLabel = t.projectsCount;
    icon = <ProjectIcon size={28} />;
    tint = 'bg-gold-tint';
    ink = 'text-warning-text';
    const pending = typeof s.pendingProject === 'string' ? s.pendingProject : null;
    if (pending) {
      try {
        items.push({ name: projectRepo.byId(pending).title, meta: t.pendingProject, state: 'now' });
      } catch {
        // unknown id — skip
      }
    }
    const reported = new Set<string>();
    for (const p of [...(progress?.values() ?? [])] as StoredProgress[]) {
      const id = p.progress.reportedProject;
      if (!id) continue;
      reported.add(id);
      try {
        items.push({
          name: projectRepo.byId(id).title,
          meta: p.updatedAt ? fill(lang, t.toldOn, { date: dayMonth(lang, p.updatedAt) }) : t.told,
          state: 'done',
        });
      } catch {
        // unknown id — skip
      }
    }
    // Verified by the next hadith lesson: the project the child told the teacher about. A project the
    // Supabase list already shows (same hadith) is not listed twice.
    for (const v of verified) {
      if ([...reported].some((id) => SERVER_HADITH_BY_PROJECT[id] === v.hadithId)) continue;
      items.push({ name: v.action || v.title, meta: t.told, state: 'done' });
    }
    // The count includes them (the database count only knows recorded voice reports).
    count = countPhrase(
      lang,
      Math.max(h.projects, items.filter((i) => i.state === 'done').length),
      n.projects,
    );
  }

  return (
    <ChildPage tab="home" blob="page" className="gap-[16px] pt-[26px]">
      <div className="flex items-center gap-[12px]">
        <BackButton to={paths.child.home} small />
        <h1 className="m-0 grow font-heading text-[26px] leading-[1.4] font-bold">{title}</h1>
      </div>
      <div className="flex items-center gap-[14px] rounded-px-26 bg-surface px-[20px] py-[18px] shadow-dark-12-26-4">
        <span
          className={cx('flex h-[54px] w-[54px] items-center justify-center rounded-px-18', tint)}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex grow flex-col gap-[4px]">
          <span className={cx('font-heading text-[26px] font-bold', ink)}>{count}</span>
          <span className="text-[13.5px] font-bold text-text-muted">{countLabel}</span>
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
        {items.map((it) => (
          <li
            key={`${it.name}-${it.meta}`}
            className="flex items-center gap-[14px] rounded-px-22 border-[1.5px] border-border bg-surface px-[18px] py-[16px]"
          >
            <span
              className={cx(
                'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-px-15',
                it.state === 'done' ? 'bg-green-tint' : 'bg-gold-tint',
              )}
              aria-label={it.state === 'done' ? t.done : t.now}
            >
              {it.state === 'done' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5 L10 17.5 L19 7"
                    stroke={C.deepGreen}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="6" fill={C.gold} />
                </svg>
              )}
            </span>
            <span className="flex min-w-0 grow flex-col gap-[5px]">
              <span className="text-[16px] font-extrabold text-text-dark">{it.name}</span>
              {it.meta && <span className="text-[12.5px] text-text-muted">{it.meta}</span>}
            </span>
          </li>
        ))}
        {items.length === 0 && (
          // TODO(design): no designed empty list.
          <li className="text-center text-[14px] text-text-muted">{t.empty}</li>
        )}
      </ul>
    </ChildPage>
  );
}
