import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/app_scope.dart';
import '../data/child_session.dart';

/// Keeps a linked child device honest with the server: when the server
/// confirms the session is gone (the parent revoked it, or another device
/// took over), the cached session is dropped and the code screen returns.
/// Offline, the cached session keeps working.
class ChildGate extends StatefulWidget {
  const ChildGate({super.key, required this.session, required this.child});

  final ChildSession session;
  final Widget child;

  @override
  State<ChildGate> createState() => _ChildGateState();
}

class _ChildGateState extends State<ChildGate> {
  StreamSubscription<bool>? _sub;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The debug mock child has no server session to check.
    if (_sub != null || widget.session.debugMock) return;
    final repo = AppScope.of(context).childSession;
    _sub = repo.watchLinked(widget.session).listen((linked) {
      if (!linked) repo.clear(revoked: true);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
