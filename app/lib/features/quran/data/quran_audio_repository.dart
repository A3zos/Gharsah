import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';

import 'audio_cache_store.dart';
import 'audio_platform_stub.dart'
    if (dart.library.io) 'audio_platform_io.dart'
    as platform;
import 'quran_ref.dart';

typedef AudioFetcher = Future<Uint8List> Function(Uri uri);

/// One bundled recitation file from `assets/audio/quran/manifest.json`.
class BundledRecitation {
  const BundledRecitation({
    required this.ref,
    required this.file,
    required this.sha256,
    required this.duration,
  });

  final QuranRef ref;
  final String file;
  final String sha256;
  final Duration duration;
}

/// The reciter manifest written by tool/build_quran_audio.py.
class RecitationManifest {
  RecitationManifest({
    required this.reciterId,
    required this.riwaya,
    required this.urlPattern,
    required List<BundledRecitation> files,
  }) : bundled = {for (final f in files) f.ref: f};

  static const dir = 'assets/audio/quran';
  static const asset = '$dir/manifest.json';

  factory RecitationManifest.fromJson(Map<String, dynamic> j) =>
      RecitationManifest(
        reciterId: j['reciterId'] as String,
        riwaya: j['riwaya'] as String,
        urlPattern: j['urlPattern'] as String,
        files: [
          for (final f in (j['files'] as List).cast<Map<String, dynamic>>())
            BundledRecitation(
              ref: QuranRef(f['surah'] as int, f['ayah'] as int),
              file: f['file'] as String,
              sha256: f['sha256'] as String,
              duration: Duration(milliseconds: f['durationMs'] as int),
            ),
        ],
      );

  static Future<RecitationManifest> load([AssetBundle? bundle]) async =>
      RecitationManifest.fromJson(
        jsonDecode(await (bundle ?? rootBundle).loadString(asset))
            as Map<String, dynamic>,
      );

  final String reciterId;
  final String riwaya;

  /// e.g. `https://cdn.islamic.network/quran/audio/128/ar.alafasy/{global}.mp3`
  final String urlPattern;
  final Map<QuranRef, BundledRecitation> bundled;
}

/// Where a recitation can be played from — always local, never a stream.
sealed class RecitationAudio {
  const RecitationAudio();
}

/// A bundled asset, path relative to `assets/` (as audioplayers' AssetSource wants).
class AssetRecitation extends RecitationAudio {
  const AssetRecitation(this.assetPath);
  final String assetPath;
}

/// A verified downloaded file on the device.
class FileRecitation extends RecitationAudio {
  const FileRecitation(this.path);
  final String path;
}

/// The ayah's audio isn't on the device yet — call [QuranAudioRepository.prefetch]
/// before the lesson. The lesson never streams mid-way.
class RecitationNotAvailable implements Exception {
  const RecitationNotAvailable(this.ref, [this.cause]);
  final QuranRef ref;
  final Object? cause;

  @override
  String toString() => 'RecitationNotAvailable(${ref.key}, $cause)';
}

/// Reciter audio (Alafasy, Hafs) for an ayah: the bundled asset first; otherwise
/// downloaded once from the manifest's CDN, checked to be a real MP3, cached
/// with its sha256, and re-verified before every play.
class QuranAudioRepository {
  QuranAudioRepository({
    required this.meta,
    required this.manifest,
    AudioCacheStore? cache,
    AudioFetcher? fetch,
  }) : _cache = cache ?? AudioCacheStore.platform(),
       _fetch = fetch ?? platform.platformFetch;

  static const _indexName = 'index.json';

  final QuranMeta meta;
  final RecitationManifest manifest;
  final AudioCacheStore _cache;
  final AudioFetcher _fetch;
  Map<String, String>? _index;

  bool isBundled(QuranRef r) => manifest.bundled.containsKey(r);

  Uri urlFor(QuranRef r) => Uri.parse(
    manifest.urlPattern.replaceAll('{global}', '${meta.globalNumber(r)}'),
  );

  /// Duration from the manifest (bundled ayat only).
  Duration? durationOf(QuranRef r) => manifest.bundled[r]?.duration;

  /// Local audio for [r]. Throws [RecitationNotAvailable] if it isn't on the
  /// device (or the cached copy failed its checksum and was removed).
  Future<RecitationAudio> resolve(QuranRef r) async {
    final b = manifest.bundled[r];
    if (b != null) return AssetRecitation('audio/quran/${b.file}');
    final name = r.audioFileName;
    final expected = (await _loadIndex())[name];
    final bytes = expected == null ? null : await _cache.read(name);
    if (bytes == null) throw RecitationNotAvailable(r);
    if (sha256.convert(bytes).toString() != expected) {
      await _forget(name);
      throw RecitationNotAvailable(r, 'checksum mismatch');
    }
    return FileRecitation(await _cache.pathFor(name));
  }

  /// Makes sure every ref is playable offline. Downloads missing ones once.
  Future<void> prefetch(Iterable<QuranRef> refs) async {
    for (final r in refs) {
      await ensureAvailable(r);
    }
  }

  Future<void> ensureAvailable(QuranRef r) async {
    if (isBundled(r)) return;
    try {
      await resolve(r);
      return;
    } on RecitationNotAvailable {
      // Not cached (or corrupt) — download below.
    }
    final Uint8List bytes;
    try {
      bytes = await _fetch(urlFor(r));
    } catch (e) {
      throw RecitationNotAvailable(r, e);
    }
    if (!looksLikeMp3(bytes)) {
      throw RecitationNotAvailable(r, 'not an MP3 response');
    }
    final name = r.audioFileName;
    await _cache.write(name, bytes);
    final index = await _loadIndex();
    index[name] = sha256.convert(bytes).toString();
    await _saveIndex(index);
  }

  /// An MP3 starts with an ID3 tag or an MPEG audio frame sync, and a real
  /// ayah is never tiny (guards against HTML error pages / truncated bodies).
  static bool looksLikeMp3(Uint8List b) {
    if (b.length < 2048) return false;
    if (b[0] == 0x49 && b[1] == 0x44 && b[2] == 0x33) return true; // "ID3"
    return b[0] == 0xFF && (b[1] & 0xE0) == 0xE0;
  }

  Future<Map<String, String>> _loadIndex() async {
    if (_index != null) return _index!;
    final raw = await _cache.read(_indexName);
    var index = <String, String>{};
    if (raw != null) {
      try {
        index = (jsonDecode(utf8.decode(raw)) as Map).cast<String, String>();
      } on FormatException {
        index = {};
      }
    }
    return _index = index;
  }

  Future<void> _saveIndex(Map<String, String> index) => _cache.write(
    _indexName,
    Uint8List.fromList(utf8.encode(jsonEncode(index))),
  );

  Future<void> _forget(String name) async {
    await _cache.delete(name);
    final index = await _loadIndex();
    index.remove(name);
    await _saveIndex(index);
  }
}
