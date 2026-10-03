// «تسجيل الخروج»: confirm first, then sign out and go to the public landing page.
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { paths } from '../../app/paths';
import { signOut } from '../../data/auth';
import { C } from '../ui/color';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { useI18n } from '../../i18n/i18n';

export function useSignOut(): { ask: () => void; sheet: React.ReactNode } {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useI18n().m.parent.signOut;
  const sheet = (
    <ConfirmSheet
      open={open}
      title={t.title}
      body={t.body}
      confirmLabel={t.confirm}
      cancelLabel={t.cancel}
      busy={busy}
      icon={
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path
            d="M14 5 H18 C19 5 20 6 20 7 V17 C20 18 19 19 18 19 H14"
            stroke={C.ayahBracket}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M10 8 L6.5 12 L10 16 M6.5 12 H15"
            stroke={C.ayahBracket}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
      onConfirm={() => {
        setBusy(true);
        void signOut().finally(() => navigate(paths.landing, { replace: true }));
      }}
      onCancel={() => setOpen(false)}
    />
  );
  return { ask: () => setOpen(true), sheet };
}
