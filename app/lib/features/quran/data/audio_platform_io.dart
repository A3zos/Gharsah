import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

import 'audio_cache_store.dart';

/// Files under `<app support>/quran_audio/` (not backed up, private to the app).
class PlatformAudioCacheStore implements AudioCacheStore {
  Directory? _dir;

  Future<Directory> get _root async => _dir ??= await Directory(
    '${(await getApplicationSupportDirectory()).path}/quran_audio',
  ).create(recursive: true);

  @override
  Future<Uint8List?> read(String name) async {
    final f = File('${(await _root).path}/$name');
    return await f.exists() ? f.readAsBytes() : null;
  }

  @override
  Future<void> write(String name, Uint8List bytes) async {
    final dir = await _root;
    // Write to a temp file then rename, so a crash never leaves half a file.
    final tmp = File('${dir.path}/$name.part');
    await tmp.writeAsBytes(bytes, flush: true);
    await tmp.rename('${dir.path}/$name');
  }

  @override
  Future<void> delete(String name) async {
    final f = File('${(await _root).path}/$name');
    if (await f.exists()) await f.delete();
  }

  @override
  Future<String> pathFor(String name) async => '${(await _root).path}/$name';
}

/// Plain HTTPS GET with timeouts; the caller verifies the bytes.
Future<Uint8List> platformFetch(Uri uri) async {
  final client = HttpClient()..connectionTimeout = const Duration(seconds: 20);
  try {
    final req = await client.getUrl(uri);
    final res = await req.close().timeout(const Duration(seconds: 60));
    if (res.statusCode != 200) {
      throw HttpException('HTTP ${res.statusCode}', uri: uri);
    }
    final b = BytesBuilder(copy: false);
    await for (final chunk in res.timeout(const Duration(seconds: 60))) {
      b.add(chunk);
    }
    return b.takeBytes();
  } finally {
    client.close(force: true);
  }
}
