// Lesson diagnostics: state transitions, the engine in use (ai | builtin), fallback
// reasons, audio start/end, stuck-state recoveries. Printed with a [lesson] prefix
// and the last LOG_SIZE entries kept in window.__lessonLog so a tester can copy them
// (`copy(__lessonLog)` in the console). Nothing here is sent anywhere, and no child
// data is logged — only lesson mechanics.

export const LOG_SIZE = 50;

export interface LessonLogEntry {
  /** ms since the page loaded */
  readonly t: number;
  readonly at: string;
  readonly engine: 'ai' | 'builtin' | '-';
  readonly event: string;
  readonly data?: unknown;
}

declare global {
  interface Window {
    __lessonLog?: LessonLogEntry[];
  }
}

const buffer: LessonLogEntry[] = [];

export function lessonLog(engine: LessonLogEntry['engine'], event: string, data?: unknown): void {
  const e: LessonLogEntry = {
    t: Math.round(typeof performance !== 'undefined' ? performance.now() : 0),
    at: new Date().toISOString().slice(11, 23),
    engine,
    event,
    ...(data === undefined ? {} : { data }),
  };
  buffer.push(e);
  if (buffer.length > LOG_SIZE) buffer.splice(0, buffer.length - LOG_SIZE);
  (globalThis as { __lessonLog?: LessonLogEntry[] }).__lessonLog = buffer; // window.__lessonLog
  if (import.meta.env.MODE !== 'test') console.info(`[lesson] ${engine} ${event}`, data ?? '');
}

/** The kept entries (tests / support). */
export function lessonLogEntries(): readonly LessonLogEntry[] {
  return buffer;
}

/** Only the fields that changed (for logging a state transition compactly). */
export function changed<T extends object>(
  before: T,
  after: T,
  keys: readonly (keyof T)[],
): Partial<T> | null {
  const out: Partial<T> = {};
  let any = false;
  for (const k of keys)
    if (before[k] !== after[k]) {
      out[k] = after[k];
      any = true;
    }
  return any ? out : null;
}
