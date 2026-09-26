import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { paths } from '../app/paths';
import { firebase } from '../firebase/app';

/**
 * Where «الرئيسية» and the logo go: a signed-in parent → the parent dashboard
 * (never the public landing); anyone else → the landing page.
 */
export function useHomeTarget(): string {
  const [parent, setParent] = useState(() => {
    const u = firebase().auth.currentUser;
    return !!u && !u.isAnonymous;
  });
  useEffect(() => onAuthStateChanged(firebase().auth, (u) => setParent(!!u && !u.isAnonymous)), []);
  return parent ? paths.parent.dashboard() : paths.landing;
}
