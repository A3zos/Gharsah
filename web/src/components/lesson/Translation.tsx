// The translation under an ayah / hadith in English / Indonesian (content/translations.ts):
// small, ltr, with its source. Nothing in Arabic, nothing when there is none.
import type { ShownTranslation } from '../../content/translations';
import { useI18n } from '../../i18n/i18n';

export function TranslationNote({ t }: { t: ShownTranslation | null }) {
  const { m } = useI18n();
  if (!t) return null;
  return (
    <p dir="ltr" className="m-0 shrink-0 px-[6px] text-start text-[14px] leading-[1.55] text-text-muted">
      <span className="line-clamp-3">{t.text}</span>
      <span className="mt-[2px] block text-[11.5px] text-text-subtle">
        {m.lesson.translationBy}{' '}
        <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="text-text-subtle">
          {t.source}
        </a>
      </span>
    </p>
  );
}
