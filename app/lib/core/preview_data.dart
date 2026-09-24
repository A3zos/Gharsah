import 'dart:typed_data';

import '../features/auth/data/pairing_repository.dart';
import '../features/children/data/child_profile.dart';
import '../features/children/data/children_repository.dart';
import '../features/dashboard/data/submissions_repository.dart';
import 'mock_data.dart';

// Debug design-comparison previews only (`?screen=…` on a debug/profile web
// build, see lib/core/debug_preview.dart). Never used in a release build.

class PreviewChildrenRepository implements ChildrenRepository {
  @override
  Stream<List<ChildProfile>> watchChildren() => Stream.value(MockData.children);

  @override
  Stream<ChildProfile?> watchChild(String childId) => Stream.value(
    MockData.children.firstWhere(
      (c) => c.id == childId,
      orElse: () => MockData.children.first,
    ),
  );

  @override
  Future<ChildProfile> addChild(ChildDraft draft) async =>
      MockData.children.first;
}

class PreviewPairingRepository implements PairingRepository {
  @override
  Future<PairingInfo> issueCode(String childId) async =>
      MockData.children.first.pairing!;

  @override
  Future<PairingInfo> revokeAndReissue(String childId) async =>
      MockData.children.first.pairing!;
}

class PreviewSubmissionsRepository implements SubmissionsRepository {
  @override
  Stream<List<ProjectSubmission>> watch(String childId) =>
      Stream.value(const []);

  @override
  Future<Uint8List> loadAudio(ProjectSubmission s) async => Uint8List(0);

  @override
  Future<void> delete(String childId, ProjectSubmission s) async {}
}
