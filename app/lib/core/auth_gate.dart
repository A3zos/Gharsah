import 'package:flutter/material.dart';

import '../features/auth/data/app_user.dart';
import '../features/student/data/child_session.dart';
import 'app_scope.dart';

/// Shown after Splash. Routes by who is on this device:
/// * a linked child device (anonymous user + verified session) → [child];
/// * a signed-in parent → [signedIn];
/// * otherwise → [signedOut], or [revoked] (the child code screen) right
///   after the parent revoked this device.
/// Rebuilds on sign-in/out and on session changes.
class AuthGate extends StatefulWidget {
  const AuthGate({
    super.key,
    required this.signedIn,
    required this.child,
    required this.signedOut,
    required this.revoked,
  });

  final Widget Function(AppUser user) signedIn;
  final Widget Function(ChildSession session) child;
  final Widget signedOut;
  final Widget revoked;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  Stream<AppUser?>? _changes;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _changes ??= AppScope.of(context).auth.userChanges();
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return StreamBuilder<AppUser?>(
      stream: _changes,
      initialData: scope.auth.currentUser,
      builder: (context, snap) => ValueListenableBuilder<ChildSession?>(
        valueListenable: scope.childSession.session,
        builder: (context, session, _) {
          final user = snap.data;
          if (session != null &&
              user != null &&
              user.isAnonymous &&
              user.uid == session.deviceUid) {
            return widget.child(session);
          }
          if (user != null && !user.isAnonymous) return widget.signedIn(user);
          return scope.childSession.wasRevoked
              ? widget.revoked
              : widget.signedOut;
        },
      ),
    );
  }
}
