import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/student/data/child_session.dart';

// Review notes A2 — same mapping as web/src/data/childSession.test.ts
// (Supabase edge function codes).
void main() {
  test('a wrong, expired, used or malformed code', () {
    expect(claimErrorOf('wrong-code'), ClaimError.wrong);
    expect(claimErrorOf('bad-code'), ClaimError.wrong);
  });
  test(
    'function not reachable / anonymous sign-ins off / internal → unavailable',
    () {
      expect(claimErrorOf('unavailable'), ClaimError.unavailable);
      expect(claimErrorOf('internal'), ClaimError.unavailable);
      expect(claimErrorOf('unauthenticated'), ClaimError.unavailable);
    },
  );
  test('network problems → offline', () {
    expect(claimErrorOf('network'), ClaimError.offline);
    expect(claimErrorOf('internal', online: false), ClaimError.offline);
  });
  test('too many attempts', () {
    expect(claimErrorOf('too-many-attempts'), ClaimError.tooManyAttempts);
  });
}
