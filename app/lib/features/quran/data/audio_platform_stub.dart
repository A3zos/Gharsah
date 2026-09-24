import 'dart:typed_data';

import 'audio_cache_store.dart';

/// Web: no file system — only bundled audio is used; downloads stay in memory.
class PlatformAudioCacheStore extends MemoryAudioCacheStore {}

/// Web builds never download mid-app (only bundled surahs are used there).
Future<Uint8List> platformFetch(Uri uri) =>
    Future.error(UnsupportedError('Audio download is not supported on web'));
