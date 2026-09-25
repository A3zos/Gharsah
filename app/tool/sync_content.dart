// Mirrors the shared, verified content (repo-root content/) into app/assets/.
//
// content/ is the single source of truth for Quran text, recitation audio,
// hadith, projects and lesson scripts (shared with web/). Never edit the
// mirrored copies under app/assets/ — edit content/ and run, from app/:
//
//   dart run tool/sync_content.dart          # copy content/ → assets/
//   dart run tool/sync_content.dart --check  # exit 1 if they differ
//
// test/content_drift_test.dart runs the same check in `flutter test`.
import 'dart:io';

import 'content_sync.dart';

void main(List<String> args) {
  final check = args.contains('--check');
  final sync = ContentSync.fromAppDir(Directory.current);
  final diffs = sync.diff();
  if (check) {
    if (diffs.isEmpty) {
      stdout.writeln('content/ and app/assets/ are in sync.');
      return;
    }
    stderr.writeln('app/assets/ differs from content/:');
    for (final d in diffs) {
      stderr.writeln('  $d');
    }
    stderr.writeln('Run: dart run tool/sync_content.dart');
    exitCode = 1;
    return;
  }
  sync.apply();
  stdout.writeln(
    diffs.isEmpty
        ? 'Already in sync.'
        : 'Synced ${diffs.length} change(s) from content/.',
  );
}
