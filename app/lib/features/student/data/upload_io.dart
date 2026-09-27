import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Uploads a local recording file (mobile).
Future<String> putLocalFile(
  StorageFileApi bucket,
  String path,
  String localPath,
  FileOptions options,
) => bucket.upload(path, File(localPath), fileOptions: options);
