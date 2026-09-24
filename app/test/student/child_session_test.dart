import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/student/data/child_session.dart';

void main() {
  test('cached session round-trips and holds no personal data beyond the first name', () {
    const s = ChildSession(
      deviceUid: 'dev1',
      parentUid: 'p1',
      childId: 'c1',
      name: 'سارة',
      avatar: 'g2',
      gender: 'girl',
    );
    final json = s.toJson();
    expect(json.keys.toSet(), {
      'deviceUid',
      'parentUid',
      'childId',
      'name',
      'avatar',
      'gender',
    });
    final back = ChildSession.fromJson(json);
    expect(
      [
        back.deviceUid,
        back.parentUid,
        back.childId,
        back.name,
        back.avatar,
        back.gender,
      ],
      ['dev1', 'p1', 'c1', 'سارة', 'g2', 'girl'],
    );
  });
}
