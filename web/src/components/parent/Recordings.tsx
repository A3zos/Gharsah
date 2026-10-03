// «تسجيلات المشاريع»: the child's project reports (newest first) + the project
// still waiting for tomorrow's report.
import type { ChildProfile } from '../../data/children';
import type { ProjectSubmission } from '../../data/submissions';
import { MESSAGES, useI18n, type UiLanguage } from '../../i18n/i18n';
import { dayMonth, fmt, projectCopy } from './parentText';
import { PendingRecordingRow, RecordingRow } from './RecordingRow';

/** The project's title in the UI language («مشروع الأسبوع» when it's unknown). */
export const projectTitle = (id: string, lang: UiLanguage = 'ar') =>
  projectCopy(lang, id)?.title ?? MESSAGES[lang].parent.recordings.projectFallback;

export function Recordings({
  child,
  subs,
  pending,
}: {
  child: ChildProfile;
  subs: ProjectSubmission[] | null;
  pending: string | null;
}) {
  const { lang, m } = useI18n();
  const t = m.parent.recordings;
  const name = child.name;
  if (subs === null) return <div aria-busy="true" className="h-[96px]" />;
  if (!subs.length && !pending) {
    // TODO(design): no designed empty list — the pending-project row's wording.
    return (
      <p className="m-0 rounded-px-24 border-[1.5px] border-border bg-surface px-[22px] py-[20px] text-[14px] text-text-muted">
        {fmt(lang, t.empty, { name })}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-[11px]">
      {subs.map((s) => (
        <RecordingRow
          key={s.id}
          submission={s}
          childName={name}
          title={fmt(lang, t.projectTitle, { title: projectTitle(s.projectId, lang) })}
          pill={fmt(lang, t.donePill, { date: dayMonth(lang, s.createdAt) })}
          line={fmt(lang, t.line, { name })}
        />
      ))}
      {pending && (
        <PendingRecordingRow
          title={fmt(lang, t.projectTitle, { title: projectTitle(pending, lang) })}
          childName={name}
        />
      )}
    </div>
  );
}
