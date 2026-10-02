// The AI server's `device_id`: a random UUID per child profile, kept in this
// browser's localStorage. It links the child's sessions on the AI server (progress,
// taseem readiness, projects) and is never derived from our Supabase ids — those
// and our tokens never leave for the AI server. A blocked storage → a fresh id
// for this visit (the server then just has no memory of earlier sessions).
const KEY = 'gharsah.ai.devices';

export type Store = Pick<Storage, 'getItem' | 'setItem'>;

const newId = (): string => crypto.randomUUID();

/**
 * The device id for this child. `profileKey` only selects the local slot; it is
 * hashed so not even the local map holds our ids in the clear.
 */
export async function agentDeviceId(profileKey: string, store: Store | null): Promise<string> {
  const slot = await slotOf(profileKey);
  let map: Record<string, string> = {};
  try {
    const raw = store?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object') map = parsed as Record<string, string>;
  } catch {
    map = {};
  }
  const known = map[slot];
  if (typeof known === 'string' && /^[0-9a-f-]{36}$/i.test(known)) return known;
  const id = newId();
  try {
    store?.setItem(KEY, JSON.stringify({ ...map, [slot]: id }));
  } catch {
    // storage full / blocked — use the id for this visit only
  }
  return id;
}

async function slotOf(profileKey: string): Promise<string> {
  const bytes = new TextEncoder().encode(`gharsah-ai-slot:${profileKey}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
