import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// Saves the e2e screenshots to build/e2e/.
Future<void> main() => integrationDriver(
  onScreenshot: (name, bytes, [args]) async {
    final file = File('build/e2e/$name.png');
    await file.create(recursive: true);
    await file.writeAsBytes(bytes);
    return true;
  },
);
