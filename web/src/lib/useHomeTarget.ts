import { useEffect, useState } from 'react';

import { paths } from '../app/paths';
import { supabase } from '../supabase/client';

/**
 * Where «الرئيسية» and the logo go: a signed-in parent → the parent dashboard
 * (never the public landing); anyone else → the landing page.
 */
export function useHomeTarget(): string {
  const [parent, setParent] = useState(false);
  useEffect(() => {
    const auth = supabase().auth;
    void auth.getSession().then(({ data }) => setParent(!!data.session && !data.session.user.is_anonymous));
    const { data } = auth.onAuthStateChange((_e, session) =>
      setParent(!!session && !session.user.is_anonymous),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return parent ? paths.parent.dashboard() : paths.landing;
}
