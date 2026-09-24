import 'package:cloud_firestore/cloud_firestore.dart';

enum ChildGender { girl, boy }

/// Week starts on Saturday, as in the design (08-Schedule).
enum WeekDay {
  sat('السبت', 'سبت'),
  sun('الأحد', 'أحد'),
  mon('الاثنين', 'إثنين'),
  tue('الثلاثاء', 'ثلاثاء'),
  wed('الأربعاء', 'أربعاء'),
  thu('الخميس', 'خميس'),
  fri('الجمعة', 'جمعة');

  const WeekDay(this.label, this.short);

  final String label;
  final String short;
}

/// Lesson schedule (08/09). Times are minutes after midnight.
class ChildSchedule {
  const ChildSchedule({
    required this.days,
    required this.time,
    required this.custom,
    required this.duration,
    this.reminder = true,
  });

  /// Design defaults: سبت، أحد، إثنين، أربعاء · ٥:٠٠ مساءً · ٤٥ دقيقة.
  static const ChildSchedule initial = ChildSchedule(
    days: {WeekDay.sat, WeekDay.sun, WeekDay.mon, WeekDay.wed},
    time: 17 * 60,
    custom: {},
    duration: 45,
  );

  static const durations = [30, 45, 60];

  final Set<WeekDay> days;
  final int time;

  /// Per-day time overrides («تخصيص وقت لكل يوم»); days not listed use [time].
  final Map<WeekDay, int> custom;
  final int duration;
  final bool reminder;

  int timeFor(WeekDay d) => custom[d] ?? time;

  ChildSchedule copyWith({
    Set<WeekDay>? days,
    int? time,
    Map<WeekDay, int>? custom,
    int? duration,
  }) => ChildSchedule(
    days: days ?? this.days,
    time: time ?? this.time,
    custom: custom ?? this.custom,
    duration: duration ?? this.duration,
    reminder: reminder,
  );

  Map<String, dynamic> toMap() => {
    'days': [
      for (final d in WeekDay.values)
        if (days.contains(d)) d.name,
    ],
    'time': time,
    'custom': {
      for (final e in custom.entries)
        if (days.contains(e.key)) e.key.name: e.value,
    },
    'duration': duration,
    'reminder': reminder,
  };

  factory ChildSchedule.fromMap(Map<String, dynamic> m) => ChildSchedule(
    days: {
      for (final n in (m['days'] as List? ?? const []))
        WeekDay.values.byName(n as String),
    },
    time: m['time'] as int? ?? initial.time,
    custom: {
      for (final e in (m['custom'] as Map? ?? const {}).entries)
        WeekDay.values.byName(e.key as String): e.value as int,
    },
    duration: m['duration'] as int? ?? initial.duration,
    reminder: m['reminder'] as bool? ?? true,
  );
}

/// What the parent fills in across AddChild → Schedule → AvatarPicker.
class ChildDraft {
  const ChildDraft({
    required this.name,
    required this.age,
    required this.gender,
    this.schedule = ChildSchedule.initial,
    this.avatarId,
  });

  final String name;
  final int age;
  final ChildGender gender;
  final ChildSchedule schedule;
  final String? avatarId;

  ChildDraft copyWith({ChildSchedule? schedule, String? avatarId}) =>
      ChildDraft(
        name: name,
        age: age,
        gender: gender,
        schedule: schedule ?? this.schedule,
        avatarId: avatarId ?? this.avatarId,
      );
}

/// A child on the parent's account (`parents/{uid}/children/{childId}`).
class ChildProfile {
  const ChildProfile({
    required this.id,
    required this.name,
    required this.age,
    required this.gender,
    required this.avatarId,
    required this.pairingCode,
    this.schedule,
    this.isMock = false,
  });

  factory ChildProfile.fromDoc(String id, Map<String, dynamic> d) =>
      ChildProfile(
        id: id,
        name: d['name'] as String? ?? '',
        age: d['age'] as int? ?? 10,
        gender: d['gender'] == 'boy' ? ChildGender.boy : ChildGender.girl,
        avatarId: d['avatar'] as String? ?? 'g1',
        pairingCode: (d['pairing'] as Map?)?['code'] as String? ?? '',
        schedule: d['schedule'] is Map
            ? ChildSchedule.fromMap(
                Map<String, dynamic>.from(d['schedule'] as Map),
              )
            : null,
      );

  final String id;
  final String name;
  final int age;
  final ChildGender gender;

  /// Avatar id from 10-AvatarPicker: g1–g5 (girls), b1–b4 (boys).
  final String avatarId;

  /// Six Latin digits; shown with Arabic-Indic digits in the UI.
  final String pairingCode;
  final ChildSchedule? schedule;

  /// Design sample data (lib/core/mock_data.dart), not a Firestore child.
  final bool isMock;

  /// Firestore write for a new child (rules check every field).
  static Map<String, dynamic> newDoc({
    required String ownerUid,
    required ChildDraft draft,
    required String pairingCode,
  }) => {
    'name': draft.name.trim(),
    'age': draft.age,
    'gender': draft.gender.name,
    'avatar': draft.avatarId,
    'schedule': draft.schedule.toMap(),
    // TODO(phase-c): issued by a Cloud Function (provider 'server'), not the device.
    'pairing': {'code': pairingCode, 'provider': 'mock'},
    'ownerUid': ownerUid,
    'createdAt': FieldValue.serverTimestamp(),
  };
}
