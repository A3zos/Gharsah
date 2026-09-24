import 'package:flutter/material.dart';

import '../data/child_session.dart';

/// Frame 17 — StudentHome. TODO(phase-5): built in Phase 5; this is only the
/// landing point for a linked child device until then.
class StudentHomeScreen extends StatelessWidget {
  const StudentHomeScreen({super.key, required this.session});

  final ChildSession session;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(child: Text('مرحبًا ${session.name}')),
  );
}
