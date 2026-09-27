import '../../../core/supa.dart';

enum SubscriptionPlan {
  annual('annual', 'سنوية', Duration(days: 366)),
  monthly('monthly', 'شهرية', Duration(days: 31));

  const SubscriptionPlan(this.id, this.label, this.period);

  final String id;
  final String label;

  /// The database's period for the plan (plan_catalog.period_days).
  final Duration period;

  static SubscriptionPlan fromId(String id) =>
      values.firstWhere((p) => p.id == id, orElse: () => annual);
}

/// The parent's current subscription (`subscriptions` row; the database fills
/// the dates — subscriptions_guard).
class Subscription {
  const Subscription({
    required this.plan,
    required this.startedAt,
    required this.expiresAt,
    required this.active,
  });

  /// Null for no plan ('none'). A 'trial' row is shown as the monthly plan
  /// (the Android app only sells annual/monthly).
  static Subscription? fromRow(Map<String, dynamic> d) {
    final plan = d['plan'] as String? ?? 'none';
    if (plan == 'none') return null;
    return Subscription(
      plan: SubscriptionPlan.fromId(plan == 'trial' ? 'monthly' : plan),
      startedAt: parseDate(d['started_at']) ?? DateTime.now(),
      expiresAt: parseDate(d['renews_at']) ?? DateTime.now(),
      active: d['status'] == 'active',
    );
  }

  final SubscriptionPlan plan;
  final DateTime startedAt;
  final DateTime expiresAt;
  final bool active;

  int daysLeft(DateTime now) {
    final d = expiresAt.difference(now).inHours / 24;
    return d <= 0 ? 0 : d.ceil();
  }

  /// Share of the current period still remaining (the bar in the plan card).
  double remainingFraction(DateTime now) {
    final total = expiresAt.difference(startedAt).inSeconds;
    if (total <= 0) return 0;
    final left = expiresAt.difference(now).inSeconds;
    return (left / total).clamp(0.0, 1.0);
  }
}
