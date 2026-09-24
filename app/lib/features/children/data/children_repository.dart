import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

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

class FirestoreChildrenRepository implements ChildrenRepository {
  FirestoreChildrenRepository(
    this._pairing, {
    FirebaseAuth? auth,
    FirebaseFirestore? db,
  }) : _auth = auth ?? FirebaseAuth.instance,
       _db = db ?? FirebaseFirestore.instance;

  final PairingRepository _pairing;
  final FirebaseAuth _auth;
  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>>? get _col {
    final uid = _auth.currentUser?.uid;
    return uid == null
        ? null
        : _db.collection('parents').doc(uid).collection('children');
  }

  @override
  Stream<List<ChildProfile>> watchChildren() {
    final col = _col;
    if (col == null) return Stream.value(const []);
    return col
        .orderBy('createdAt')
        .snapshots()
        .map(
          (q) => [for (final d in q.docs) ChildProfile.fromDoc(d.id, d.data())],
        );
  }

  @override
  Future<ChildProfile> addChild(ChildDraft draft) async {
    final col = _col;
    final uid = _auth.currentUser?.uid;
    if (col == null || uid == null) {
      throw AuthFailure.fromCode('permission-denied');
    }
    // TODO(phase-c): require a verified email first (CLAUDE.md §11).
    final ref = col.doc();
    try {
      await ref.set(ChildProfile.newDoc(ownerUid: uid, draft: draft));
    } on FirebaseException catch (e) {
      throw firestoreFailure(e);
    }
    try {
      // The server checks the subscription and ownership, then issues the code.
      final pairing = await _pairing.issueCode(ref.id);
      return ChildProfile(
        id: ref.id,
        name: draft.name.trim(),
        age: draft.age,
        gender: draft.gender,
        avatarId: draft.avatarId!,
        pairing: pairing,
        schedule: draft.schedule,
      );
    } on AuthFailure {
      // No code → don't leave a half-added child behind.
      await ref.delete().catchError((Object _) {});
      rethrow;
    }
  }

  @override
  Stream<ChildProfile?> watchChild(String childId) {
    final col = _col;
    if (col == null) return Stream.value(null);
    return col
        .doc(childId)
        .snapshots()
        .map((d) => d.exists ? ChildProfile.fromDoc(d.id, d.data()!) : null);
  }
}
