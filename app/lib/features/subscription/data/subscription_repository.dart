import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../../auth/data/auth_failure.dart';
import 'subscription.dart';

/// Subscriptions for the signed-in parent. Payment is ONLY via Google Play
/// Billing (CLAUDE.md §3) — never a card form in the app.
abstract interface class SubscriptionRepository {
  /// The current subscription, or null if the parent has none yet.
  Stream<Subscription?> watchCurrent();

  /// Buys or renews [plan]. Throws [AuthFailure] with an Arabic message.
  Future<void> purchase(SubscriptionPlan plan);
}

/// MOCK purchase: skips Google Play and records the subscription directly.
///
/// TODO(phase-c): replace with Google Play Billing (in_app_purchase). The
/// purchase token must be verified server-side (Cloud Function + Play
/// Developer API), and only the server may write `subscription/current`;
/// firestore.rules must then deny client writes to it.
class MockPlaySubscriptionRepository implements SubscriptionRepository {
  MockPlaySubscriptionRepository({FirebaseAuth? auth, FirebaseFirestore? db})
    : _auth = auth ?? FirebaseAuth.instance,
      _db = db ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>>? get _doc {
    final uid = _auth.currentUser?.uid;
    return uid == null
        ? null
        : _db
              .collection('parents')
              .doc(uid)
              .collection('subscription')
              .doc('current');
  }

  @override
  Stream<Subscription?> watchCurrent() {
    final doc = _doc;
    if (doc == null) return Stream.value(null);
    return doc.snapshots().map(
      (s) => s.exists ? Subscription.fromDoc(s.data()!) : null,
    );
  }

  @override
  Future<void> purchase(SubscriptionPlan plan) async {
    final doc = _doc;
    if (doc == null) throw AuthFailure.fromCode('permission-denied');
    try {
      await _db.runTransaction((tx) async {
        final snap = await tx.get(doc);
        final now = DateTime.now();
        // Renewing adds the new period after any time still remaining.
        var from = now;
        if (snap.exists) {
          final current = Subscription.fromDoc(snap.data()!);
          if (current.active && current.expiresAt.isAfter(now)) {
            from = current.expiresAt;
          }
        }
        tx.set(doc, {
          'plan': plan.id,
          'status': 'active',
          'provider': 'mock',
          'startedAt': FieldValue.serverTimestamp(),
          'expiresAt': Timestamp.fromDate(from.add(plan.period)),
        });
      });
    } on FirebaseException catch (e) {
      throw AuthFailure.fromCode(e.code);
    }
  }
}
