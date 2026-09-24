import 'dart:typed_data';

import 'audio_platform_stub.dart'
    if (dart.library.io) 'audio_platform_io.dart'
    as impl;

/// Where downloaded reciter audio is kept on the device.
abstract interface class AudioCacheStore {
  /// The platform store (app support directory), or an in-memory one on web.
  factory AudioCacheStore.platform() = impl.PlatformAudioCacheStore;

  Future<Uint8List?> read(String name);
  Future<void> write(String name, Uint8List bytes);
  Future<void> delete(String name);

  /// A path the audio player can open for [name] (after [write]).
  Future<String> pathFor(String name);
}

/// Test/web store.
class MemoryAudioCacheStore implements AudioCacheStore {
  final Map<String, Uint8List> files = {};

  @override
  Future<Uint8List?> read(String name) async => files[name];

  @override
  Future<void> write(String name, Uint8List bytes) async => files[name] = bytes;

  @override
  Future<void> delete(String name) async => files.remove(name);

  @override
  Future<String> pathFor(String name) async => 'memory://$name';
}
