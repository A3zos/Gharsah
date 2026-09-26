// RecitationPlayer on an HTMLAudioElement. Local/verified audio only: bundled
// files (served from the site, content/audio/) or a verified cached object URL.
import { Emitter } from '../observable';
import { PlaybackBlocked, type RecitationAudio, type RecitationPlayer } from '../ports';

export class HtmlRecitationPlayer implements RecitationPlayer {
  private readonly audio: HTMLAudioElement;
  private readonly _completed = new Emitter<void>();
  readonly completed = this._completed.subscribe;

  constructor(private readonly base = '/') {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => this._completed.emit());
  }

  async start(audio: RecitationAudio): Promise<void> {
    this.audio.src = audio.kind === 'asset' ? `${this.base}${audio.assetPath}` : audio.path;
    this.audio.currentTime = 0;
    try {
      await this.audio.play();
    } catch (e) {
      // Browsers refuse audio before the first user gesture (NotAllowedError).
      const name = (e as DOMException).name;
      if (name === 'NotAllowedError') throw new PlaybackBlocked();
      // play() interrupted by pause()/stop()/a new src — the agent already moved on.
      if (name === 'AbortError') return;
      throw e;
    }
  }

  async pause(): Promise<void> {
    this.audio.pause();
  }

  async resume(): Promise<void> {
    if (!this.audio.src || this.audio.ended) return;
    try {
      await this.audio.play();
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === 'NotAllowedError') throw new PlaybackBlocked();
      // play() interrupted by pause()/stop()/a new src — the agent already moved on.
      if (name === 'AbortError') return;
      throw e;
    }
  }

  async stop(): Promise<void> {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  async setVolume(volume: number): Promise<void> {
    this.audio.volume = Math.min(1, Math.max(0, volume));
  }

  async dispose(): Promise<void> {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this._completed.clear();
  }
}
