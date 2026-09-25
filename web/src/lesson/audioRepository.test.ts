// Port of app/test/quran/quran_audio_repository_test.dart.
import { MemoryAudioCacheStore, QuranAudioRepository } from './audioRepository';
import { RecitationNotAvailable } from './ports';
import { quranRef } from './quran';
import { nodeSha256, realManifest, realMeta } from './testing/fakes';

/** A fake MP3 body: frame sync + padding. */
const mp3 = (fill = 1) => new Uint8Array([0xff, 0xfb, 0x90, 0x00, ...new Array<number>(4000).fill(fill)]);

const meta = realMeta();
const manifest = realManifest();
let cache: MemoryAudioCacheStore;
let fetched: string[];
let body: () => Uint8Array;

const repo = () =>
  new QuranAudioRepository({
    meta,
    manifest,
    cache,
    fetch: async (url) => {
      fetched.push(url);
      return body();
    },
    sha256: nodeSha256,
  });

beforeEach(() => {
  cache = new MemoryAudioCacheStore();
  fetched = [];
  body = mp3;
});

test('bundled ayah resolves to the asset, never downloads', async () => {
  const r = repo();
  expect(await r.resolve(quranRef(112, 1))).toEqual({ kind: 'asset', assetPath: 'audio/quran/112001.mp3' });
  await r.prefetch([quranRef(112, 1), quranRef(112, 4)]);
  expect(fetched).toEqual([]);
});

test('URL uses the global ayah number', () => {
  expect(repo().urlFor(quranRef(2, 255))).toBe(
    'https://cdn.islamic.network/quran/audio/128/ar.alafasy/262.mp3',
  );
});

test('non-bundled ayah is unavailable until prefetched (no streaming)', async () => {
  await expect(repo().resolve(quranRef(2, 1))).rejects.toBeInstanceOf(RecitationNotAvailable);
  expect(fetched).toEqual([]);
});

test('download once, then play from cache', async () => {
  const r = repo();
  await r.prefetch([quranRef(2, 1)]);
  await r.prefetch([quranRef(2, 1)]);
  expect(fetched).toHaveLength(1);
  expect(fetched[0]).toMatch(/\/8\.mp3$/);
  expect((await r.resolve(quranRef(2, 1))).kind).toBe('file');
  // A fresh repository (app restart) reuses the persisted index.
  await repo().prefetch([quranRef(2, 1)]);
  expect(fetched).toHaveLength(1);
});

test('rejects a response that is not an MP3', async () => {
  body = () => new TextEncoder().encode('<html>error</html>'.repeat(200));
  await expect(repo().prefetch([quranRef(2, 1)])).rejects.toBeInstanceOf(RecitationNotAvailable);
  expect(cache.files.has('002001.mp3')).toBe(false);
});

test('network failure surfaces as RecitationNotAvailable', async () => {
  body = () => {
    throw new Error('offline');
  };
  await expect(repo().prefetch([quranRef(2, 1)])).rejects.toBeInstanceOf(RecitationNotAvailable);
});

test('corrupted cached file is dropped and downloaded again', async () => {
  const r = repo();
  await r.prefetch([quranRef(2, 1)]);
  cache.files.set('002001.mp3', mp3(7)); // tampered on disk
  await expect(r.resolve(quranRef(2, 1))).rejects.toBeInstanceOf(RecitationNotAvailable);
  await r.prefetch([quranRef(2, 1)]);
  expect(fetched).toHaveLength(2);
  expect((await r.resolve(quranRef(2, 1))).kind).toBe('file');
});
