import { Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { paths } from '../app/paths';
import { BackButton } from '../components/ui/BackButton';
import { LanguageSheetButton } from '../components/ui/LanguageSwitcher';
import { Blob, MobilePage, useDocumentMeta } from '../components/ui/Page';
import { fill, formatNumber, MESSAGES, useI18n } from '../i18n/i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Route } from './+types/legal';

export const meta: Route.MetaFunction = () => [{ title: MESSAGES.ar.auth.titles.legal }];

/**
 * design/v2 LegalPage — /legal?doc=terms|privacy. The legal text itself is a
 * placeholder in the design («[يُضاف لاحقًا]») until the approved text arrives.
 */
export default function LegalRoute() {
  return (
    <I18nProvider>
      <Legal />
    </I18nProvider>
  );
}

function Legal() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { lang, m } = useI18n();
  const t = m.auth.legal;
  useDocumentMeta(m.auth.titles.legal);
  const doc = t[params.get('doc') === 'privacy' ? 'privacy' : 'terms'];
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
          <span className="text-[13px] text-text-muted">{t.updated}</span>
        </span>
        <LanguageSheetButton />
      </div>
      <nav aria-label={t.sectionsLabel} className="flex flex-wrap gap-[8px]">
        {doc.sections.map((section, i) => (
          <a
            key={section}
            href={`#s${i + 1}`}
            className="rounded-pill border-[1.5px] border-border bg-surface px-[14px] py-[9px] text-[12.5px] font-extrabold text-text-muted no-underline"
          >
            {section}
          </a>
        ))}
      </nav>
      <div className="flex flex-col gap-[20px] rounded-px-26 bg-surface px-[20px] py-[22px] shadow-dark-12-26-4">
        {/* already in force (the rest of the text is still a placeholder) */}
        <p className="m-0 rounded-px-18 bg-green-tint px-[16px] py-[14px] text-[14.5px] leading-[2] font-bold text-text-dark">
          {m.auth.voiceNotice}
        </p>
        {doc.sections.map((section, i) => (
          <Fragment key={section}>
            <section id={`s${i + 1}`} className="flex scroll-mt-[16px] flex-col gap-[10px]">
              <h2 className="m-0 flex items-center gap-[10px] font-heading text-[19px] font-bold">
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-px-10 bg-green-tint font-heading text-[14px] font-extrabold text-deep-green">
                  {formatNumber(lang, i + 1)}
                </span>
                {section}
              </h2>
              <p className="m-0 text-[14.5px] leading-[2.05] text-text-muted">
                {fill(lang, t.placeholder, { section })}
              </p>
              <span className="h-[1px] bg-border" />
            </section>
          </Fragment>
        ))}
        <p className="m-0 text-[13px] leading-[1.95] text-text-subtle">{t.contact}</p>
      </div>
    </MobilePage>
  );
}
