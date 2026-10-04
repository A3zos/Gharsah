// The teacher's line while /agent/score-recitation is evaluating («لحظات أقيّم لك ترديدك»):
// the server's official text per language (GET /agent/status → recitation_wait_say),
// fetched once per app load and cached (memory + sessionStorage); our fallbacks otherwise.
import type { AgentApi, AgentLang } from './api';

export const RECITATION_WAIT_FALLBACK: Record<AgentLang, string> = {
  ar: 'لحظات أقيّم لك ترديدك',
  en: "One moment, I'm evaluating your recitation",
  id: 'Sebentar, aku menilai bacaanmu',
};

const KEY = 'gharsah.ai.recitationWaitSay';
let memory: Partial<Record<AgentLang, string>> | null = null;
let loading: Promise<void> | null = null;

function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Once per app load (later calls reuse it); never throws. */
export function loadRecitationWaitSay(api: Pick<AgentApi, 'recitationWaitSay'>): Promise<void> {
  if (memory) return Promise.resolve();
  try {
    const cached = session()?.getItem(KEY);
    if (cached) memory = JSON.parse(cached) as Partial<Record<AgentLang, string>>;
  } catch {
    memory = null;
  }
  if (memory) return Promise.resolve();
  loading ??= api
    .recitationWaitSay()
    .then((w) => {
      if (!w) return;
      memory = w;
      try {
        session()?.setItem(KEY, JSON.stringify(w));
      } catch {
        // storage blocked — memory only
      }
    })
    .catch(() => {})
    .finally(() => (loading = null));
  return loading;
}

/** The wait line in the session language (the server's, or our fallback). */
export function recitationWaitLine(lang: AgentLang): string {
  return memory?.[lang] ?? RECITATION_WAIT_FALLBACK[lang];
}

/** Tests: forget the cache. */
export function resetRecitationWaitSay(): void {
  memory = null;
  loading = null;
}
