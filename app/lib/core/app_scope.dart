import 'package:flutter/widgets.dart';

import 'app_content.dart';
import '../features/dashboard/data/submissions_repository.dart';
import '../features/student/data/child_session.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/auth/data/pairing_repository.dart';
import '../features/children/data/children_repository.dart';
import '../features/subscription/data/subscription_repository.dart';

/// Hands the repositories down the tree so screens don't construct Firebase clients.
class AppScope extends InheritedWidget {
  const AppScope({
    super.key,
    required this.content,
    required this.auth,
    required this.pairing,
    required this.subscriptions,
    required this.children,
    required this.submissions,
    required this.childSession,
    required super.child,
  });

  final ChildSessionRepository childSession;

  final AppContent content;
  final SubmissionsRepository submissions;

  final AuthRepository auth;
  final PairingRepository pairing;
  final SubscriptionRepository subscriptions;
  final ChildrenRepository children;

  static AppScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope not found above this context');
    return scope!;
  }

  @override
  bool updateShouldNotify(AppScope oldWidget) =>
      auth != oldWidget.auth ||
      pairing != oldWidget.pairing ||
      subscriptions != oldWidget.subscriptions ||
      children != oldWidget.children ||
      submissions != oldWidget.submissions ||
      childSession != oldWidget.childSession ||
      content != oldWidget.content;
}
