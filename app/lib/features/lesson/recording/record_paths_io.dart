import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// A fresh .m4a path in the app's temp directory (never backed up).
Future<String> newRecordingPath() async {
  final dir = await getTemporaryDirectory();
  return '${dir.path}/report_${DateTime.now().microsecondsSinceEpoch}.m4a';
}

Future<void> deleteFile(String path) async {
  final f = File(path);
  if (await f.exists()) await f.delete();
}
