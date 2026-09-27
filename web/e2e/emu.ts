// Helpers for the emulator e2e suites (parent/child/lesson). They talk to the
// LOCAL Firebase emulators only (REST, owner access) — never production.
import type { Page } from '@playwright/test';

const PROJECT = 'nibras-59284';
const AUTH = 'http://127.0.0.1:9099';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

type Value =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values: Value[] } }
  | { mapValue: { fields: Record<string, Value> } };

export function fsValue(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { integerValue: String(Math.round(v)) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
  return {
    mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, fsValue(x)])) },
  };
}

export async function setDoc(path: string, data: Record<string, unknown>) {
  const res = await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: OWNER,
    body: JSON.stringify({
      fields: (fsValue(data) as { mapValue: { fields: Record<string, Value> } }).mapValue.fields,
    }),
  } as RequestInit);
  if (!res.ok) throw new Error(`setDoc ${path}: ${res.status} ${await res.text()}`);
}

export async function getDoc(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${FS}/${path}`, { headers: OWNER });
  if (res.status === 404) return null;
  return (await res.json()) as Record<string, unknown>;
}

export async function createUser(email: string, password: string, displayName: string): Promise<string> {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });
  const j = (await res.json()) as { localId?: string; error?: unknown };
  if (!j.localId) throw new Error(`createUser: ${JSON.stringify(j.error)}`);
  return j.localId;
}

const DAY = 86_400_000;
export const SCHEDULE = {
  days: ['sat', 'sun', 'mon', 'wed'],
  time: 1020,
  custom: {},
  duration: 45,
  reminder: true,
};

/** A fresh parent with an active (mock) annual subscription and optional children. */
export async function seedParent(opts: { subscribed?: boolean; children?: SeedChild[] } = {}) {
  const tag = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const email = `p${tag}@test.local`;
  const password = 'test-pass-123';
  const uid = await createUser(email, password, 'أبو عبدالله');
  const now = Date.now();
  await setDoc(`parents/${uid}`, { name: 'أبو عبدالله', email, role: 'parent', createdAt: new Date(now) });
  if (opts.subscribed !== false) {
    await setDoc(`parents/${uid}/subscription/current`, {
      plan: 'annual',
      status: 'active',
      provider: 'mock',
      startedAt: new Date(now - 10 * DAY),
      expiresAt: new Date(now + 355 * DAY),
    });
  }
  for (const [i, c] of (opts.children ?? []).entries()) {
    await setDoc(`parents/${uid}/children/${c.id}`, {
      name: c.name,
      age: c.age ?? 10,
      gender: c.gender ?? 'boy',
      avatar: c.avatar ?? 'b1',
      schedule: SCHEDULE,
      ownerUid: uid,
      createdAt: new Date(now - (10 - i) * 1000),
      ...(c.extra ?? {}),
    });
  }
  return { uid, email, password };
}

export interface SeedChild {
  id: string;
  name: string;
  age?: number;
  gender?: 'boy' | 'girl';
  avatar?: string;
  extra?: Record<string, unknown>;
}

/** Signs a parent in through the login form. */
export async function loginParent(page: Page, email: string, password: string) {
  await page.goto('/login?tab=parent');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-pass').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/parent/);
}

/** A fresh parent + child, a server pairing code, then the child tab claims it → /child/home. */
export async function pairChild(page: Page, opts: { reviewDays?: string[] } = {}) {
  const childId = `c${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const { uid } = await seedParent({ children: [{ id: childId, name: 'عبدالله محمد' }] });
  const code = String(Math.floor(100000 + Math.random() * 899999));
  const now = Date.now();
  await setDoc(`pairingCodes/${code}`, {
    parentUid: uid,
    childId,
    createdAt: new Date(now),
    expiresAt: new Date(now + DAY),
    status: 'active',
  });
  await setDoc(`parents/${uid}/children/${childId}`, {
    name: 'عبدالله محمد',
    age: 10,
    gender: 'boy',
    avatar: 'b1',
    schedule: {
      days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'],
      time: 1020,
      custom: {},
      duration: 45,
      reminder: true,
      ...(opts.reviewDays ? { reviewDays: opts.reviewDays } : {}),
    },
    ownerUid: uid,
    createdAt: new Date(now - 1000),
    pairing: { code, expiresAt: new Date(now + DAY), status: 'active' },
  });
  await page.goto('/login?role=child');
  await page.getByLabel('الخانة الأولى من رمز الربط').pressSequentially(code);
  // Six digits verify on their own (auto-submit) → child home.
  await page.waitForURL(/\/child\/home/);
  return { uid, childId };
}
