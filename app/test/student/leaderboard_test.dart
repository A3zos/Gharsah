import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/student/data/leaderboard.dart';

void main() {
  const board = LeaderBoard(
    weekKey: 'w',
    total: 25,
    rows: [(1, 420), (2, 385), (3, 340), (4, 310), (5, 295)],
  );

  test('others are anonymous: «طالب N», no avatar; only my row is named', () {
    final v = buildBoard(
      board: board,
      own: const {'weekKey': 'w', 'rank': 5, 'points': 295, 'topPercent': 20, 'gapToAbove': 15},
      myName: 'عبدالله',
      myAvatar: 'b1',
    );
    expect(v.rows.map((r) => r.label), ['طالب ١', 'طالب ٢', 'طالب ٣', 'طالب ٤', 'عبدالله']);
    expect(v.rows.where((r) => r.avatarId != null).single.me, isTrue);
    expect(v.note, 'أنت ضمن أفضل ٢٠٪ هذا الأسبوع — باقي ١٥ نقطة لتلحق بطالب ٤.');
  });

  test('outside the top 5 → top 4 + my row with my real rank', () {
    final v = buildBoard(
      board: board,
      own: const {'weekKey': 'w', 'rank': 12, 'points': 90, 'topPercent': 50, 'gapToAbove': 4},
      myName: 'سارة',
      myAvatar: 'g1',
    );
    expect(v.rows.map((r) => r.rank), [1, 2, 3, 4, 12]);
    expect(v.rows.last.me, isTrue);
    expect(v.note, contains('لتلحق بطالب ١١'));
  });

  test('first place', () {
    final v = buildBoard(
      board: board,
      own: const {'weekKey': 'w', 'rank': 1, 'points': 420, 'topPercent': 10, 'gapToAbove': null},
      myName: 'سارة',
      myAvatar: 'g1',
    );
    expect(v.rows.first.me, isTrue);
    expect(v.note, 'أنت في المركز الأول هذا الأسبوع — استمر!');
  });

  test("last week's standing or no board → my row at the end, no note", () {
    final v = buildBoard(
      board: board,
      own: const {'weekKey': 'old', 'rank': 1, 'points': 999},
      myName: 'سارة',
      myAvatar: 'g1',
    );
    expect(v.rows.last.me, isTrue);
    expect(v.rows.last.points, 0);
    expect(v.note, isNull);
    final empty = buildBoard(board: null, own: null, myName: 'سارة', myAvatar: 'g1');
    expect(empty.rows.single.me, isTrue);
  });

  test('countdown to Saturday 00:00 Riyadh', () {
    expect(daysUntilReset(DateTime.utc(2026, 9, 24, 12)), 2); // Thu 15:00 Riyadh
    expect(daysUntilReset(DateTime.utc(2026, 9, 25, 21, 30)), 7); // Sat 00:30 Riyadh
    expect(daysUntilReset(DateTime.utc(2026, 9, 25, 20)), 1); // Fri 23:00 Riyadh
  });
}
