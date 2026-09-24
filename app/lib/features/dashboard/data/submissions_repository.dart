import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

/// A project report the child recorded (frame 22), as the parent sees it (13).
/// `parents/{uid}/children/{childId}/submissions/{id}` + the audio in Storage
/// at `recordings/{uid}/{childId}/{id}.m4a` (or .wav from a web build).
class ProjectSubmission {
  const ProjectSubmission({
    required this.id,
    required this.projectId,
    required this.storagePath,
    required this.duration,
    required this.createdAt,
  });

  factory ProjectSubmission.fromDoc(String id, Map<String, dynamic> d) =>
      ProjectSubmission(
        id: id,
        projectId: d['projectId'] as String? ?? '',
        storagePath: d['storagePath'] as String? ?? '',
        duration: Duration(
          milliseconds: (d['durationMs'] as num?)?.toInt() ?? 0,
        ),
        createdAt: (d['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      );

  final String id;
  final String projectId;
  final String storagePath;
  final Duration duration;
  final DateTime createdAt;
}

abstract interface class SubmissionsRepository {
  /// Newest first; empty when signed out.
  Stream<List<ProjectSubmission>> watch(String childId);

  /// The recording's bytes — read through Storage rules (parent only), never
  /// via a shareable download URL.
  Future<Uint8List> loadAudio(ProjectSubmission s);

  /// Parent deletes a recording (audio + record).
  Future<void> delete(String childId, ProjectSubmission s);
}

class FirebaseSubmissionsRepository implements SubmissionsRepository {
  FirebaseSubmissionsRepository({
    FirebaseAuth? auth,
    FirebaseFirestore? db,
    FirebaseStorage? storage,
  }) : _auth = auth ?? FirebaseAuth.instance,
       _db = db ?? FirebaseFirestore.instance,
       _storage = storage ?? FirebaseStorage.instance;

  static const maxBytes = 8 * 1024 * 1024;

  final FirebaseAuth _auth;
  final FirebaseFirestore _db;
  final FirebaseStorage _storage;

  CollectionReference<Map<String, dynamic>>? _col(String childId) {
    final uid = _auth.currentUser?.uid;
    return uid == null
        ? null
        : _db.collection('parents/$uid/children/$childId/submissions');
  }

  @override
  Stream<List<ProjectSubmission>> watch(String childId) {
    final col = _col(childId);
    if (col == null) return Stream.value(const []);
    return col
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map(
          (q) => [
            for (final d in q.docs) ProjectSubmission.fromDoc(d.id, d.data()),
          ],
        );
  }

  @override
  Future<Uint8List> loadAudio(ProjectSubmission s) async {
    final bytes = await _storage.ref(s.storagePath).getData(maxBytes);
    if (bytes == null) throw StateError('Recording not found');
    return bytes;
  }

  @override
  Future<void> delete(String childId, ProjectSubmission s) async {
    try {
      await _storage.ref(s.storagePath).delete();
    } on FirebaseException catch (e) {
      if (e.code != 'object-not-found') rethrow;
    }
    await _col(childId)?.doc(s.id).delete();
  }
}
