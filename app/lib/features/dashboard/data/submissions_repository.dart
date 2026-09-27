import '../../../core/supa.dart';

/// A project report the child recorded (frame 22), as the parent sees it (13).
/// A `submissions` row + the audio in the private `recordings` bucket at
/// `{parent_id}/{child_id}/{id}.m4a` (or .wav from a web build).
class ProjectSubmission {
  const ProjectSubmission({
    required this.id,
    required this.projectId,
    required this.storagePath,
    required this.duration,
    required this.createdAt,
  });

  factory ProjectSubmission.fromRow(Map<String, dynamic> d) =>
      ProjectSubmission(
        id: '${d['id']}',
        projectId: d['project_id'] as String? ?? '',
        storagePath: d['storage_path'] as String? ?? '',
        duration: Duration(
          milliseconds: (d['duration_ms'] as num?)?.toInt() ?? 0,
        ),
        createdAt: parseDate(d['created_at']) ?? DateTime.now(),
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

  /// A short-lived signed URL for the recording (storage policy: the parent
  /// reads own children's recordings only; the link expires in 10 minutes).
  Future<String> signedUrl(ProjectSubmission s);

  /// Parent deletes a recording (audio + record).
  Future<void> delete(String childId, ProjectSubmission s);
}

class SupabaseSubmissionsRepository implements SubmissionsRepository {
  static const _signedUrlSeconds = 10 * 60;

  bool get _signedIn {
    final u = supa.auth.currentUser;
    return u != null && !u.isAnonymous;
  }

  @override
  Stream<List<ProjectSubmission>> watch(String childId) {
    if (!_signedIn) return Stream.value(const []);
    return watchQuery(
      [Watched('submissions', column: 'child_id', value: childId)],
      () async {
        final rows = await supa
            .from('submissions')
            .select('id, project_id, storage_path, duration_ms, created_at')
            .eq('child_id', childId)
            .order('created_at', ascending: false);
        return [for (final r in rows) ProjectSubmission.fromRow(r)];
      },
    );
  }

  @override
  Future<String> signedUrl(ProjectSubmission s) => supa.storage
      .from('recordings')
      .createSignedUrl(s.storagePath, _signedUrlSeconds);

  @override
  Future<void> delete(String childId, ProjectSubmission s) async {
    // The row delete also queues the file for storage-cleanup; removing it now is immediate.
    await supa.storage.from('recordings').remove([s.storagePath]);
    await supa.from('submissions').delete().eq('id', s.id);
  }
}
