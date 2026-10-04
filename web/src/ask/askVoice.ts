// «اسألني» — the mic: the browser's speech recognition in the session language (ar-SA / en-US /
// id-ID). Never /agent/score-recitation. No speech recognition in this browser → no mic at
// all (the screen shows the keyboard + the chips).
import type { AgentLang } from '../lesson/server/api';
import { BrowserSpeechInput } from '../lesson/web/serverPorts';

/** What the child said, nothing heard, or the mic / recognition is blocked. */
export type AskListenResult = { text: string } | 'silent' | 'denied';

export interface AskVoice {
  listen(signal: AbortSignal): Promise<AskListenResult>;
  close(): void;
}

export function createAskVoice(lang: AgentLang): AskVoice | null {
  const speech = BrowserSpeechInput.create(lang);
  if (!speech) return null;
  return {
    async listen(signal) {
      try {
        const text = (await speech.listen(signal))?.trim();
        return text ? { text } : 'silent';
      } catch {
        return 'denied'; // blocked / unavailable — the screen offers the keyboard
      }
    },
    close: () => {},
  };
}
