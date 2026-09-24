import 'dart:io';

import 'package:firebase_storage/firebase_storage.dart';

/// Uploads a local recording file (mobile).
Future<void> putLocalFile(Reference ref, String path, SettableMetadata meta) =>
    ref.putFile(File(path), meta);
