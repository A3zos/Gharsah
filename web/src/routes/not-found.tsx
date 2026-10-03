import { PendingDesign } from '../components/PendingDesign';
import { useDocumentMeta } from '../components/ui/Page';
import { MESSAGES, useI18n } from '../i18n/i18n';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Route } from './+types/not-found';

export const meta: Route.MetaFunction = () => [{ title: MESSAGES.ar.auth.titles.notFound }];

// TODO(design): no designed not-found screen yet.
export default function Page() {
  return (
    <I18nProvider>
      <NotFound />
    </I18nProvider>
  );
}

function NotFound() {
  const { m } = useI18n();
  useDocumentMeta(m.auth.titles.notFound);
  return <PendingDesign name={m.common.notFound} />;
}
