import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

import '../../quran/data/quran_audio_repository.dart';
import 'recitation_player.dart';

/// [RecitationPlayer] on audioplayers. Local sources only (bundled asset or a
/// verified cached file) — never a network URL, so nothing streams mid-lesson.
class AudioplayersRecitationPlayer implements RecitationPlayer {
  AudioplayersRecitationPlayer([AudioPlayer? player])
    : _player = player ?? AudioPlayer(playerId: 'recitation') {
    _sub = _player.onPlayerComplete.listen((_) => _done.add(null));
  }

  final AudioPlayer _player;
  final _done = StreamController<void>.broadcast();
  late final StreamSubscription<void> _sub;

  @override
  Future<void> start(RecitationAudio audio) async {
    final source = switch (audio) {
      AssetRecitation(:final assetPath) => AssetSource(assetPath),
      FileRecitation(:final path) => DeviceFileSource(path),
    };
    try {
      await _player.stop();
      await _player.play(source);
    } catch (e) {
      // Browsers refuse autoplay without a user gesture (NotAllowedError).
      if (kIsWeb) throw PlaybackBlocked(e);
      rethrow;
    }
  }

  @override
  Stream<void> get completed => _done.stream;

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> resume() => _player.resume();

  @override
  Future<void> stop() => _player.stop();

  @override
  Future<void> setVolume(double volume) => _player.setVolume(volume);

  @override
  Future<void> dispose() async {
    await _sub.cancel();
    await _done.close();
    await _player.dispose();
  }
}
