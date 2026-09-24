import '../../quran/data/quran_ref.dart';

/// The AI teacher, as seen by the app — mirrors ai/CONTRACT.md (Draft v0.1).
///
/// The app ships an INTERIM implementation (lib/features/lesson/ai/interim/)
/// that the AI developer's module replaces behind this interface.
///
/// Division of work with [LessonAgent]: the teacher *speaks* approved lines and
/// *detects* the child's speech (presence only — never grading). The agent
/// decides what happens next: counting, nudges, gating the mic around the
/// reciter and the teacher's own voice, and advancing steps.
abstract interface class AiTeacher {
  /// App → AI events (CONTRACT §3).
  void onEvent(LessonEvent event);

  /// AI → App actions (CONTRACT §4) that come from listening.
  Stream<TeacherAction> get actions;

  /// Live input level 0..1 for the child's voice bars (on-device, never stored).
  Stream<double> get inputLevel;

  /// `speak` action: plays [line] (resolved [text] for captions/TTS).
  /// Completes when the line finished or [stopSpeaking] was called.
  Future<void> speak(TeacherLine line, String text);

  Future<void> stopSpeaking();

  /// `listen` action: the mic stays open until [stopListening].
  /// Throws [MicPermissionDenied] if the child can't be heard.
  Future<void> listen(ListenMode mode);

  Future<void> stopListening();

  Future<void> setVolume(double volume);

  Future<void> dispose();
}

/// A line from the approved teacher-line bank (CONTRACT §5) + its slots.
class TeacherLine {
  const TeacherLine(this.id, [this.slots = const {}]);

  final String id;
  final Map<String, String> slots;

  @override
  bool operator ==(Object other) =>
      other is TeacherLine && other.id == id && _mapEq(other.slots, slots);

  @override
  int get hashCode => Object.hash(id, Object.hashAllUnordered(slots.entries.map((e) => '${e.key}=${e.value}')));

  static bool _mapEq(Map<String, String> a, Map<String, String> b) =>
      a.length == b.length && a.entries.every((e) => b[e.key] == e.value);

  @override
  String toString() => 'TeacherLine($id)';
}

enum ListenMode { repeats, answer }

enum AnswerIntent { yes, no, understood, unknown }

class MicPermissionDenied implements Exception {
  const MicPermissionDenied();
}

// ── App → AI events ──────────────────────────────────────────────────────────

sealed class LessonEvent {
  const LessonEvent();
}

class LessonStarted extends LessonEvent {
  const LessonStarted(this.lessonId, this.childFirstName);
  final String lessonId;
  final String childFirstName;
}

class StepShown extends LessonEvent {
  const StepShown(this.stepIndex);
  final int stepIndex;
}

class RecitationStarted extends LessonEvent {
  const RecitationStarted(this.ref);
  final QuranRef? ref;
}

class RecitationFinished extends LessonEvent {
  const RecitationFinished(this.ref);
  final QuranRef? ref;
}

class PlaybackBlockedEvent extends LessonEvent {
  const PlaybackBlockedEvent(this.ref);
  final QuranRef? ref;
}

class MicOpened extends LessonEvent {
  const MicOpened();
}

class MicMuted extends LessonEvent {
  const MicMuted();
}

class TapFallback extends LessonEvent {
  const TapFallback(this.answer);
  final AnswerIntent answer;
}

// ── AI → App actions (from listening) ────────────────────────────────────────

sealed class TeacherAction {
  const TeacherAction();
}

/// The child started speaking (the agent holds the silence timer).
class SpeechStarted extends TeacherAction {
  const SpeechStarted();
}

/// The child spoke and stopped — one repeat candidate (presence only).
class RepeatDetected extends TeacherAction {
  const RepeatDetected();
}

/// A short answer in [ListenMode.answer].
class AnswerDetected extends TeacherAction {
  const AnswerDetected(this.intent);
  final AnswerIntent intent;
}
