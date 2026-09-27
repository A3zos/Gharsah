import 'package:supabase_flutter/supabase_flutter.dart';

/// Web records to memory (bytes), never to a file.
Future<String> putLocalFile(
  StorageFileApi bucket,
  String path,
  String localPath,
  FileOptions options,
) => Future.error(UnsupportedError('No local files on web'));
