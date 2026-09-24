import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/lesson/ai/interim/presence_detector.dart';
import 'package:gharsah/features/lesson/recording/wav.dart';

const _chunk = Duration(milliseconds: 50);

void main() {
  late int starts;
  late List<Duration> utterances;
  late PresenceDetector d;

  setUp(() {
    starts = 0;
    utterances = [];
    d = PresenceDetector(
      onSpeechStart: () => starts++,
      onUtterance: utterances.add,
    );
  });

  void feed(double db, Duration total) {
    for (var t = Duration.zero; t < total; t += _chunk) {
      d.addLevel(db, _chunk);
    }
  }

  test('speech then silence = one utterance', () {
    feed(-65, const Duration(seconds: 1)); // room noise
    feed(-25, const Duration(milliseconds: 900)); // child repeats
    expect(starts, 1);
    expect(utterances, isEmpty); // still speaking
    feed(-65, const Duration(milliseconds: 800));
    expect(utterances, hasLength(1));
    expect(utterances.single.inMilliseconds, 900);
  });

  test('three repeats with pauses = three utterances', () {
    feed(-65, const Duration(seconds: 1));
    for (var i = 0; i < 3; i++) {
      feed(-28, const Duration(milliseconds: 1200));
      feed(-66, const Duration(seconds: 1));
    }
    expect(utterances, hasLength(3));
  });

  test('short click or cough is ignored', () {
    feed(-65, const Duration(seconds: 1));
    feed(-20, const Duration(milliseconds: 100)); // below onset
    feed(-65, const Duration(seconds: 1));
    feed(-20, const Duration(milliseconds: 250)); // above onset, below min
    feed(-65, const Duration(seconds: 1));
    expect(utterances, isEmpty);
  });

  test('a short breath inside a sentence does not split it', () {
    feed(-65, const Duration(seconds: 1));
    feed(-25, const Duration(milliseconds: 600));
    feed(-65, const Duration(milliseconds: 400)); // < hangover
    feed(-25, const Duration(milliseconds: 600));
    feed(-65, const Duration(seconds: 1));
    expect(utterances, hasLength(1));
  });

  test('adapts to a noisy room (steady fan is not speech)', () {
    feed(-40, const Duration(seconds: 6)); // loud steady noise
    expect(utterances, isEmpty);
    feed(-18, const Duration(milliseconds: 800)); // speech above the noise
    feed(-40, const Duration(seconds: 1));
    expect(utterances, hasLength(1));
  });

  test('PCM input: a tone is voiced, zeros are silence; level 0..1', () {
    Uint8List pcm(double amp, int ms) {
      final n = 16 * ms;
      final b = ByteData(n * 2);
      for (var i = 0; i < n; i++) {
        b.setInt16(
          i * 2,
          (amp * 32767 * math.sin(2 * math.pi * 220 * i / 16000)).round(),
          Endian.little,
        );
      }
      return b.buffer.asUint8List();
    }

    for (var i = 0; i < 20; i++) {
      d.add(pcm(0.0005, 50));
    }
    for (var i = 0; i < 16; i++) {
      d.add(pcm(0.3, 50));
    }
    expect(d.level, greaterThan(0.5));
    for (var i = 0; i < 20; i++) {
      d.add(pcm(0, 50));
    }
    expect(d.level, 0);
    expect(utterances, hasLength(1));
  });

  test('WAV header wraps PCM16 mono', () {
    final wav = pcm16ToWav(Uint8List(3200), sampleRate: 16000);
    final b = ByteData.sublistView(wav);
    expect(String.fromCharCodes(wav.sublist(0, 4)), 'RIFF');
    expect(String.fromCharCodes(wav.sublist(8, 12)), 'WAVE');
    expect(b.getUint32(24, Endian.little), 16000);
    expect(b.getUint32(40, Endian.little), 3200);
    expect(wav.length, 3244);
  });
}
