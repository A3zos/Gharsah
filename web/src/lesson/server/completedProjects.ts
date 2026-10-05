// The child's COMPLETED projects as the AI server knows them (2026-10-04, product owner):
// whether the child really did a hadith's project is checked by the teacher at the start of
// the NEXT hadith lesson (she asks «ما المشروع الذي طبّقته؟»; a project that fits the hadith is
// marked done). The server then lists it in /agent/actions with status «done», and the
// «المشاريع المنجزة» screens show it. Logic only — no screen styling lives here.
import type { AgentApi } from './api';
import type { ActionItem } from './parse';

/** Only the verified ones — the status the teacher's follow-up sets (never a self-ticked box). */
export function verifiedProjects(items: readonly ActionItem[]): ActionItem[] {
  return items.filter((i) => i.status === 'done');
}

/** One read per child per short window — the home and the projects screen share it. */
const CACHE_MS = 20_000;
const cache = new Map<string, { at: number; items: Promise<ActionItem[]> }>();

/** Tests: forget what was read. */
export function resetCompletedProjectsCache(): void {
  cache.clear();
}

/**
 * The verified projects of this child ([] with no AI server, no history, or any failure —
 * the screens then show only what Supabase knows, exactly as before).
 */
export function loadVerifiedProjects(
  childId: string,
  /** null = no AI server configured. */
  client: Pick<AgentApi, 'actionItems'> | null,
  deviceId: () => Promise<string>,
): Promise<ActionItem[]> {
  if (!client) return Promise.resolve([]);
  const hit = cache.get(childId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const items = deviceId()
    .then((id) => client.actionItems(id))
    .then(verifiedProjects)
    .catch((): ActionItem[] => []);
  cache.set(childId, { at: Date.now(), items });
  return items;
}
