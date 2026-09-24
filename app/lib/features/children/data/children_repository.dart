import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../../core/mock_data.dart';
import '../../auth/data/auth_failure.dart';
import '../../auth/data/pairing_repository.dart';
import 'child_profile.dart';

abstract interface class ChildrenRepository {
  /// The parent's children, oldest first. Emits an empty list when signed out.
  Stream<List<ChildProfile>> watchChildren();

  /// Saves a new child with a freshly issued pairing code.
  /// Throws [AuthFailure] with an Arabic message.
  Future<ChildProfile> addChild(ChildDraft draft);
}

/// Real children when the parent has any; otherwise the design's sample
/// children (product-owner decision). TODO(phase-c): drop the fallback.
List<ChildProfile> childrenOrSample(List<ChildProfile>? real) =>
    (real == null || real.isEmpty) ? MockData.children : real;

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
    // TODO(phase-c): require an active subscription and a verified email first.
    final ref = col.doc();
    try {
      final code = await _pairing.issueCode(ref.id);
      await ref.set(
        ChildProfile.newDoc(ownerUid: uid, draft: draft, pairingCode: code),
      );
      return ChildProfile(
        id: ref.id,
        name: draft.name.trim(),
        age: draft.age,
        gender: draft.gender,
        avatarId: draft.avatarId!,
        pairingCode: code,
        schedule: draft.schedule,
      );
    } on FirebaseException catch (e) {
      throw AuthFailure.fromCode(e.code);
    }
  }
}
