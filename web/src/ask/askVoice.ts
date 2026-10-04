// «اسألني» — the mic, only to animate listening and to notice when the child starts and stops
// talking (the lesson's on-device presence detector). Nothing is recorded, stored or sent.
import { LessonMicrophone } from '../lesson/web/microphone';
import { MicPresenceListener } from '../lesson/web/serverPorts';

export type AskListenResult = 'spoke' | 'silent' | 'denied';

export interface AskVoice {
  /** Resolves when the child spoke and then paused, said nothing, or the mic is blocked. */
  listen(signal: AbortSignal): Promise<AskListenResult>;
  close(): void;
}

/** Nothing said this long → «I didn't hear you». */
export const ASK_FIRST_WORDS_MS = 8000;
/** A pause this long after speaking = the question is over. */
export const ASK_END_PAUSE_MS = 1500;
/** The longest a spoken question may run. */
export const ASK_MAX_MS = 15_000;

export function createAskVoice(): AskVoice {
  const mic = new LessonMicrophone();
  const presence = new MicPresenceListener(mic);
  const wait = (signal: AbortSignal, minMs: number, timeoutMs: number) =>
    presence.waitForSpeech(signal, { minMs, timeoutMs }).catch(() => 'silent' as const);
  return {
    async listen(signal) {
      const first = await wait(signal, 500, ASK_FIRST_WORDS_MS);
      if (first !== 'spoke') return first;
      const end = Date.now() + ASK_MAX_MS;
      // still talking → keep listening until a pause
      while (!signal.aborted && Date.now() < end) {
        if ((await wait(signal, 300, ASK_END_PAUSE_MS)) !== 'spoke') break;
      }
      return 'spoke';
    },
    close: () => mic.close(),
  };
}
