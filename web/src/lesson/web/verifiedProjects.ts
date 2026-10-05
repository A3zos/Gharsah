// The hook the child screens use for the projects the teacher verified at the start of a later
// hadith lesson (lesson/server/completedProjects.ts). The AI server's device id lives in this
// browser's localStorage (lesson/server/device.ts), so the read happens here, in the web layer.
import { useEffect, useState } from 'react';

import { AgentApi, agentBaseUrl } from '../server/api';
import { loadVerifiedProjects } from '../server/completedProjects';
import { agentDeviceId } from '../server/device';
import type { ActionItem } from '../server/parse';

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The verified projects for a screen (empty until the read comes back, and with no AI server). */
export function useVerifiedProjects(childId: string | undefined): readonly ActionItem[] {
  const [items, setItems] = useState<readonly ActionItem[]>([]);
  useEffect(() => {
    if (!childId || childId === 'preview') return;
    const base = agentBaseUrl();
    let alive = true;
    void loadVerifiedProjects(childId, base ? new AgentApi(base) : null, () =>
      agentDeviceId(childId, browserStorage()),
    ).then((r) => alive && setItems(r));
    return () => {
      alive = false;
    };
  }, [childId]);
  return items;
}
