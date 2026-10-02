import '../../../core/supa.dart';
import '../../../widgets/child_avatar.dart';

enum ChildGender { girl, boy }

/// Week starts on Saturday, as in the design (08-Schedule). The database stores
/// days as integers in this order: 0 = السبت … 6 = الجمعة.
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

  static WeekDay? ofIndex(Object? i) {
    final n = i is num ? i.toInt() : int.tryParse('$i');
    return n != null && n >= 0 && n < values.length ? values[n] : null;
  }
}

/// Lesson schedule (08/09). Times are minutes after midnight.
class ChildSchedule {
  const ChildSchedule({
    required this.days,
    required this.time,
    required this.custom,
    required this.duration,
    this.reminder = true,
    this.reviewDays = const {WeekDay.thu},
  });

  /// Design defaults: سبت، أحد، إثنين، أربعاء، خميس (مراجعة الخميس) · ٥:٠٠ مساءً · ٤٥ دقيقة.
  static const ChildSchedule initial = ChildSchedule(
    days: {WeekDay.sat, WeekDay.sun, WeekDay.mon, WeekDay.wed, WeekDay.thu},
    time: 17 * 60,
    custom: {},
    duration: 45,
  );

  static const durations = [30, 45, 60];

  /// Weekly review days: 1–3 of the lesson days (review notes B5; the database
  /// enforces the same rule).
  static const maxReviewDays = 3;

  final Set<WeekDay> days;
  final int time;

  /// Per-day time overrides («تخصيص وقت لكل يوم»); days not listed use [time].
  final Map<WeekDay, int> custom;
  final int duration;
  final bool reminder;
  final Set<WeekDay> reviewDays;

  int timeFor(WeekDay d) => custom[d] ?? time;

  /// The review days that are still lesson days, in week order (max 3).
  List<WeekDay> get validReviewDays => [
    for (final d in WeekDay.values)
      if (reviewDays.contains(d) && days.contains(d)) d,
  ].take(maxReviewDays).toList();

  ChildSchedule copyWith({
    Set<WeekDay>? days,
    int? time,
    Map<WeekDay, int>? custom,
    int? duration,
    Set<WeekDay>? reviewDays,
  }) => ChildSchedule(
    days: days ?? this.days,
    time: time ?? this.time,
    custom: custom ?? this.custom,
    duration: duration ?? this.duration,
    reminder: reminder,
    reviewDays: reviewDays ?? this.reviewDays,
  );

  /// The `children` columns for this schedule (days in week order).
  Map<String, dynamic> toRow() {
    final review = validReviewDays;
    return {
      'schedule_days': [
        for (final d in WeekDay.values)
          if (days.contains(d)) d.index,
      ],
      'schedule_time': time,
      'schedule_custom': {
        for (final e in custom.entries)
          if (days.contains(e.key)) '${e.key.index}': e.value,
      },
      'session_duration': duration,
      'reminder': reminder,
      // Never empty while there are lesson days (the database requires 1–3).
      'review_days': [
        for (final d
            in review.isEmpty && days.isNotEmpty
                ? [WeekDay.values.lastWhere(days.contains)]
                : review)
          d.index,
      ],
    };
  }

  static ChildSchedule? fromRow(Map<String, dynamic> r) {
    final raw = r['schedule_days'];
    if (raw is! List) return null;
    final days = {for (final i in raw) ?WeekDay.ofIndex(i)};
    final customRaw = r['schedule_custom'];
    return ChildSchedule(
      days: days,
      time: (r['schedule_time'] as num?)?.toInt() ?? initial.time,
      custom: {
        if (customRaw is Map)
          for (final e in customRaw.entries)
            if (WeekDay.ofIndex(e.key) != null && e.value is num)
              WeekDay.ofIndex(e.key)!: (e.value as num).toInt(),
      },
      duration: (r['session_duration'] as num?)?.toInt() ?? initial.duration,
      reminder: r['reminder'] as bool? ?? true,
      reviewDays: {
        for (final i in (r['review_days'] as List? ?? const []))
          if (WeekDay.ofIndex(i) case final d? when days.contains(d)) d,
      },
    );
  }
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

/// The child's pairing code — issued ONLY by the server (Edge Functions
/// `create-pairing-code` / `revoke-pairing-code`), never generated on a device.
class PairingInfo {
  const PairingInfo({
    required this.code,
    required this.expiresAt,
    required this.status,
  });

  /// From the `child_pairing` RPC.
  static PairingInfo? fromMap(Object? m) {
    if (m is! Map) return null;
    final code = m['code'];
    if (code is! String) return null;
    return PairingInfo(
      code: code,
      expiresAt: parseDate(m['expiresAt']) ?? DateTime.now(),
      status: m['status'] as String? ?? 'active',
    );
  }

  /// Six Latin digits; shown with Arabic-Indic digits in the UI.
  final String code;
  final DateTime expiresAt;

  /// active | claimed | revoked | expired
  final String status;

  bool isActive(DateTime now) => status == 'active' && expiresAt.isAfter(now);
  bool get isClaimed => status == 'claimed';
}

/// A child on the parent's account (`children` row).
class ChildProfile {
  const ChildProfile({
    required this.id,
    required this.name,
    required this.age,
    required this.gender,
    required this.avatarId,
    this.pairing,
    this.linked = false,
    this.createdAt,
    this.stats,
    this.schedule,
    this.isMock = false,
  });

  /// A `children` row + the server's `child_pairing` / `child_stats` answers.
  /// Stats with no activity yet are treated as "no progress" (the dashboard
  /// then shows the flagged design sample).
  factory ChildProfile.fromRow(
    Map<String, dynamic> r, {
    Object? pairing,
    Object? stats,
  }) {
    final s = stats is Map ? Map<String, dynamic>.from(stats) : null;
    return ChildProfile(
      id: '${r['id']}',
      name: r['name'] as String? ?? '',
      age: (r['age'] as num?)?.toInt() ?? 10,
      gender: r['gender'] == 'boy' ? ChildGender.boy : ChildGender.girl,
      avatarId: AvatarStyle.keyFor(
        r['avatar'] as String?,
        girl: r['gender'] != 'boy',
      ),
      pairing: PairingInfo.fromMap(pairing),
      linked: pairing is Map && pairing['linked'] == true,
      createdAt: parseDate(r['created_at']),
      stats: s != null && hasActivity(s) ? s : null,
      schedule: ChildSchedule.fromRow(r),
    );
  }

  /// Any lesson activity in the server stats.
  static bool hasActivity(Map<String, dynamic> s) {
    int n(String k) => s[k] is num ? (s[k] as num).toInt() : 0;
    bool any(String k) => s[k] is List && (s[k] as List).isNotEmpty;
    return n('ayat') > 0 ||
        n('surahs') > 0 ||
        n('hadith') > 0 ||
        n('stars') > 0 ||
        n('projects') > 0 ||
        n('planPct') > 0 ||
        any('surahsDone') ||
        any('hadithDone') ||
        any('lessonDays');
  }

  final String id;
  final String name;
  final int age;
  final ChildGender gender;

  /// Avatar id from 10-AvatarPicker: g1–g5 (girls), b1–b4 (boys).
  final String avatarId;

  /// Server-issued code (null until the server has issued one).
  final PairingInfo? pairing;

  /// A child device has claimed a code and is paired (server-set).
  final bool linked;
  final DateTime? createdAt;

  /// Progress aggregates from the server (`child_stats`); null until the
  /// child finishes a first lesson step. Parsed by the dashboard.
  final Map<String, dynamic>? stats;

  final ChildSchedule? schedule;

  /// Design sample data (debug previews only), not a real child.
  final bool isMock;

  /// Six Latin digits, or '' before the server issued one.
  String get pairingCode => pairing?.code ?? '';

  ChildProfile withPairing(PairingInfo p) => ChildProfile(
    id: id,
    name: name,
    age: age,
    gender: gender,
    avatarId: avatarId,
    pairing: p,
    linked: linked,
    createdAt: createdAt,
    stats: stats,
    schedule: schedule,
    isMock: isMock,
  );

  /// The insert for a new child (the database checks every column). The
  /// pairing code, device link and stats are server-only and never sent.
  static Map<String, dynamic> newRow({
    required String parentId,
    required ChildDraft draft,
  }) => {
    'parent_id': parentId,
    'name': draft.name.trim(),
    'age': draft.age,
    'gender': draft.gender.name,
    'avatar': draft.avatarId,
    ...draft.schedule.toRow(),
  };
}
