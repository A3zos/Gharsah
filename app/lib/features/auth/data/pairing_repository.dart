import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';

import '../../children/data/child_profile.dart';
import 'auth_failure.dart';

enum PairingResult { verified, wrong }

/// Pairing codes. The server is the source of truth (CLAUDE.md §2): codes are
/// issued, revoked and claimed only by Cloud Functions; clients can never
/// read or list `pairingCodes` (firestore.rules).
abstract interface class PairingRepository {
  /// Parent: the child's valid code, or a freshly issued one (24 h).
  /// Throws [AuthFailure] with an Arabic message.
  Future<PairingInfo> issueCode(String childId);

  /// Parent (frame 11 «إصدار رمز جديد»): the old code dies, the linked child
  /// device is unlinked, and a new code is issued.
  Future<PairingInfo> revokeAndReissue(String childId);

  /// Child device: [code] is 6 Latin digits (the UI converts from Arabic-Indic).
  Future<PairingResult> verifyCode(String code);
}

/// Calls the `createPairingCode` / `revokePairingCode` callables (us-central1).
class FunctionsPairingRepository implements PairingRepository {
  FunctionsPairingRepository({FirebaseFunctions? functions})
    : _fn = functions ?? FirebaseFunctions.instanceFor(region: 'us-central1');

  final FirebaseFunctions _fn;

  Future<PairingInfo> _call(String name, String childId) async {
    try {
      final r = await _fn.httpsCallable(name).call<Map<Object?, Object?>>({
        'childId': childId,
      });
      final data = r.data;
      return PairingInfo(
        code: data['code']! as String,
        expiresAt: DateTime.fromMillisecondsSinceEpoch(
          (data['expiresAt']! as num).toInt(),
        ),
        status: 'active',
      );
    } on FirebaseFunctionsException catch (e) {
      throw pairingFailure(e.code, e.message);
    }
  }

  @override
  Future<PairingInfo> issueCode(String childId) =>
      _call('createPairingCode', childId);

  @override
  Future<PairingInfo> revokeAndReissue(String childId) =>
      _call('revokePairingCode', childId);

  /// TODO(phase-4): anonymous sign-in + the `claimPairingCode` Function.
  /// Until then only the design's demo code works, in debug builds.
  @override
  Future<PairingResult> verifyCode(String code) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return kDebugMode && code == '472918'
        ? PairingResult.verified
        : PairingResult.wrong;
  }
}

/// Arabic messages for the pairing Functions' errors.
AuthFailure pairingFailure(String code, [String? message]) =>
    switch ((code, message)) {
      ('failed-precondition', 'no-active-subscription') => AuthFailure(
        'فعّل اشتراكك أولًا لإصدار رمز الربط.',
        code: code,
      ),
      ('not-found', _) => AuthFailure('لم نجد بيانات هذا الابن.', code: code),
      ('resource-exhausted', _) => AuthFailure(
        'تعذّر إصدار رمز الآن — حاول بعد قليل.',
        code: code,
      ),
      _ => AuthFailure.fromCode(code == 'internal' ? 'unavailable' : code),
    };

/// Maps a Firestore failure too (used when saving the child first).
AuthFailure firestoreFailure(FirebaseException e) =>
    AuthFailure.fromCode(e.code);
