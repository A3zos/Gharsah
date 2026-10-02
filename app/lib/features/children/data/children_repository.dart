import '../../../core/supa.dart';
import '../../auth/data/auth_failure.dart';
import '../../auth/data/pairing_repository.dart';
import 'child_profile.dart';

abstract interface class ChildrenRepository {
  /// The parent's children, oldest first. Emits an empty list when signed out.
  Stream<List<ChildProfile>> watchChildren();

  /// Saves a new child, then asks the server for its pairing code.
  /// Throws [AuthFailure] with an Arabic message.
  Future<ChildProfile> addChild(ChildDraft draft);

  /// One child, live (frame 11 follows server-side code changes).
  Stream<ChildProfile?> watchChild(String childId);
}

const _childColumns =
    'id, name, age, gender, avatar, schedule_days, schedule_time, schedule_custom, '
    'session_duration, reminder, review_days, created_at';

/// Supabase `children` (RLS: the parent's own rows) + the `child_pairing` /
/// `child_stats` RPCs for the server-only values.
class SupabaseChildrenRepository implements ChildrenRepository {
  SupabaseChildrenRepository(this._pairing);

  final PairingRepository _pairing;

  String? get _uid {
    final u = supa.auth.currentUser;
    return u == null || u.isAnonymous ? null : u.id;
  }

  List<Watched> _live(String uid) => [
    Watched('children', column: 'parent_id', value: uid),
    Watched('child_sessions', column: 'parent_id', value: uid),
    const Watched('progress'),
    const Watched('star_events'),
    const Watched('submissions'),
  ];

  Future<ChildProfile> _withServerFields(Map<String, dynamic> r) async {
    final results = await Future.wait<Object?>([
      supa.rpc('child_pairing', params: {'p_child': r['id']}),
      supa.rpc('child_stats', params: {'c': r['id']}),
      // the pilot days (plan timeline): finished + when
      supa
          .from('progress')
          .select('lesson_id, stage, completed_at, updated_at')
          .eq('child_id', '${r['id']}')
          .like('lesson_id', 'pilot-day-%'),
    ]);
    return ChildProfile.fromRow(
      r,
      pairing: results[0],
      stats: results[1],
      pilot: [
        for (final p in results[2] as List? ?? const [])
          if (p is Map) Map<String, dynamic>.from(p),
      ],
    );
  }

  @override
  Stream<List<ChildProfile>> watchChildren() {
    final uid = _uid;
    if (uid == null) return Stream.value(const []);
    return watchQuery(_live(uid), () async {
      final rows = await supa
          .from('children')
          .select(_childColumns)
          .eq('parent_id', uid)
          .order('created_at');
      return Future.wait([for (final r in rows) _withServerFields(r)]);
    });
  }

  @override
  Future<ChildProfile> addChild(ChildDraft draft) async {
    final uid = _uid;
    if (uid == null) throw AuthFailure.fromCode('permission-denied');
    // TODO(phase-c): require a verified email first (CLAUDE.md §11).
    final String id;
    try {
      final row = await supa
          .from('children')
          .insert(ChildProfile.newRow(parentId: uid, draft: draft))
          .select('id')
          .single();
      id = '${row['id']}';
    } on Object catch (e) {
      // The monthly plan = one child (database trigger) arrives here too.
      throw authFailureOf(e);
    }
    try {
      // The server checks the subscription and ownership, then issues the code.
      final pairing = await _pairing.issueCode(id);
      return ChildProfile(
        id: id,
        name: draft.name.trim(),
        age: draft.age,
        gender: draft.gender,
        avatarId: draft.avatarId!,
        pairing: pairing,
        schedule: draft.schedule,
      );
    } on AuthFailure {
      // No code → don't leave a half-added child behind.
      await supa
          .from('children')
          .delete()
          .eq('id', id)
          .catchError((Object _) => <Map<String, dynamic>>[]);
      rethrow;
    }
  }

  @override
  Stream<ChildProfile?> watchChild(String childId) {
    final uid = _uid;
    if (uid == null) return Stream.value(null);
    return watchQuery(_live(uid), () async {
      final r = await supa
          .from('children')
          .select(_childColumns)
          .eq('id', childId)
          .maybeSingle();
      return r == null ? null : _withServerFields(r);
    });
  }
}
