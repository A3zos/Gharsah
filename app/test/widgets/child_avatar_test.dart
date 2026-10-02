import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/widgets/child_avatar.dart';

void main() {
  test('four per gender', () {
    expect(AvatarStyle.forGender(girl: false).map((a) => a.key), [
      'boy-1',
      'boy-2',
      'boy-3',
      'boy-4',
    ]);
    expect(AvatarStyle.forGender(girl: true).map((a) => a.key), [
      'girl-1',
      'girl-2',
      'girl-3',
      'girl-4',
    ]);
  });

  test('old avatars map to the closest new one (the database rule)', () {
    expect(AvatarStyle.keyFor('g3', girl: true), 'girl-3');
    expect(AvatarStyle.keyFor('g5', girl: true), 'girl-1');
    expect(AvatarStyle.keyFor('b3', girl: false), 'boy-2');
    expect(AvatarStyle.keyFor('girl-2', girl: false), 'boy-1');
    expect(AvatarStyle.keyFor(null, girl: true), 'girl-1');
  });

  test('the 256 px file for anything ≤ 64 px', () {
    final a = AvatarStyle.byKey('boy-4')!;
    expect(a.asset(38), 'assets/avatars/child-boy-4-256.webp');
    expect(a.asset(74), 'assets/avatars/child-boy-4.webp');
    expect(AvatarStyle.byKey('neutral'), isNull);
  });
}
