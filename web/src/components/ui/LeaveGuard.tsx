// Confirms leaving a form with unsaved input — for in-app navigation (links,
// «الرئيسية», the browser back button) and for closing/reloading the tab.
import { useEffect } from 'react';
import { useBlocker, type Location } from 'react-router';

import { useI18n } from '../../i18n/i18n';
import { ConfirmSheet } from './ConfirmSheet';

export function LeaveGuard({
  when,
  /** Navigations that stay inside the form (e.g. its own steps) are not blocked. */
  allow,
}: {
  when: boolean;
  allow?: (next: Location, current: Location) => boolean;
}) {
  const { m } = useI18n();
  const t = m.common.leave;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!when) return false;
    if (allow?.(nextLocation, currentLocation)) return false;
    return (
      currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search
    );
  });

  useEffect(() => {
    if (!when) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [when]);

  return (
    <ConfirmSheet
      open={blocker.state === 'blocked'}
      title={t.title}
      body={t.body}
      confirmLabel={t.confirm}
      cancelLabel={t.cancel}
      danger
      onConfirm={() => blocker.proceed?.()}
      onCancel={() => blocker.reset?.()}
    />
  );
}
