import 'dart:math' as math;
import 'dart:typed_data';

/// INTERIM — replaced by the AI developer's VAD (ai/CONTRACT.md §1).
///
/// On-device speech-*presence* detection from 16-bit mono PCM: "the child
/// spoke, then stopped" = one utterance. It never judges pronunciation, and
/// the audio is only measured, never stored or sent anywhere.
///
/// Energy-based with an adaptive noise floor; time is derived from the sample
/// count, so it's deterministic in tests.
class PresenceDetector {
  PresenceDetector({
    required this.onSpeechStart,
    required this.onUtterance,
    this.sampleRate = 16000,
    this.marginDb = 12,
    this.minSpeechDb = -50,
    this.onset = const Duration(milliseconds: 150),
    this.hangover = const Duration(milliseconds: 700),
    this.minUtterance = const Duration(milliseconds: 350),
    this.calibration = const Duration(milliseconds: 250),
  });

  final void Function() onSpeechStart;

  /// [voiced] = how long the child actually spoke in this utterance.
  final void Function(Duration voiced) onUtterance;
  final int sampleRate;

  /// Speech must be this far above the noise floor…
  final double marginDb;

  /// …and above this absolute level (quiet rooms).
  final double minSpeechDb;

  /// Voiced time needed before speech "starts" (ignores clicks).
  final Duration onset;

  /// Silence that ends an utterance.
  final Duration hangover;

  /// Shorter utterances (a cough, a tap) are ignored.
  final Duration minUtterance;

  /// The first moments of each listening window only measure the room.
  final Duration calibration;

  double _floor = -60;
  int _calibratedUs = 0;
  double _calibrationMin = 0;
  int _voicedUs = 0;
  int _silenceUs = 0;
  bool _inSpeech = false;
  double _level = 0;

  /// 0..1 for the voice bars.
  double get level => _level;

  void reset() {
    _calibratedUs = 0;
    _voicedUs = 0;
    _silenceUs = 0;
    _inSpeech = false;
    _level = 0;
  }

  /// Feeds one chunk of PCM16 little-endian mono samples.
  void add(Uint8List pcm) {
    final n = pcm.lengthInBytes ~/ 2;
    if (n == 0) return;
    final data = ByteData.sublistView(pcm);
    var sum = 0.0;
    for (var i = 0; i < n; i++) {
      final v = data.getInt16(i * 2, Endian.little) / 32768.0;
      sum += v * v;
    }
    final rms = math.sqrt(sum / n);
    final db = rms <= 1e-9 ? -100.0 : 20 * math.log(rms) / math.ln10;
    addLevel(db, Duration(microseconds: n * 1000000 ~/ sampleRate));
  }

  /// Feeds one measured level (dBFS) covering [span] of audio.
  void addLevel(double db, Duration span) {
    final us = span.inMicroseconds;
    _level = ((db + 60) / 50).clamp(0.0, 1.0);
    if (_calibratedUs < calibration.inMicroseconds) {
      _calibrationMin = _calibratedUs == 0 ? db : math.min(_calibrationMin, db);
      _calibratedUs += us;
      if (_calibratedUs >= calibration.inMicroseconds) {
        _floor = _calibrationMin.clamp(-90.0, -25.0);
      }
      return;
    }
    final threshold = math.max(_floor + marginDb, minSpeechDb);
    final voiced = db > threshold;

    // Noise floor: drops fast, rises slowly (and not while the child speaks).
    if (db < _floor) {
      _floor += (db - _floor) * 0.5;
    } else if (!voiced) {
      _floor += (db - _floor) * 0.02;
    }
    _floor = _floor.clamp(-90.0, -25.0);

    if (voiced) {
      _voicedUs += us;
      _silenceUs = 0;
      if (!_inSpeech && _voicedUs >= onset.inMicroseconds) {
        _inSpeech = true;
        onSpeechStart();
      }
      return;
    }
    if (!_inSpeech) {
      // Decay stray voiced blips that never reached the onset.
      _voicedUs = math.max(0, _voicedUs - us);
      return;
    }
    _silenceUs += us;
    if (_silenceUs >= hangover.inMicroseconds) {
      final voicedTime = Duration(microseconds: _voicedUs);
      _inSpeech = false;
      _voicedUs = 0;
      _silenceUs = 0;
      if (voicedTime >= minUtterance) onUtterance(voicedTime);
    }
  }
}
