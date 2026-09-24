import 'dart:typed_data';

/// Records the child's next-day project report (frame 22) — the only child
/// audio that is ever stored (GUARDRAILS §11). Lives only until it's saved.
abstract interface class ProjectRecorder {
  /// Throws `MicPermissionDenied` if the mic can't be used.
  Future<void> start();
  Future<void> pause();
  Future<void> resume();

  /// Stops and returns the recording (null if nothing usable was captured).
  Future<RecordedAudio?> stop();

  /// Deletes a recording that won't be sent (re-record / lesson left).
  Future<void> discard(RecordedAudio audio);

  /// Live level 0..1 for the waveform.
  Stream<double> get level;

  Future<void> dispose();
}

class RecordedAudio {
  const RecordedAudio({required this.duration, this.path, this.bytes});

  final Duration duration;

  /// A local m4a file (mobile) …
  final String? path;

  /// … or the bytes (web).
  final Uint8List? bytes;
}
