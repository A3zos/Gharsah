// Live parent data for every /parent page: profile, children, subscription.
// Subscribed once by the parent layout (Firestore listeners), read with useParentData().
import { createContext, useContext, useEffect, useState } from 'react';

import { watchChildren, type ChildProfile } from '../../data/children';
import { watchParent, watchSubscription, type ParentProfile, type Subscription } from '../../data/parent';

export interface ParentData {
  uid: string;
  email: string;
  profile: ParentProfile | null;
  /** null while loading. */
  children: ChildProfile[] | null;
  /** undefined while loading, null = no subscription. */
  subscription: Subscription | null | undefined;
  error: unknown;
}

const Ctx = createContext<ParentData | null>(null);
/** For tests: renders parent pages with fixed data (no live listeners). */
export const ParentDataContext = Ctx;

export function ParentDataProvider({
  uid,
  email,
  children: node,
}: {
  uid: string;
  email: string;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [kids, setKids] = useState<ChildProfile[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const unsubs = [
      watchParent(uid, setProfile, setError),
      watchChildren(uid, setKids, setError),
      watchSubscription(uid, setSubscription, () => setSubscription(null)),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  return (
    <Ctx.Provider value={{ uid, email, profile, children: kids, subscription, error }}>{node}</Ctx.Provider>
  );
}

export function useParentData(): ParentData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useParentData outside the parent layout');
  return v;
}

/** «أبو عبدالله» → first letter for the avatar square. */
export const initialOf = (name: string) => [...name.trim()][0] ?? '؟';
