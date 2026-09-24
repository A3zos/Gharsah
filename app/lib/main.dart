import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

import 'app.dart';
import 'core/app_content.dart';
import 'core/debug_preview.dart';
import 'core/preview_data.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/data/pairing_repository.dart';
import 'features/children/data/children_repository.dart';
import 'features/dashboard/data/submissions_repository.dart';
import 'features/subscription/data/subscription_repository.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  final content = await AppContent.load();
  // Debug design-comparison previews show the design's sample children.
  final preview = DebugPreview.screen != null;
  final PairingRepository pairing = preview
      ? PreviewPairingRepository()
      : FunctionsPairingRepository();
  runApp(
    GharsahApp(
      content: content,
      auth: AuthRepository(),
      pairing: pairing,
      children: preview
          ? PreviewChildrenRepository()
          : FirestoreChildrenRepository(pairing),
      submissions: preview
          ? PreviewSubmissionsRepository()
          : FirebaseSubmissionsRepository(),
      // TODO(release): Google Play Billing instead of the mock purchase (§11).
      subscriptions: MockPlaySubscriptionRepository(),
    ),
  );
}
