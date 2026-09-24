import 'package:flutter/material.dart';

import '../features/auth/data/app_user.dart';
import 'app_scope.dart';

/// Shown after Splash: signed-in parent → [signedIn], otherwise → [signedOut].
/// Rebuilds on sign-in/out, so logout anywhere lands back on the Auth screen.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key, required this.signedIn, required this.signedOut});

  final Widget Function(AppUser user) signedIn;
  final Widget signedOut;

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
    return StreamBuilder<AppUser?>(
      stream: _changes,
      initialData: AppScope.of(context).auth.currentUser,
      builder: (context, snap) {
        final user = snap.data;
        return user == null ? widget.signedOut : widget.signedIn(user);
      },
    );
  }
}
