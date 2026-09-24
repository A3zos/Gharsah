import 'dart:math';

import 'package:flutter/foundation.dart';

enum PairingResult { verified, wrong }

/// Issues and verifies the 6-digit pairing codes. The server is the source of
/// truth (CLAUDE.md §2): the real implementation is a Cloud Function that
/// issues one-time codes tied to a child profile and, on the child device,
/// verifies them and returns a session token + profile. Never verify locally.
abstract interface class PairingRepository {
  /// A new 6-digit code (Latin digits) for [childId].
  Future<String> issueCode(String childId);

  /// [code] is 6 Latin digits (the UI converts from Arabic-Indic before calling).
  Future<PairingResult> verifyCode(String code);
}

/// MOCK — chosen by the product owner until the Firebase Blaze plan is enabled.
///
/// TODO(phase-c): replace with a Cloud Function (callable) that issues
/// unique one-time codes server-side and verifies them for the child app.
/// This mock generates codes on the device, does not guarantee uniqueness,
/// and stores nothing itself (the code is saved on the child document,
/// marked `provider: 'mock'`).
class MockPairingRepository implements PairingRepository {
  MockPairingRepository({Random? random}) : _random = random ?? Random.secure();

  final Random _random;

  static const String _debugDemoCode = '472918';

  @override
  Future<String> issueCode(String childId) async =>
      List.generate(6, (_) => _random.nextInt(10)).join();

  /// Debug builds accept the design's demo code ٤٧٢٩١٨ so the child tab's
  /// states can be exercised; every other code (and everything in release)
  /// is "wrong". Creates no account.
  @override
  Future<PairingResult> verifyCode(String code) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return kDebugMode && code == _debugDemoCode
        ? PairingResult.verified
        : PairingResult.wrong;
  }
}
