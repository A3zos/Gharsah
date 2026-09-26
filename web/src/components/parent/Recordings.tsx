// «تسجيلات المشاريع»: the child's project reports (newest first) + the project
// still waiting for tomorrow's report.
import { projectRepo } from '../../content/library';
import type { ChildProfile } from '../../data/children';
import type { ProjectSubmission } from '../../data/submissions';
import { hijriDayMonth } from '../../lib/dates';
import { PendingRecordingRow, RecordingRow } from './RecordingRow';

export const projectTitle = (id: string) => {
  try {
    return projectRepo.byId(id).title;
  } catch {
    return 'مشروع الأسبوع';
  }
};

export function Recordings({
  child,
  subs,
  pending,
}: {
  child: ChildProfile;
  subs: ProjectSubmission[] | null;
  pending: string | null;
}) {
  if (subs === null) return <div aria-busy="true" className="h-[96px]" />;
  if (!subs.length && !pending) {
    // TODO(design): no designed empty list — the pending-project row's wording.
    return (
      <p className="m-0 rounded-px-24 border-[1.5px] border-border bg-surface px-[22px] py-[20px] text-[14px] text-text-muted">
        لا تسجيلات بعد — بعد أول مشروع يحكي {child.name} ماذا فعل، ويظهر تسجيله هنا.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-[11px]">
      {subs.map((s) => (
        <RecordingRow
          key={s.id}
          submission={s}
          childName={child.name}
          title={`مشروع ${projectTitle(s.projectId)}`}
          pill={`اكتمل في ${hijriDayMonth(s.createdAt)}`}
          line={`حكاية ${child.name} بصوته — تسجيل محفوظ لك وحدك.`}
        />
      ))}
      {pending && <PendingRecordingRow title={`مشروع ${projectTitle(pending)}`} childName={child.name} />}
    </div>
  );
}
