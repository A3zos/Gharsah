// The teacher's voice, in two layers:
//   TeacherVoice — what a lesson talks to (say a line, stop, get ready).
//   TtsProvider  — who turns a piece of text into audio (today: the AI server's
//                  /speak → ElevenLabs). Switching the voice provider later means
//                  changing `createTtsProvider` below — one file.
// Whatever the provider, a piece it can't voice returns null and the browser's own
// Arabic voice says it, so the lesson never stops in silence.
import type { AgentApi, AgentLang, Gender } from '../server/api';

export interface TeacherVoice {
  /**
   * Says the line in short pieces; `onPiece` fires as each one starts, with
   * `voiced: false` when neither the provider nor the browser could voice it (the
   * screen then shows it as text). Resolves when said or skipped; rejects with
   * PlaybackBlocked when the browser refuses audio before a tap.
   */
  speak(text: string, onPiece?: (piece: string, voiced: boolean) => void): Promise<void>;
  stop(): void;
  /** Fades the line out over `ms`, then stops it (optional; stop() is the fallback). */
  fadeOut?(ms: number): Promise<void>;
  /** Wakes the voice service at lesson start (optional). */
  warm?(): void;
  /** Resolves once the real voice is ready (or has failed) — the lesson waits for it. */
  ready?(): Promise<boolean>;
}

export interface TtsProvider {
  /** Shown in logs. */
  readonly name: string;
  /** Can it voice at all right now (may wait for a cold start)? false → the browser's voice. */
  ready(): Promise<boolean>;
  /** One short piece of the teacher's speech → audio, or null (→ the browser's voice). */
  synthesize(text: string, gender: Gender): Promise<Blob | null>;
}

/** The AI server's /speak (ElevenLabs) — ai/API_web.md §3 — in the session's language. */
export function agentServerTts(
  api: Pick<AgentApi, 'speakReady' | 'speak'>,
  lang: AgentLang = 'ar',
): TtsProvider {
  return {
    name: 'agent-speak',
    ready: () => api.speakReady(),
    // the voice follows lang + gender on the server (/speak/status)
    synthesize: (text, gender) => api.speak(text, gender, lang),
  };
}

/** THE switch for the teacher's TTS provider. */
export function createTtsProvider(
  api: Pick<AgentApi, 'speakReady' | 'speak'>,
  lang: AgentLang = 'ar',
): TtsProvider {
  return agentServerTts(api, lang);
}
