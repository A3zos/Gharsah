import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/student/data/child_session.dart';

// Review notes A2 — same mapping as web/src/data/childSession.test.ts.
void main() {
  test('wrong or expired code', () {
    expect(claimErrorOf('not-found', 'wrong-code'), ClaimError.wrong);
    expect(claimErrorOf('invalid-argument', 'bad-code'), ClaimError.wrong);
  });
  test('callable not reachable (not deployed) is unavailable, not wrong', () {
    expect(claimErrorOf('not-found', 'NOT_FOUND'), ClaimError.unavailable);
  });
  test('anonymous auth disabled / internal / unavailable', () {
    expect(
      claimErrorOf('admin-restricted-operation', null),
      ClaimError.unavailable,
    );
    expect(claimErrorOf('internal', 'INTERNAL'), ClaimError.unavailable);
    expect(claimErrorOf('unavailable', null), ClaimError.unavailable);
  });
  test('network', () {
    expect(claimErrorOf('network-request-failed', null), ClaimError.offline);
  });
  test('too many attempts', () {
    expect(
      claimErrorOf('resource-exhausted', 'too-many-attempts'),
      ClaimError.tooManyAttempts,
    );
  });
}
