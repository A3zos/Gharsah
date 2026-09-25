import { Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { paths } from '../app/paths';
import { BackButton } from '../components/ui/BackButton';
import { Blob, MobilePage } from '../components/ui/Page';
import { toArabicDigits } from '../lib/arabicDigits';
import type { Route } from './+types/legal';

export const meta: Route.MetaFunction = () => [{ title: 'الشروط والخصوصية — غَرْسة' }];

const DOCS = {
  terms: {
    title: 'الشروط والأحكام',
    sections: ['نطاق الخدمة', 'الاشتراك والدفع', 'حساب وليّ الأمر والأبناء', 'حدود المسؤولية'],
  },
  privacy: {
    title: 'سياسة الخصوصية',
    sections: ['البيانات التي نجمعها', 'التسجيلات الصوتية', 'مشاركة البيانات', 'حقوقك والحذف'],
  },
} as const;

/**
 * design/v2 LegalPage — /legal?doc=terms|privacy. The legal text itself is a
 * placeholder in the design («[يُضاف لاحقًا]») until the approved text arrives.
 */
export default function LegalRoute() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const doc = DOCS[params.get('doc') === 'privacy' ? 'privacy' : 'terms'];
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(paths.landing));

  return (
    <MobilePage
      decor={<Blob className="-top-[160px] -left-[140px] h-[400px] w-[400px] bg-blob-green-09" />}
      innerClassName="gap-[16px] px-[20px] py-[26px]"
    >
      <div className="flex items-center gap-[12px]">
        <BackButton onClick={back} small />
        <span className="flex grow flex-col gap-[3px]">
          <h1 className="m-0 font-heading text-[26px] leading-[1.4] font-bold">{doc.title}</h1>
          <span className="text-[13px] text-text-muted">آخر تحديث: [يُضاف لاحقًا]</span>
        </span>
      </div>
      <nav aria-label="أقسام الصفحة" className="flex flex-wrap gap-[8px]">
        {doc.sections.map((t, i) => (
          <a
            key={t}
            href={`#s${i + 1}`}
            className="rounded-pill border-[1.5px] border-border bg-surface px-[14px] py-[9px] text-[12.5px] font-extrabold text-text-muted no-underline"
          >
            {t}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-[20px] rounded-px-26 bg-surface px-[20px] py-[22px] shadow-dark-12-26-4">
        {doc.sections.map((t, i) => (
          <Fragment key={t}>
            <section id={`s${i + 1}`} className="flex scroll-mt-[16px] flex-col gap-[10px]">
              <h2 className="m-0 flex items-center gap-[10px] font-heading text-[19px] font-bold">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-px-10 bg-green-tint font-heading text-[14px] font-extrabold text-deep-green">
                  {toArabicDigits(i + 1)}
                </span>
                {t}
              </h2>
              <p className="m-0 text-[14.5px] leading-[2.05] text-text-muted">
                [يُضاف لاحقًا — نصّ {t} المعتمد قانونيًا.]
              </p>
              <span className="h-[1px] bg-border" />
            </section>
          </Fragment>
        ))}
        <p className="m-0 text-[13px] leading-[1.95] text-text-subtle">للاستفسار: [البريد يُضاف لاحقًا]</p>
      </div>
    </MobilePage>
  );
}
