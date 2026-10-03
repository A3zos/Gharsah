// INTERIM AI teacher for the web — clearly temporary, replaced by the AI
// developer's module behind AiTeacher (ai/CONTRACT.md). Port of
// app/lib/features/lesson/ai/interim/device_ai_teacher.dart:
// * Voice: with VITE_AI_VOICE=1, the AI server's voice via our ai-speak function
//   (serverVoice.ts); otherwise — or whenever the server fails or is slow — the
//   browser's Arabic speech synthesis reading the approved line bank (no Arabic
//   voice → silent, paced by the caption length, and `voiceMissing` turns true).
//   English / Indonesian UI: the same, in that language (server audio only when
//   ai-speak confirms the language — serverVoice.ts; browser voice of that language).
// * Listening: on-device presence detection on the shared mic. Presence only —
//   no grading; nothing is stored or uploaded.
// * Short answers: any detected speech in answer mode counts as «yes» (INTERIM,
//   as in the Dart); the design's tap fallback stays available.
import {
  MicPermissionDenied,
  type AiTeacher,
  type LessonEvent,
  type ListenMode,
  type TeacherAction,
} from '../aiTeacher';
import { Emitter } from '../observable';
import { REPEAT_MIN_SPEECH_MS } from '../voice/recitationVerifier';
import { PresenceDetector } from '../presenceDetector';
import { lineLanguage, type LineLang, type TeacherLine } from '../teacherLines';
import type { LessonMicrophone } from './microphone';
import type { LipSync } from './lipSync';
import type { ServerVoice } from './serverVoice';

const MS_PER_CHAR = 70;
/** Quiet between the teacher's lines. */
const LINE_GAP_MS = 350;
const MIN_SILENT_MS = 1200;
const VOICES_WAIT_MS = 1500;

/** How long a line takes when it can't be voiced (captions still pace the lesson). */
export const estimatedSpeechMs = (text: string) => Math.max(MIN_SILENT_MS, text.length * MS_PER_CHAR);

export class SpeechTeacher implements AiTeacher {
  private readonly _actions = new Emitter<TeacherAction>();
  private readonly _level = new Emitter<number>();
  readonly actions = this._actions.subscribe;
  readonly inputLevel = this._level.subscribe;
  private readonly _voiceMissing = new Emitter<boolean>();
  /** True while lines can't be voiced at all (captions only) — the view says so. */
  readonly voiceMissing = this._voiceMissing.subscribe;
  private missing = false;
  private audio: HTMLAudioElement | null = null;

  private mode: ListenMode | null = null;
  private stopSampling: (() => void) | null = null;
  private speaking = false;
  private finishSpeech: (() => void) | null = null;
  private volume = 1;
  private readonly voices = new Map<LineLang, Promise<SpeechSynthesisVoice | null>>();
  private lastLineEnd = 0;
  private detector: PresenceDetector | null = null;
  private speakToken: object | null = null;

  constructor(
    private readonly mic: LessonMicrophone,
    private readonly synth: SpeechSynthesis | null = typeof speechSynthesis === 'undefined'
      ? null
      : speechSynthesis,
    private readonly server: ServerVoice | null = null,
    /** The character's mouth follows the voice (optional). */
    private readonly lip: LipSync | null = null,
    /**
     * The UI language: each line is voiced in it (server or browser voice of that
     * language) — or in Arabic when that line can't be translated (teacherLines.ts).
     */
    private readonly lang: LineLang = 'ar',
  ) {}

  get isVoiceMissing(): boolean {
    return this.missing;
  }

  onEvent(_event: LessonEvent): void {
    // Stateless between events (the real module may use them).
  }

  async speak(line: TeacherLine, text: string): Promise<void> {
    this.finishSpeech?.();
    // a natural pause (~350 ms) since the previous line ended
    const gap = this.lastLineEnd + LINE_GAP_MS - Date.now();
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    this.speaking = true; // deaf from now — also while the server voice loads
    const mine = {};
    this.speakToken = mine;
    // the language this line is said in (the text was resolved the same way by the agent's bank)
    const spoken = lineLanguage(this.lang, line);
    const blob = this.server ? await this.server.audioFor(line, spoken) : null;
    if (this.speakToken !== mine) return; // stopped or replaced meanwhile
    if (blob && (await this.playServer(blob, text, mine))) {
      this.setMissing(false);
      this.lastLineEnd = Date.now();
      return;
    }
    if (this.speakToken !== mine) return;
    const voice = await this.browserVoice(spoken);
    if (this.speakToken !== mine) return;
    this.setMissing(!this.synth || !voice);
    this.speaking = true;
    await new Promise<void>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = () => {
        if (this.finishSpeech !== done) return;
        this.finishSpeech = null;
        this.speaking = false;
        clearTimeout(timer);
        this.lip?.end();
        resolve();
      };
      this.finishSpeech = done;
      if (!this.synth || !voice) {
        timer = setTimeout(done, estimatedSpeechMs(text));
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9;
      u.volume = this.volume;
      u.onstart = () => this.lip?.begin(null); // speechSynthesis can't be analysed → syllable rhythm
      u.onend = done;
      u.onerror = done;
      // Some engines never fire `end` (Chrome drops long utterances) — never hang the lesson.
      timer = setTimeout(done, estimatedSpeechMs(text) * 2 + 3000);
      this.synth.cancel();
      this.synth.speak(u);
    });
    this.lastLineEnd = Date.now();
  }

  async stopSpeaking(): Promise<void> {
    this.speakToken = null;
    this.audio?.pause();
    try {
      this.synth?.cancel();
    } catch {
      // nothing to stop
    }
    this.finishSpeech?.();
    this.lip?.end();
    this.speaking = false; // also when stopped while the server voice was loading
  }

  async listen(mode: ListenMode): Promise<void> {
    this.mode = mode;
    if (this.stopSampling) return; // already open — just switch mode
    await this.mic.open().catch(() => {
      throw new MicPermissionDenied();
    });
    const detector = new PresenceDetector({
      sampleRate: this.mic.sampleRate,
      onSpeechStart: () => this._actions.emit({ type: 'speechStarted' }),
      onIgnored: () => this._actions.emit({ type: 'speechIgnored' }),
      // a repeat (or an answer) counts only after real speech (energy above the adaptive threshold)
      minUtteranceMs: REPEAT_MIN_SPEECH_MS,
      onUtterance: (voicedMs) =>
        this._actions.emit(
          this.mode === 'answer'
            ? { type: 'answerDetected', intent: 'yes' } // INTERIM: presence = answer
            : { type: 'repeatDetected', voicedMs }, // v0.2 §8.5 (full-surah passes)
        ),
    });
    this.detector = detector;
    this.stopSampling = this.mic.sample((frame, rate) => {
      // Deaf while the teacher talks (the agent also waits out an echo guard).
      if (this.speaking) return;
      detector.addSamples(frame, rate);
      this._level.emit(detector.level);
    });
  }

  async stopListening(): Promise<void> {
    this.mode = null;
    this.stopSampling?.();
    this.stopSampling = null;
    this.detector?.reset();
    this.detector = null;
    this._level.emit(0);
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.audio) this.audio.volume = this.volume;
  }

  /** Plays the server's MP3; false if the browser refuses it (→ the browser's voice). */
  private async playServer(blob: Blob, text: string, token: object): Promise<boolean> {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = this.volume;
    audio.playbackRate = 1; // the server voice at its natural speed
    this.audio = audio;
    const started = await audio.play().then(
      () => true,
      () => false,
    );
    if (!started || this.speakToken !== token) {
      audio.pause();
      URL.revokeObjectURL(url);
      if (this.audio === audio) this.audio = null;
      return this.speakToken !== token; // stopped meanwhile → nothing more to say
    }
    this.lip?.begin(audio); // the server MP3: real lip-sync from its sound
    await new Promise<void>((resolve) => {
      const done = () => {
        if (this.finishSpeech !== done) return;
        this.finishSpeech = null;
        this.speaking = false;
        clearTimeout(timer);
        this.lip?.end();
        audio.pause();
        URL.revokeObjectURL(url);
        if (this.audio === audio) this.audio = null;
        resolve();
      };
      this.finishSpeech = done;
      audio.onended = done;
      audio.onerror = done;
      audio.onpause = done; // stopSpeaking pauses it
      // Never hang the lesson on a stuck stream.
      const timer = setTimeout(done, estimatedSpeechMs(text) * 2 + 5000);
    });
    return true;
  }

  private setMissing(missing: boolean): void {
    if (missing === this.missing) return;
    this.missing = missing;
    this._voiceMissing.emit(missing);
  }

  async dispose(): Promise<void> {
    await this.stopListening();
    await this.stopSpeaking();
    this._actions.clear();
    this._level.clear();
    this._voiceMissing.clear();
  }

  /** ar-SA / en-US / id-ID first, then any voice of that language; null if the browser has none. */
  private browserVoice(lang: LineLang): Promise<SpeechSynthesisVoice | null> {
    const synth = this.synth;
    if (!synth) return Promise.resolve(null);
    const known = this.voices.get(lang);
    if (known) return known;
    const p = new Promise<SpeechSynthesisVoice | null>((resolve) => {
      const pick = () => pickVoiceFor(synth.getVoices(), lang);
      if (synth.getVoices().length) return resolve(pick());
      const timer = setTimeout(() => resolve(pick()), VOICES_WAIT_MS);
      synth.addEventListener(
        'voiceschanged',
        () => {
          clearTimeout(timer);
          resolve(pick());
        },
        { once: true },
      );
    });
    this.voices.set(lang, p);
    return p;
  }
}

const PREFERRED_VOICE: Record<LineLang, string> = { ar: 'ar-sa', en: 'en-us', id: 'id-id' };

/**
 * The browser voice for a language: ar-SA / en-US / id-ID first, then any voice of
 * that language (Android may still name Indonesian «in-ID»); null if there is none.
 */
export function pickVoiceFor(
  voices: readonly SpeechSynthesisVoice[],
  lang: LineLang,
): SpeechSynthesisVoice | null {
  const code = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
  const mine = voices.filter((v) => code(v).startsWith(lang) || (lang === 'id' && code(v).startsWith('in-')));
  return mine.find((v) => code(v) === PREFERRED_VOICE[lang]) ?? mine[0] ?? null;
}
