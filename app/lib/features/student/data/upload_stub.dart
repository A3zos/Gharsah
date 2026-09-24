import 'package:firebase_storage/firebase_storage.dart';

/// Web records to memory (bytes), never to a file.
Future<void> putLocalFile(Reference ref, String path, SettableMetadata meta) =>
    Future.error(UnsupportedError('No local files on web'));
