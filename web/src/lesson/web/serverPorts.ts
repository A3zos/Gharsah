// Browser implementations of the server lesson's ports: the teacher's voice
// (server /speak → the browser's voice), the reciter (the server's everyayah
// URLs), on-device presence (nothing stored or sent), and — only with the
// parent's consent — the recitation recorder and the browser's speech recognition.
import { PresenceDetector } from '../presenceDetector';
import { PlaybackBlocked } from '../ports';
import { lessonAudio } from './audioUnlock';
import type { LipSync } from './lipSync';
import { estimatedSpeechMs, pickVoiceFor } from './speechTeacher';
import type { LessonMicrophone } from './microphone';
import type { AgentLang, Gender } from '../server/api';
import type { TtsProvider } from '../voice/tts';
import type {
  PresenceListener,
  SpeechInput,
  TeacherVoice,
  UrlPlayer,
  UtteranceRecorder,
} from '../server/serverLesson';

/** /speak cuts at 1200 characters; pieces this short also make the live caption. */
export const CAPTION_CHARS = 140;
/** Quiet between the teacher's sentences. */
export const LINE_GAP_MS = 350;
/** Silence before a repeat window gives up and listens again (the «ردّدت» stays offered). */
/** Silence before a listening window gives up (the lesson then nudges / continues). */
const LISTEN_WINDOW_MS = 6000;
const MAX_RECITATION_MS = 20_000;
const ECHO_GUARD_MS = 300;

export function speechChunks(text: string, max = CAPTION_CHARS): string[] {
  const t = text.trim();
  if (t.length <= max) return t ? [t] : [];
  const parts = t.split(/(?<=[.!؟?،…\n])\s+/);
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + ' ' + p).trim().length > max && cur) {
      out.push(cur.trim());
      cur = '';
    }
    cur = `${cur} ${p}`;
    while (cur.trim().length > max) {
      out.push(cur.trim().slice(0, max));
      cur = cur.trim().slice(max);
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * The server's ElevenLabs voice (/speak), piece by piece — the next piece is fetched
 * while the current one plays, so the line flows and the caption follows it. A
 * piece the server can't voice → the browser's Arabic voice for that piece. Audio
 * refused before a tap → PlaybackBlocked (the lesson shows the small play button).
 */
export class ServerTeacherVoice implements TeacherVoice {
  private available: Promise<boolean> | null = null;
  private token: object | null = null;
  private finish: (() => void) | null = null;
  private voice: Promise<SpeechSynthesisVoice | null> | null = null;

  constructor(
    /** Who voices the pieces (voice/tts.ts — the one place to switch providers). */
    private readonly tts: TtsProvider,
    private readonly gender: Gender,
    private readonly synth: SpeechSynthesis | null = typeof speechSynthesis === 'undefined'
      ? null
      : speechSynthesis,
    private readonly audio: HTMLAudioElement = lessonAudio('voice'),
    /** The character's mouth follows the voice (optional). */
    private readonly lip: LipSync | null = null,
    /** The session language: the browser's fallback voice speaks it. */
    private readonly lang: AgentLang = 'ar',
  ) {}

  warm(): void {
    this.available ??= this.tts.ready();
  }

  /** Resolves when the server voice is ready (≤ ~45 s); false → the browser's voice. */
  ready(): Promise<boolean> {
    this.warm();
    return this.available!;
  }

  async speak(text: string, onPiece?: (piece: string, voiced: boolean) => void): Promise<void> {
    this.stop();
    const mine = {};
    this.token = mine;
    this.warm();
    const server = await this.available!;
    const pieces = speechChunks(text);
    const fetchPiece = (i: number) =>
      server && pieces[i] ? this.tts.synthesize(pieces[i], this.gender) : Promise.resolve(null);
    let next = fetchPiece(0);
    for (let i = 0; i < pieces.length; i++) {
      // a natural pause between sentences
      if (i > 0) await new Promise((r) => setTimeout(r, LINE_GAP_MS));
      if (this.token !== mine) return;
      const blob = await next;
      if (this.token !== mine) return;
      next = fetchPiece(i + 1);
      const piece = pieces[i]!;
      if (blob && (await this.playBlob(blob, piece, mine, () => onPiece?.(piece, true)))) continue;
      if (this.token !== mine) return;
      await this.browserSay(piece, mine, (voiced) => onPiece?.(piece, voiced));
    }
  }

  stop(): void {
    this.token = null;
    this.lip?.end();
    this.audio.pause();
    try {
      this.synth?.cancel();
    } catch {
      // nothing to stop
    }
    this.finish?.();
  }

  /** True when played (or stopped meanwhile); false → use the browser's voice. */
  private async playBlob(blob: Blob, text: string, token: object, onStart: () => void): Promise<boolean> {
    const url = URL.createObjectURL(blob);
    const audio = this.audio;
    audio.src = url;
    // ElevenLabs at its natural speed — never sped up
    audio.defaultPlaybackRate = 1;
    audio.playbackRate = 1;
    const refused = await audio.play().then(
      () => null,
      (e: unknown) => e as DOMException,
    );
    if (refused || this.token !== token) {
      audio.pause();
      URL.revokeObjectURL(url);
      if (refused?.name === 'NotAllowedError' && this.token === token) throw new PlaybackBlocked();
      return this.token !== token;
    }
    onStart();
    this.lip?.begin(audio); // the server MP3: real lip-sync from its sound
    await new Promise<void>((resolve) => {
      const done = () => {
        if (this.finish !== done) return;
        this.finish = null;
        clearTimeout(timer);
        audio.onended = null;
        audio.onerror = null;
        this.lip?.end();
        URL.revokeObjectURL(url);
        resolve();
      };
      this.finish = done;
      audio.onended = done;
      audio.onerror = done;
      const timer = setTimeout(done, estimatedSpeechMs(text) * 2 + 5000);
    });
    return true;
  }

  /** `onStart(false)` = no voice at all: the lesson shows the line as text instead. */
  private async browserSay(text: string, token: object, onStart: (voiced: boolean) => void): Promise<void> {
    const voice = await this.browserVoice();
    if (this.token !== token) return;
    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (this.finish !== done) return;
        this.finish = null;
        clearTimeout(timer);
        resolve();
      };
      this.finish = done;
      if (!this.synth || !voice) {
        onStart(false);
        timer = setTimeout(done, estimatedSpeechMs(text)); // the caption paces the lesson
        return;
      }
      onStart(true);
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9;
      const finish = () => {
        this.lip?.end();
        done();
      };
      u.onstart = () => this.lip?.begin(null); // speechSynthesis can't be analysed → syllable rhythm
      u.onend = finish;
      u.onerror = finish;
      timer = setTimeout(finish, estimatedSpeechMs(text) * 2 + 3000);
      this.synth.cancel();
      this.synth.speak(u);
    });
  }

  private browserVoice(): Promise<SpeechSynthesisVoice | null> {
    const synth = this.synth;
    if (!synth) return Promise.resolve(null);
    this.voice ??= new Promise((resolve) => {
      const pick = () => pickBrowserVoice(synth.getVoices(), this.lang);
      if (synth.getVoices().length) return resolve(pick());
      const timer = setTimeout(() => resolve(pick()), 1500);
      synth.addEventListener(
        'voiceschanged',
        () => {
          clearTimeout(timer);
          resolve(pick());
        },
        { once: true },
      );
    });
    return this.voice;
  }
}

/** The reciter, from the server's (everyayah) URLs, on the shared (tap-unlocked) element. */
export class HtmlUrlPlayer implements UrlPlayer {
  private finish: (() => void) | null = null;

  constructor(private readonly audio: HTMLAudioElement = lessonAudio('reciter')) {}

  play(url: string): Promise<void> {
    this.stop();
    return new Promise<void>((resolve, reject) => {
      const done = () => {
        if (this.finish !== done) return;
        this.finish = null;
        resolve();
      };
      this.finish = done;
      this.audio.onended = done;
      this.audio.onerror = () => {
        if (this.finish !== done) return;
        this.finish = null;
        reject(new Error('audio error'));
      };
      this.audio.src = url;
      this.audio.play().catch((e: unknown) => {
        if (this.finish !== done) return;
        this.finish = null;
        if ((e as DOMException).name === 'NotAllowedError') reject(new PlaybackBlocked());
        else if ((e as DOMException).name === 'AbortError') resolve();
        else reject(e as Error);
      });
    });
  }

  stop(): void {
    this.audio.pause();
    this.finish?.();
  }
}

/** On-device presence (the built-in lesson's detector) — measured, never stored or sent. */
export class MicPresenceListener implements PresenceListener {
  constructor(private readonly mic: LessonMicrophone) {}

  /** Ask for the mic again (inside the «سماح» tap). */
  async requestAccess(): Promise<boolean> {
    try {
      await this.mic.open();
      return true;
    } catch {
      return false;
    }
  }

  async waitForSpeech(
    signal: AbortSignal,
    opts: { minMs?: number; timeoutMs?: number; onVoiced?: (ms: number) => void } = {},
  ): Promise<'spoke' | 'silent' | 'denied'> {
    try {
      await this.mic.open();
    } catch {
      return 'denied';
    }
    await new Promise((r) => setTimeout(r, ECHO_GUARD_MS));
    if (signal.aborted) return 'silent';
    return new Promise((resolve) => {
      let stop = () => {};
      const finish = (v: 'spoke' | 'silent') => {
        stop();
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      };
      const onAbort = () => finish('silent');
      const windowMs = opts.timeoutMs ?? LISTEN_WINDOW_MS;
      const detector = new PresenceDetector({
        sampleRate: this.mic.sampleRate,
        // the child started speaking: no «silence» while they talk
        onSpeechStart: () => clearTimeout(timer),
        onUtterance: (voicedMs) => {
          opts.onVoiced?.(voicedMs);
          finish('spoke');
        },
        // too short to count (a cough, «اه»): as if nothing was said — a fresh silence window
        onIgnored: () => {
          clearTimeout(timer);
          timer = setTimeout(() => finish('silent'), windowMs);
        },
        ...(opts.minMs ? { minUtteranceMs: opts.minMs } : {}),
      });
      stop = this.mic.sample((frame, rate) => detector.addSamples(frame, rate));
      let timer = setTimeout(() => finish('silent'), windowMs);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * One recited utterance via MediaRecorder (consent only): starts with the mic,
 * stops after the child speaks and falls silent (presence), or at the cap.
 */
export class MediaUtteranceRecorder implements UtteranceRecorder {
  constructor(private readonly mic: LessonMicrophone) {}

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined';
  }

  async record(signal: AbortSignal): Promise<Blob | null> {
    const stream = await this.mic.open();
    await new Promise((r) => setTimeout(r, ECHO_GUARD_MS));
    if (signal.aborted) return null;
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    let spoke = false;
    return new Promise<Blob | null>((resolve) => {
      let stopSampling = () => {};
      const stop = () => {
        stopSampling();
        clearTimeout(cap);
        clearTimeout(silence);
        signal.removeEventListener('abort', onAbort);
        if (rec.state !== 'inactive') rec.stop();
      };
      const onAbort = () => {
        spoke = false;
        stop();
      };
      rec.onstop = () => resolve(spoke && chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null);
      const detector = new PresenceDetector({
        sampleRate: this.mic.sampleRate,
        onSpeechStart: () => {},
        onUtterance: () => {
          spoke = true;
          stop();
        },
      });
      stopSampling = this.mic.sample((frame, rate) => detector.addSamples(frame, rate));
      const cap = setTimeout(() => {
        spoke = true; // a long recitation — send what we have
        stop();
      }, MAX_RECITATION_MS);
      const silence = setTimeout(() => !spoke && stop(), LISTEN_WINDOW_MS);
      signal.addEventListener('abort', onAbort, { once: true });
      rec.start();
    });
  }
}

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

/** SpeechRecognition.lang for the child's free speech in each session language. */
export const SPEECH_RECOGNITION_LANG: Record<AgentLang, string> = { ar: 'ar-SA', en: 'en-US', id: 'id-ID' };

/**
 * webkitSpeechRecognition when the browser has it (Chrome sends the audio to Google —
 * consent only). Free speech in the session language; a recitation (Quran / hadith) is
 * always Arabic — the lesson never uses this for a repeat, but `recitation` forces ar-SA.
 */
export class BrowserSpeechInput implements SpeechInput {
  static create(lang: AgentLang = 'ar'): BrowserSpeechInput | null {
    const w = globalThis as unknown as {
      webkitSpeechRecognition?: new () => RecognitionLike;
      SpeechRecognition?: new () => RecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    return Ctor ? new BrowserSpeechInput(Ctor, lang) : null;
  }

  private constructor(
    private readonly Ctor: new () => RecognitionLike,
    private readonly lang: AgentLang = 'ar',
  ) {}

  /** The recognition language: Arabic for a recitation, else the session language. */
  recognitionLang(recitation = false): string {
    return recitation ? SPEECH_RECOGNITION_LANG.ar : SPEECH_RECOGNITION_LANG[this.lang];
  }

  listen(signal: AbortSignal, o: { recitation?: boolean } = {}): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const r = new this.Ctor();
      r.lang = this.recognitionLang(o.recitation);
      r.interimResults = false;
      r.maxAlternatives = 1;
      let text: string | null = null;
      r.onresult = (e) => {
        text = e.results[0]?.[0]?.transcript?.trim() || null;
      };
      let failed = false;
      // «no-speech» = silence (null); a blocked / unavailable service = a failure
      // (rejects → the lesson uses on-device presence from then on)
      r.onerror = (e?: { error?: string }) => {
        if (e?.error && e.error !== 'no-speech' && e.error !== 'aborted') failed = true;
      };
      r.onend = () => (failed ? reject(new Error('speech recognition unavailable')) : resolve(text));
      signal.addEventListener('abort', () => r.abort(), { once: true });
      try {
        r.start();
      } catch {
        reject(new Error('speech recognition unavailable'));
      }
    });
  }
}

/** The browser's voice for the session language: ar-SA / en-US / id-ID first, then any of that language. */
export function pickBrowserVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang: AgentLang,
): SpeechSynthesisVoice | null {
  return pickVoiceFor(voices, lang); // the built-in lesson's picker (Android's «in-ID» included)
}
