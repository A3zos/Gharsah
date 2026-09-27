import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:record/record.dart';

import 'record_paths_stub.dart'
    if (dart.library.io) 'record_paths_io.dart'
    as paths;
import '../ai/ai_teacher.dart';
import 'project_recorder.dart';
import 'wav.dart';

/// [ProjectRecorder] on the `record` package: AAC in an .m4a file in the app's
/// temp directory (mobile), or 16 kHz PCM kept in memory and wrapped as WAV
/// (web). The file is deleted as soon as it's uploaded or discarded.
class RecordProjectRecorder implements ProjectRecorder {
  RecordProjectRecorder([AudioRecorder? recorder])
    : _rec = recorder ?? AudioRecorder();

  static const minDuration = Duration(seconds: 1);

  /// The project report must fit the 2 MB `recordings` bucket: AAC 64 kbps
  /// (mobile) and 8 kHz 16-bit WAV (web) both stay under it for 120 s.
  static const maxDuration = Duration(seconds: 120);
  static const _webSampleRate = 8000;

  final AudioRecorder _rec;
  final _level = StreamController<double>.broadcast();
  StreamSubscription<Amplitude>? _amp;
  StreamSubscription<Uint8List>? _webPcm;
  final BytesBuilder _webBytes = BytesBuilder(copy: false);
  final Stopwatch _watch = Stopwatch();

  @override
  Future<void> start() async {
    if (!await _rec.hasPermission()) throw const MicPermissionDenied();
    if (kIsWeb) {
      _webBytes.clear();
      final stream = await _rec.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: _webSampleRate,
          numChannels: 1,
        ),
      );
      _webPcm = stream.listen(_webBytes.add);
    } else {
      await _rec.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 44100,
          numChannels: 1,
          noiseSuppress: true,
        ),
        path: await paths.newRecordingPath(),
      );
    }
    _watch
      ..reset()
      ..start();
    _amp = _rec
        .onAmplitudeChanged(const Duration(milliseconds: 120))
        .listen((a) => _level.add(((a.current + 60) / 50).clamp(0.0, 1.0)));
  }

  @override
  Future<void> pause() async {
    _watch.stop();
    await _rec.pause();
  }

  @override
  Future<void> resume() async {
    _watch.start();
    await _rec.resume();
  }

  @override
  Future<RecordedAudio?> stop() async {
    _watch.stop();
    await _amp?.cancel();
    _amp = null;
    _level.add(0);
    final path = await _rec.stop();
    final duration = _watch.elapsed;
    final RecordedAudio audio;
    if (kIsWeb) {
      await _webPcm?.cancel();
      _webPcm = null;
      audio = RecordedAudio(
        duration: duration,
        bytes: pcm16ToWav(_webBytes.takeBytes(), sampleRate: _webSampleRate),
      );
    } else {
      if (path == null) return null;
      audio = RecordedAudio(duration: duration, path: path);
    }
    if (duration < minDuration) {
      await discard(audio);
      return null;
    }
    return audio;
  }

  @override
  Future<void> discard(RecordedAudio audio) async {
    final p = audio.path;
    if (p != null) await paths.deleteFile(p);
  }

  @override
  Stream<double> get level => _level.stream;

  @override
  Future<void> dispose() async {
    await _amp?.cancel();
    await _rec.dispose();
    await _level.close();
  }
}
