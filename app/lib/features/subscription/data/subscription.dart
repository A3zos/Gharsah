import 'package:cloud_firestore/cloud_firestore.dart';

enum SubscriptionPlan {
  annual('annual', 'سنوية', Duration(days: 365)),
  monthly('monthly', 'شهرية', Duration(days: 30));

  const SubscriptionPlan(this.id, this.label, this.period);

  final String id;
  final String label;
  final Duration period;

  static SubscriptionPlan fromId(String id) =>
      values.firstWhere((p) => p.id == id, orElse: () => annual);
}

/// The parent's current subscription (`parents/{uid}/subscription/current`).
class Subscription {
  const Subscription({
    required this.plan,
    required this.startedAt,
    required this.expiresAt,
    required this.active,
  });

  factory Subscription.fromDoc(Map<String, dynamic> d) => Subscription(
    plan: SubscriptionPlan.fromId(d['plan'] as String? ?? ''),
    startedAt: (d['startedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    expiresAt: (d['expiresAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
    active: d['status'] == 'active',
  );

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
