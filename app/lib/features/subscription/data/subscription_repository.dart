import '../../../core/supa.dart';
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

/// MOCK purchase: skips Google Play and records the plan directly (review
/// notes B6). The client upserts only `{parent_id, plan}`; the database
/// (subscriptions_guard) forces provider 'mock', status and dates, and extends
/// a renewal from the current expiry.
///
/// TODO(phase-c): replace with Google Play Billing (in_app_purchase). The
/// purchase token must be verified server-side, and only the server may then
/// write provider 'play' subscriptions.
class MockPlaySubscriptionRepository implements SubscriptionRepository {
  String? get _uid {
    final u = supa.auth.currentUser;
    return u == null || u.isAnonymous ? null : u.id;
  }

  @override
  Stream<Subscription?> watchCurrent() {
    final uid = _uid;
    if (uid == null) return Stream.value(null);
    return watchQuery(
      [Watched('subscriptions', column: 'parent_id', value: uid)],
      () async {
        final r = await supa
            .from('subscriptions')
            .select('plan, status, started_at, renews_at')
            .eq('parent_id', uid)
            .maybeSingle();
        return r == null ? null : Subscription.fromRow(r);
      },
    );
  }

  @override
  Future<void> purchase(SubscriptionPlan plan) async {
    final uid = _uid;
    if (uid == null) throw AuthFailure.fromCode('permission-denied');
    try {
      await supa.from('subscriptions').upsert({
        'parent_id': uid,
        'plan': plan.id,
      }, onConflict: 'parent_id');
    } on Object catch (e) {
      throw authFailureOf(e);
    }
  }
}
