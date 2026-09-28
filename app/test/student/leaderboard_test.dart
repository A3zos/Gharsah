import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/student/data/leaderboard.dart';

// Mirrors web/src/components/child/Leaderboard.test.tsx.
void main() {
  List<BoardEntry> top({int? me}) => [
    for (final (i, (rank, points)) in const [
      (1, 30),
      (1, 30),
      (2, 29),
      (3, 28),
      (4, 27),
    ].indexed)
      BoardEntry(rank: rank, points: points, me: i == me),
  ];

  test(
    'in the top 5: the own row in place, no separator; others unlabelled',
    () {
      final v = buildBoard(
        board: LeaderBoard(
          weekKey: 'w',
          total: 22,
          top: top(me: 2),
          me: const BoardStanding(
            rank: 2,
            points: 29,
            gapToAbove: 1,
            inTop5: true,
          ),
        ),
        myName: 'بدر',
        myAvatar: 'b1',
      );
      expect(v.rows, hasLength(5));
      expect(v.rows[2].me, isTrue);
      expect(v.rows[2].label, 'بدر');
      expect(v.own, isNull);
      expect(v.separator, isFalse);
      // Other children: rank + neutral avatar + points only.
      for (final r in v.rows.where((r) => !r.me)) {
        expect(r.label, isNull);
        expect(r.avatarId, isNull);
      }
      expect(v.rows.map((r) => r.rank), [1, 1, 2, 3, 4]); // ties share a rank
      expect(v.note, 'باقي لك نجمتان وتسبق المركز ١');
    },
  );

  test('outside the top 5: five rows, «⋯», then the own row with rank 20', () {
    final v = buildBoard(
      board: LeaderBoard(
        weekKey: 'w',
        total: 22,
        top: top(),
        me: const BoardStanding(rank: 20, points: 4, gapToAbove: 8),
      ),
      myName: 'بدر',
      myAvatar: 'b1',
    );
    expect(v.rows, hasLength(5));
    expect(v.rows.any((r) => r.me), isFalse);
    expect(v.separator, isTrue);
    expect(v.own!.me, isTrue);
    expect(v.own!.rank, 20);
    expect(v.own!.points, 4);
    expect(v.own!.label, 'بدر');
    expect(v.own!.avatarId, 'b1');
    expect(v.note, 'باقي لك ٩ نجوم وتسبق المركز ١٩');
  });

  test('first place', () {
    final v = buildBoard(
      board: LeaderBoard(
        weekKey: 'w',
        total: 3,
        top: top(me: 0).take(3).toList(),
        me: const BoardStanding(rank: 1, points: 30, inTop5: true),
      ),
      myName: 'بدر',
      myAvatar: 'b1',
    );
    expect(v.rows.first.me, isTrue);
    expect(v.note, 'أنت في المركز الأول هذا الأسبوع — استمر!');
  });

  test('no stars at all this week → no note; no board → nothing', () {
    final v = buildBoard(
      board: const LeaderBoard(
        weekKey: 'w',
        total: 0,
        top: [],
        me: BoardStanding(rank: 1, points: 0),
      ),
      myName: 'بدر',
      myAvatar: 'b1',
    );
    expect(v.note, isNull);
    final empty = buildBoard(board: null, myName: 'بدر', myAvatar: 'b1');
    expect(empty.rows, isEmpty);
    expect(empty.own, isNull);
  });

  test('stars phrase', () {
    expect(starsPhrase(1), 'نجمة واحدة');
    expect(starsPhrase(2), 'نجمتان');
    expect(starsPhrase(9), '٩ نجوم');
    expect(starsPhrase(11), '١١ نجمة');
  });

  test('parses the new payload', () {
    final b = LeaderBoard.fromRpc({
      'weekKey': '2026-09-26',
      'total': 22,
      'top': [
        {'rank': 1, 'points': 30, 'avatar': 'neutral', 'me': false},
        {'rank': 1, 'points': 30, 'avatar': 'b2', 'me': true},
      ],
      'me': {
        'rank': 1,
        'points': 30,
        'inTop5': true,
        'gapToAbove': null,
        'firstName': 'بدر',
        'avatar': 'b2',
      },
    });
    expect(b.total, 22);
    expect(b.top.map((r) => (r.rank, r.points, r.me)), [
      (1, 30, false),
      (1, 30, true),
    ]);
    expect(b.me!.inTop5, isTrue);
    expect(b.me!.gapToAbove, isNull);
  });

  test('parses the previous payload (rows/own with stars)', () {
    final b = LeaderBoard.fromRpc({
      'weekKey': '2026-09-26',
      'total': 25,
      'rows': [
        {'rank': 1, 'stars': 42, 'me': false},
        {'rank': 2, 'stars': 38, 'me': true, 'firstName': 'بدر'},
      ],
      'own': {
        'rank': 2,
        'stars': 38,
        'total': 25,
        'topPercent': 10,
        'gapToAbove': 4,
      },
    });
    expect(b.top.map((r) => (r.rank, r.points, r.me)), [
      (1, 42, false),
      (2, 38, true),
    ]);
    expect(b.me!.rank, 2);
    expect(b.me!.points, 38);
    expect(b.me!.gapToAbove, 4);
    expect(b.me!.inTop5, isTrue);
  });

  test('countdown to Saturday 00:00 Riyadh', () {
    expect(
      daysUntilReset(DateTime.utc(2026, 9, 24, 12)),
      2,
    ); // Thu 15:00 Riyadh
    expect(
      daysUntilReset(DateTime.utc(2026, 9, 25, 21, 30)),
      7,
    ); // Sat 00:30 Riyadh
    expect(
      daysUntilReset(DateTime.utc(2026, 9, 25, 20)),
      1,
    ); // Fri 23:00 Riyadh
  });
}
