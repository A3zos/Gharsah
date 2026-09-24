import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/quran/data/audio_cache_store.dart';
import 'package:gharsah/features/quran/data/quran_audio_repository.dart';
import 'package:gharsah/features/quran/data/quran_ref.dart';

Map<String, dynamic> _json(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

/// A fake MP3 body: frame sync + padding.
Uint8List _mp3([int fill = 1]) =>
    Uint8List.fromList([0xFF, 0xFB, 0x90, 0x00, ...List.filled(4000, fill)]);

void main() {
  final meta = QuranMeta.fromJson(_json(QuranMeta.asset));
  final manifest = RecitationManifest.fromJson(_json(RecitationManifest.asset));
  late MemoryAudioCacheStore cache;
  late List<Uri> fetched;
  late Uint8List Function() body;

  QuranAudioRepository repo() => QuranAudioRepository(
    meta: meta,
    manifest: manifest,
    cache: cache,
    fetch: (uri) async {
      fetched.add(uri);
      return body();
    },
  );

  setUp(() {
    cache = MemoryAudioCacheStore();
    fetched = [];
    body = _mp3;
  });

  test('bundled ayah resolves to the asset, never downloads', () async {
    final r = repo();
    final a = await r.resolve(const QuranRef(112, 1));
    expect(a, isA<AssetRecitation>());
    expect((a as AssetRecitation).assetPath, 'audio/quran/112001.mp3');
    await r.prefetch(const [QuranRef(112, 1), QuranRef(112, 4)]);
    expect(fetched, isEmpty);
  });

  test('URL uses the global ayah number', () {
    expect(
      repo().urlFor(const QuranRef(2, 255)).toString(),
      'https://cdn.islamic.network/quran/audio/128/ar.alafasy/262.mp3',
    );
  });

  test(
    'non-bundled ayah is unavailable until prefetched (no streaming)',
    () async {
      final r = repo();
      await expectLater(
        r.resolve(const QuranRef(2, 1)),
        throwsA(isA<RecitationNotAvailable>()),
      );
      expect(fetched, isEmpty);
    },
  );

  test('download once, then play from cache', () async {
    final r = repo();
    await r.prefetch(const [QuranRef(2, 1)]);
    await r.prefetch(const [QuranRef(2, 1)]);
    expect(fetched, hasLength(1));
    expect(fetched.single.path, endsWith('/8.mp3'));
    final a = await r.resolve(const QuranRef(2, 1));
    expect(a, isA<FileRecitation>());
    // A fresh repository (app restart) reuses the persisted index.
    await repo().prefetch(const [QuranRef(2, 1)]);
    expect(fetched, hasLength(1));
  });

  test('rejects a response that is not an MP3', () async {
    body = () => Uint8List.fromList(utf8.encode('<html>error</html>' * 200));
    await expectLater(
      repo().prefetch(const [QuranRef(2, 1)]),
      throwsA(isA<RecitationNotAvailable>()),
    );
    expect(cache.files.containsKey('002001.mp3'), isFalse);
  });

  test('network failure surfaces as RecitationNotAvailable', () async {
    body = () => throw const SocketException('offline');
    await expectLater(
      repo().prefetch(const [QuranRef(2, 1)]),
      throwsA(isA<RecitationNotAvailable>()),
    );
  });

  test('corrupted cached file is dropped and downloaded again', () async {
    final r = repo();
    await r.prefetch(const [QuranRef(2, 1)]);
    cache.files['002001.mp3'] = _mp3(7); // tampered on disk
    await expectLater(
      r.resolve(const QuranRef(2, 1)),
      throwsA(isA<RecitationNotAvailable>()),
    );
    await r.prefetch(const [QuranRef(2, 1)]);
    expect(fetched, hasLength(2));
    expect(await r.resolve(const QuranRef(2, 1)), isA<FileRecitation>());
  });
}
