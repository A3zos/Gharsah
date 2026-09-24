import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:record/record.dart';

import '../ai_teacher.dart';
import 'presence_detector.dart';

/// INTERIM AI teacher — clearly temporary, replaced by the AI developer's
/// module behind [AiTeacher] (see ai/CONTRACT.md).
///
/// * Voice: the device's Arabic TTS reading the approved line bank.
/// * Listening: on-device mic presence detection ([PresenceDetector]).
///   Presence only — no grading; nothing is stored or uploaded.
/// * Short answers: any detected speech in answer mode counts as the expected
///   answer (yes/understood); the design's tap fallback stays available.
class DeviceAiTeacher implements AiTeacher {
  DeviceAiTeacher({FlutterTts? tts, AudioRecorder? recorder})
    : _tts = tts ?? FlutterTts(),
      _mic = recorder ?? AudioRecorder();

  final FlutterTts _tts;
  final AudioRecorder _mic;
  final _actions = StreamController<TeacherAction>.broadcast();
  final _level = StreamController<double>.broadcast();
  late final PresenceDetector _detector = PresenceDetector(
    onSpeechStart: () => _actions.add(const SpeechStarted()),
    onUtterance: (_) => _actions.add(
      _mode == ListenMode.answer
          ? const AnswerDetected(AnswerIntent.yes) // INTERIM: presence = answer
          : const RepeatDetected(),
    ),
  );
  StreamSubscription<Uint8List>? _pcm;
  ListenMode? _mode;
  Future<void>? _ready;
  double _volume = 1;

  Future<void> _init() => _ready ??= () async {
    try {
      await _tts.awaitSpeakCompletion(true);
      final ar = await _tts.isLanguageAvailable('ar-SA') == true;
      await _tts.setLanguage(ar ? 'ar-SA' : 'ar');
      await _tts.setSpeechRate(kIsWeb ? 0.9 : 0.45);
    } catch (e) {
      debugPrint('Arabic TTS not available: $e'); // captions still show
    }
  }();

  @override
  void onEvent(LessonEvent event) {
    // The interim teacher is stateless between events; the real module may
    // use them (e.g. to vary lines or tune detection).
  }

  @override
  Stream<TeacherAction> get actions => _actions.stream;

  @override
  Stream<double> get inputLevel => _level.stream;

  @override
  Future<void> speak(TeacherLine line, String text) async {
    await _init();
    await _tts.setVolume(_volume);
    await _tts.speak(text);
  }

  @override
  Future<void> stopSpeaking() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }

  @override
  Future<void> listen(ListenMode mode) async {
    _mode = mode;
    if (_pcm != null) return; // already open — just switch mode
    if (!await _mic.hasPermission()) throw const MicPermissionDenied();
    final Stream<Uint8List> stream;
    try {
      stream = await _mic.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
          echoCancel: true,
          noiseSuppress: true,
        ),
      );
    } catch (e) {
      debugPrint('Mic stream failed: $e');
      throw const MicPermissionDenied();
    }
    _detector.reset();
    _pcm = stream.listen((chunk) {
      _detector.add(chunk);
      _level.add(_detector.level);
    });
  }

  @override
  Future<void> stopListening() async {
    _mode = null;
    final sub = _pcm;
    _pcm = null;
    await sub?.cancel();
    try {
      await _mic.cancel(); // stream mode writes no file; cancel drops everything
    } catch (_) {}
    _detector.reset();
    _level.add(0);
  }

  @override
  Future<void> setVolume(double volume) async => _volume = volume;

  @override
  Future<void> dispose() async {
    await stopListening();
    await stopSpeaking();
    await _mic.dispose();
    await _actions.close();
    await _level.close();
  }
}
