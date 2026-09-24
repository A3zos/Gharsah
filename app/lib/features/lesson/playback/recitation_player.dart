import '../../quran/data/quran_audio_repository.dart';

/// Plays the reciter (or an approved hadith recording) from local audio only.
abstract interface class RecitationPlayer {
  /// Starts playback. Throws [PlaybackBlocked] if the platform refused to
  /// autoplay (web) — the lesson then shows the design's small fallback play.
  Future<void> start(RecitationAudio audio);

  /// Fires once each time playback reaches the end.
  Stream<void> get completed;

  Future<void> pause();
  Future<void> resume();
  Future<void> stop();
  Future<void> setVolume(double volume);
  Future<void> dispose();
}

class PlaybackBlocked implements Exception {
  const PlaybackBlocked([this.cause]);
  final Object? cause;
}
