// The teacher's lip-sync: the voice that is playing → a mouth frame ~12 times a
// second (mouth.ts maps the readings). Server MP3s play on an <audio> element, read
// through a Web Audio AnalyserNode; the browser's speechSynthesis plays outside the
// page (no web page can read it), so then the mouth follows a syllable rhythm.
// Only routed through Web Audio while the shared context is running — an element
// routed into a suspended context would go silent, and the voice matters more.
import { MOUTH_FRAME_MS, MouthShaper, SyllableMouth, levelOf, lowRatioOf, type MouthFrame } from '../mouth';
import { Observable } from '../observable';
import { lessonAudioContext } from './audioUnlock';

export class LipSync {
  /** The mouth frame now ('idle' when quiet). */
  readonly frame = new Observable<MouthFrame>('idle');
  private readonly sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private analyser: AnalyserNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly shaper = new MouthShaper();

  constructor(private readonly context: () => AudioContext | null = lessonAudioContext) {}

  /**
   * The teacher started saying something: `el` is the playing <audio> (server
   * voice), or null for the browser's voice. Call `end()` when the line ends.
   */
  begin(el: HTMLMediaElement | null): void {
    this.stopLoop();
    this.shaper.reset();
    const analyser = el ? this.analyse(el) : null;
    if (analyser) {
      const time = new Float32Array(analyser.fftSize);
      const freq = new Uint8Array(analyser.frequencyBinCount);
      const rate = analyser.context.sampleRate;
      this.timer = setInterval(() => {
        analyser.getFloatTimeDomainData(time);
        analyser.getByteFrequencyData(freq);
        this.frame.value = this.shaper.next({
          level: levelOf(time),
          lowRatio: lowRatioOf(freq, rate, analyser.fftSize),
        });
      }, MOUTH_FRAME_MS);
      return;
    }
    const syllables = new SyllableMouth();
    this.timer = setInterval(() => (this.frame.value = syllables.next()), MOUTH_FRAME_MS);
  }

  end(): void {
    this.stopLoop();
    this.frame.value = 'idle';
  }

  dispose(): void {
    this.stopLoop();
    this.frame.dispose();
  }

  private stopLoop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** el → analyser → speakers (once per element); null when Web Audio can't be used now. */
  private analyse(el: HTMLMediaElement): AnalyserNode | null {
    const ctx = this.context();
    if (!ctx) return null;
    const known = this.sources.get(el);
    if (!known && ctx.state !== 'running') return null; // never route into a suspended context
    try {
      if (!this.analyser || this.analyser.context !== ctx) {
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.5;
        this.analyser.connect(ctx.destination);
      }
      if (!known) {
        const src = ctx.createMediaElementSource(el);
        src.connect(this.analyser);
        this.sources.set(el, src);
      }
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
      return this.analyser;
    } catch {
      return null; // e.g. already connected elsewhere — the syllable rhythm then
    }
  }
}
