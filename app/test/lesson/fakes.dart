import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:gharsah/features/lesson/agent/lesson_agent.dart';
import 'package:gharsah/features/lesson/agent/lesson_state.dart';
import 'package:gharsah/features/lesson/ai/ai_teacher.dart';
import 'package:gharsah/features/lesson/data/hadith_repository.dart';
import 'package:gharsah/features/lesson/data/lesson_script.dart';
import 'package:gharsah/features/lesson/data/project_repository.dart';
import 'package:gharsah/features/lesson/playback/recitation_player.dart';
import 'package:gharsah/features/lesson/recording/project_recorder.dart';
import 'package:gharsah/features/quran/data/audio_cache_store.dart';
import 'package:gharsah/features/quran/data/quran_audio_repository.dart';
import 'package:gharsah/features/quran/data/quran_ref.dart';
import 'package:gharsah/features/quran/data/quran_text_repository.dart';

Map<String, dynamic> readJson(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

const speakTime = Duration(seconds: 1);

class FakeTeacher implements AiTeacher {
  final events = <LessonEvent>[];
  final spoken = <String>[];
  final _actions = StreamController<TeacherAction>.broadcast(sync: true);
  final _level = StreamController<double>.broadcast(sync: true);
  Completer<void>? _speaking;
  ListenMode? listeningMode;
  bool denyMic = false;
  int stopSpeakingCalls = 0;

  bool get isListening => listeningMode != null;
  bool get isSpeaking => _speaking != null && !_speaking!.isCompleted;

  void emit(TeacherAction a) => _actions.add(a);

  /// The child says one repeat (speech then silence).
  void childRepeats() {
    emit(const SpeechStarted());
    emit(const RepeatDetected());
  }

  @override
  void onEvent(LessonEvent event) => events.add(event);

  @override
  Stream<TeacherAction> get actions => _actions.stream;

  @override
  Stream<double> get inputLevel => _level.stream;

  @override
  Future<void> speak(TeacherLine line, String text) {
    spoken.add(line.id);
    final c = _speaking = Completer<void>();
    Timer(speakTime, () {
      if (!c.isCompleted) c.complete();
    });
    return c.future;
  }

  @override
  Future<void> stopSpeaking() async {
    stopSpeakingCalls++;
    final c = _speaking;
    if (c != null && !c.isCompleted) c.complete();
  }

  @override
  Future<void> listen(ListenMode mode) async {
    if (denyMic) throw const MicPermissionDenied();
    listeningMode = mode;
  }

  @override
  Future<void> stopListening() async => listeningMode = null;

  @override
  Future<void> setVolume(double volume) async {}

  @override
  Future<void> dispose() async {}
}

class FakePlayer implements RecitationPlayer {
  final started = <RecitationAudio>[];
  final _done = StreamController<void>.broadcast(sync: true);
  bool blockAutoplay = false;
  bool playing = false;
  bool paused = false;
  double volume = 1;

  String? get lastAsset => switch (started.lastOrNull) {
    AssetRecitation(:final assetPath) => assetPath,
    _ => null,
  };

  /// The reciter reaches the end of the ayah.
  void finish() {
    if (!playing || paused) return;
    playing = false;
    _done.add(null);
  }

  @override
  Future<void> start(RecitationAudio audio) async {
    if (blockAutoplay) throw const PlaybackBlocked();
    started.add(audio);
    playing = true;
    paused = false;
  }

  @override
  Stream<void> get completed => _done.stream;

  @override
  Future<void> pause() async => paused = true;

  @override
  Future<void> resume() async => paused = false;

  @override
  Future<void> stop() async {
    playing = false;
    paused = false;
  }

  @override
  Future<void> setVolume(double volume) async => this.volume = volume;

  @override
  Future<void> dispose() async {}
}

class FakeRecorder implements ProjectRecorder {
  final discarded = <RecordedAudio>[];
  final _level = StreamController<double>.broadcast(sync: true);
  bool recording = false;
  bool paused = false;
  bool denyMic = false;
  int takes = 0;

  @override
  Future<void> start() async {
    if (denyMic) throw const MicPermissionDenied();
    recording = true;
    paused = false;
  }

  @override
  Future<void> pause() async => paused = true;

  @override
  Future<void> resume() async => paused = false;

  @override
  Future<RecordedAudio?> stop() async {
    if (!recording) return null;
    recording = false;
    takes++;
    return RecordedAudio(
      duration: Duration(seconds: 10 + takes),
      path: '/tmp/take$takes.m4a',
    );
  }

  @override
  Future<void> discard(RecordedAudio audio) async => discarded.add(audio);

  @override
  Stream<double> get level => _level.stream;

  @override
  Future<void> dispose() async {}
}

class FakeSink implements LessonProgressSink {
  final checkpoints = <LessonProgress>[];
  final completedCalls = <LessonProgress>[];
  final reports = <(String, RecordedAudio)>[];
  bool failSave = false;

  @override
  Future<void> checkpoint(LessonProgress progress) async =>
      checkpoints.add(progress);

  @override
  Future<void> completed(LessonProgress progress) async =>
      completedCalls.add(progress);

  @override
  Future<void> saveReport(String projectId, RecordedAudio audio) async {
    if (failSave) throw Exception('offline');
    reports.add((projectId, audio));
  }
}

LessonContent realContent({HadithRepository? hadith}) {
  final meta = QuranMeta.fromJson(readJson(QuranMeta.asset));
  return LessonContent(
    meta: meta,
    text: QuranTextRepository.fromJson(readJson(QuranTextRepository.asset)),
    audio: QuranAudioRepository(
      meta: meta,
      manifest: RecitationManifest.fromJson(readJson(RecitationManifest.asset)),
      cache: MemoryAudioCacheStore(),
      fetch: (_) async => throw const SocketException('offline'),
    ),
    hadith:
        hadith ?? HadithRepository.fromJson(readJson(HadithRepository.asset)),
    projects: ProjectRepository.fromJson(readJson(ProjectRepository.asset)),
  );
}

LessonScript loadScript(String id) =>
    LessonScript.fromJson(readJson('assets/lessons/$id.json'));

/// Everything a test needs, wired together.
class Rig {
  Rig({
    String lessonId = 'm01-w03-ikhlas',
    LessonContent? content,
    DateTime? now,
    bool debugTap = false,
  }) {
    agent = LessonAgent(
      script: loadScript(lessonId),
      content: content ?? realContent(),
      teacher: teacher,
      player: player,
      recorder: recorder,
      sink: sink,
      childFirstName: 'سارة',
      now: () => now ?? DateTime(2026, 9, 24, 18),
      debugTapCountsRepeat: debugTap,
    );
  }

  final teacher = FakeTeacher();
  final player = FakePlayer();
  final recorder = FakeRecorder();
  final sink = FakeSink();
  late final LessonAgent agent;

  LessonState get s => agent.state.value;
}

/// Bytes helper for fetch fakes.
Uint8List bytes(List<int> b) => Uint8List.fromList(b);
