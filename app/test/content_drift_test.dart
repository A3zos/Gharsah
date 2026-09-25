import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../tool/content_sync.dart';

/// content/ (repo root) is the single source of truth; app/assets/ holds a
/// committed mirror so the Flutter build needs no extra step. This fails CI
/// if anyone edits one side without running `dart run tool/sync_content.dart`.
void main() {
  test('app/assets mirrors content/ exactly', () {
    final diffs = ContentSync.fromAppDir(Directory.current).diff();
    expect(
      diffs,
      isEmpty,
      reason:
          'app/assets/ differs from content/ — edit content/ and run '
          '`dart run tool/sync_content.dart` (from app/).',
    );
  });
}
