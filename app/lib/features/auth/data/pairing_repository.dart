import '../../../core/supa.dart';
import '../../children/data/child_profile.dart';
import 'auth_failure.dart';

/// Pairing codes, parent side. The server is the source of truth (CLAUDE.md
/// §2): codes are issued, revoked and claimed only by Edge Functions; clients
/// can never read `pairing_codes`. The child device claims a code via
/// `ChildSessionRepository`.
abstract interface class PairingRepository {
  /// Parent: the child's valid code, or a freshly issued one (10 minutes,
  /// single use). Throws [AuthFailure] with an Arabic message.
  Future<PairingInfo> issueCode(String childId);

  /// Parent (frame 11 «إصدار رمز جديد»): the old code dies, the paired child
  /// device is unpaired, and a new code is issued.
  Future<PairingInfo> revokeAndReissue(String childId);
}

/// Calls the `create-pairing-code` / `revoke-pairing-code` Edge Functions.
class FunctionsPairingRepository implements PairingRepository {
  Future<PairingInfo> _call(String name, String childId) async {
    try {
      final d = await callFunction(name, {'childId': childId});
      return PairingInfo(
        code: d['code']! as String,
        expiresAt: parseDate(d['expiresAt']) ?? DateTime.now(),
        status: 'active',
      );
    } on FunctionCallError catch (e) {
      throw pairingFailure(e.code);
    }
  }

  @override
  Future<PairingInfo> issueCode(String childId) =>
      _call('create-pairing-code', childId);

  @override
  Future<PairingInfo> revokeAndReissue(String childId) =>
      _call('revoke-pairing-code', childId);
}

/// Arabic messages for the pairing functions' errors (same as the web).
AuthFailure pairingFailure(String code) => switch (code) {
  'no-active-subscription' => AuthFailure(
    'فعّل اشتراكك أولًا لإصدار رمز الربط.',
    code: code,
  ),
  'child-not-found' => AuthFailure('لم نجد بيانات هذا الابن.', code: code),
  'no-free-code' => AuthFailure(
    'تعذّر إصدار رمز الآن — حاول بعد قليل.',
    code: code,
  ),
  'network' => AuthFailure.fromCode('network-request-failed'),
  _ => AuthFailure.fromCode('unavailable'),
};
