// «اسألني» — the service the ask screen talks to: ServerAskService (the AI server's mode
// "open", askRuntime.ts) when the AI server is configured, else NotConnectedAskService, which
// "thinks" for a moment and answers «not ready yet». No answer text lives in this code.
import type { UiLanguage } from '../i18n/i18n';

export interface AskSource {
  label: string;
  url?: string;
}

export interface AskAnswer {
  text: string;
  sources: AskSource[];
  kind: 'answer' | 'sensitive' | 'offTopic';
}

/** What the screen gets back: an answer, the teacher's goodbye (the session ended), or «not ready yet». */
export type AskResult = AskAnswer | { kind: 'goodbye'; text: string } | { kind: 'notReady' };

export interface AskService {
  ask(question: string, lang: UiLanguage): Promise<AskResult>;
  /** Start early (the screen opened), so a cold start overlaps the greeting. */
  warm?(): void;
}

/** Long enough for the «thinking» moment to be seen. */
export const NOT_CONNECTED_DELAY_MS = 1200;

export class NotConnectedAskService implements AskService {
  constructor(
    private readonly delayMs = NOT_CONNECTED_DELAY_MS,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async ask(): Promise<AskResult> {
    await this.sleep(this.delayMs);
    return { kind: 'notReady' };
  }
}

/** VITE_ASK_ENABLED — on unless set to 0 / false / off. */
export function askEnabled(env: Record<string, unknown> | undefined = import.meta.env): boolean {
  const v = String(env?.VITE_ASK_ENABLED ?? '')
    .trim()
    .toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}
// TODO(ask): honour the parent's «السماح بميزة اسألني» (data/askSetting.ts — this browser only
// today; needs a DB column the child app can read).
