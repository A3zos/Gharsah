// Reciter audio (Alafasy, Hafs) for an ayah: the bundled file first; otherwise
// downloaded once from the manifest's CDN, checked to be a real MP3, cached with
// its sha256, and re-verified before every play. Port of quran_audio_repository.dart.
// Storage, fetch and hashing are injected (Cache Storage + crypto.subtle in the
// browser, memory fakes in tests).
import type { QuranMeta, QuranRef } from './quran';
import { audioFileName, refKey } from './quran';
import { RecitationNotAvailable, type RecitationAudio } from './ports';

export interface BundledRecitation {
  readonly ref: QuranRef;
  readonly file: string;
  readonly sha256: string;
  readonly durationMs: number;
}

/** The reciter manifest written by app/tool/build_quran_audio.py. */
export class RecitationManifest {
  readonly bundled: ReadonlyMap<string, BundledRecitation>;

  constructor(
    readonly reciterId: string,
    readonly riwaya: string,
    /** e.g. `https://cdn.islamic.network/quran/audio/128/ar.alafasy/{global}.mp3` */
    readonly urlPattern: string,
    files: readonly BundledRecitation[],
  ) {
    this.bundled = new Map(files.map((f) => [refKey(f.ref), f]));
  }

  static fromJson(j: {
    reciterId: string;
    riwaya: string;
    urlPattern: string;
    files: readonly { surah: number; ayah: number; file: string; sha256: string; durationMs: number }[];
  }): RecitationManifest {
    return new RecitationManifest(
      j.reciterId,
      j.riwaya,
      j.urlPattern,
      j.files.map((f) => ({
        ref: { surah: f.surah, ayah: f.ayah },
        file: f.file,
        sha256: f.sha256,
        durationMs: f.durationMs,
      })),
    );
  }
}

/** Where downloaded reciter audio is kept on the device. */
export interface AudioCacheStore {
  read(name: string): Promise<Uint8Array | null>;
  write(name: string, bytes: Uint8Array): Promise<void>;
  delete(name: string): Promise<void>;
  /** Something the player can open for [name] (after write) — an object URL on web. */
  pathFor(name: string): Promise<string>;
}

export class MemoryAudioCacheStore implements AudioCacheStore {
  readonly files = new Map<string, Uint8Array>();
  async read(name: string) {
    return this.files.get(name) ?? null;
  }
  async write(name: string, bytes: Uint8Array) {
    this.files.set(name, bytes);
  }
  async delete(name: string) {
    this.files.delete(name);
  }
  async pathFor(name: string) {
    return `memory://${name}`;
  }
}

export type AudioFetcher = (url: string) => Promise<Uint8Array>;
export type Sha256 = (bytes: Uint8Array) => Promise<string>;

const INDEX = 'index.json';

export class QuranAudioRepository {
  private index: Record<string, string> | undefined;

  constructor(
    private readonly deps: {
      meta: QuranMeta;
      manifest: RecitationManifest;
      cache: AudioCacheStore;
      fetch: AudioFetcher;
      sha256: Sha256;
    },
  ) {}

  isBundled(r: QuranRef): boolean {
    return this.deps.manifest.bundled.has(refKey(r));
  }

  urlFor(r: QuranRef): string {
    return this.deps.manifest.urlPattern.replaceAll('{global}', String(this.deps.meta.globalNumber(r)));
  }

  /** Duration from the manifest (bundled ayat only). */
  durationMsOf(r: QuranRef): number | undefined {
    return this.deps.manifest.bundled.get(refKey(r))?.durationMs;
  }

  /** Local audio for [r]. Throws RecitationNotAvailable if it isn't on the device. */
  async resolve(r: QuranRef): Promise<RecitationAudio> {
    const b = this.deps.manifest.bundled.get(refKey(r));
    if (b) return { kind: 'asset', assetPath: `audio/quran/${b.file}` };
    const name = audioFileName(r);
    const expected = (await this.loadIndex())[name];
    const bytes = expected === undefined ? null : await this.deps.cache.read(name);
    if (!bytes) throw new RecitationNotAvailable(r);
    if ((await this.deps.sha256(bytes)) !== expected) {
      await this.forget(name);
      throw new RecitationNotAvailable(r, 'checksum mismatch');
    }
    return { kind: 'file', path: await this.deps.cache.pathFor(name) };
  }

  /** Makes sure every ref is playable offline. Downloads missing ones once. */
  async prefetch(refs: Iterable<QuranRef>): Promise<void> {
    for (const r of refs) await this.ensureAvailable(r);
  }

  async ensureAvailable(r: QuranRef): Promise<void> {
    if (this.isBundled(r)) return;
    try {
      await this.resolve(r);
      return;
    } catch (e) {
      if (!(e instanceof RecitationNotAvailable)) throw e;
      // Not cached (or corrupt) — download below.
    }
    let bytes: Uint8Array;
    try {
      bytes = await this.deps.fetch(this.urlFor(r));
    } catch (e) {
      throw new RecitationNotAvailable(r, e);
    }
    if (!looksLikeMp3(bytes)) throw new RecitationNotAvailable(r, 'not an MP3 response');
    const name = audioFileName(r);
    await this.deps.cache.write(name, bytes);
    const index = await this.loadIndex();
    index[name] = await this.deps.sha256(bytes);
    await this.saveIndex(index);
  }

  private async loadIndex(): Promise<Record<string, string>> {
    if (this.index) return this.index;
    const raw = await this.deps.cache.read(INDEX);
    let index: Record<string, string> = {};
    if (raw) {
      try {
        index = JSON.parse(new TextDecoder().decode(raw)) as Record<string, string>;
      } catch {
        index = {};
      }
    }
    return (this.index = index);
  }

  private saveIndex(index: Record<string, string>): Promise<void> {
    return this.deps.cache.write(INDEX, new TextEncoder().encode(JSON.stringify(index)));
  }

  private async forget(name: string): Promise<void> {
    await this.deps.cache.delete(name);
    const index = await this.loadIndex();
    delete index[name];
    await this.saveIndex(index);
  }
}

/**
 * An MP3 starts with an ID3 tag or an MPEG audio frame sync, and a real ayah is
 * never tiny (guards against HTML error pages / truncated bodies).
 */
export function looksLikeMp3(b: Uint8Array): boolean {
  if (b.length < 2048) return false;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true; // "ID3"
  return b[0] === 0xff && (b[1]! & 0xe0) === 0xe0;
}
