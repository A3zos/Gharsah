// «اسألني» — the service the ask screen talks to. UI ONLY for now: the NotConnectedAskService
// "thinks" for a moment and answers «not ready yet». Nothing is sent anywhere, and no answer
// text lives in this code — answers will only ever come from verified sources, through the
// real service below.
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

/** What the screen gets back: an answer (later), or «not ready yet» (now). */
export type AskResult = AskAnswer | { kind: 'notReady' };

export interface AskService {
  ask(question: string, lang: UiLanguage): Promise<AskResult>;
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

export function createAskService(): AskService {
  // TODO(ask): the real service — the AI server's mode "open" (/agent/start { mode: 'open' },
  // ai/API_web.md §1.1). Before it plugs in: answers only from verified sources (QuranEnc /
  // HadeethEnc / approved books) with their `sources`; sensitive topics → kind 'sensitive'
  // (refer to the parent); off-topic → 'offTopic'; the child's name never sent (scrub the
  // question like AgentApi's nameRedactor); honour the parent's «السماح بميزة اسألني»
  // (data/askSetting.ts — needs a DB column first).
  return new NotConnectedAskService();
}
