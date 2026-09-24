import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/data/pairing_repository.dart';
import 'features/children/data/children_repository.dart';
import 'features/subscription/data/subscription_repository.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // TODO(phase-c): server-issued codes (Cloud Function) instead of the mock.
  final pairing = MockPairingRepository();
  runApp(
    GharsahApp(
      auth: AuthRepository(),
      pairing: pairing,
      children: FirestoreChildrenRepository(pairing),
      // TODO(phase-c): Google Play Billing instead of the mock purchase.
      subscriptions: MockPlaySubscriptionRepository(),
    ),
  );
}
