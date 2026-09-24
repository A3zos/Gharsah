import '../../../core/arabic_digits.dart';

/// `leaderboard/current` — written only by the scheduled Function. Rows are
/// rank + points ONLY: other children are never identified.
class LeaderBoard {
  const LeaderBoard({
    required this.weekKey,
    required this.total,
    required this.rows,
  });

  factory LeaderBoard.fromMap(Map<String, dynamic> m) => LeaderBoard(
    weekKey: m['weekKey'] as String? ?? '',
    total: (m['total'] as num?)?.toInt() ?? 0,
    rows: [
      for (final r in (m['rows'] as List? ?? const []))
        if (r is Map && r['rank'] is num && r['points'] is num)
          ((r['rank'] as num).toInt(), (r['points'] as num).toInt()),
    ],
  );

  final String weekKey;
  final int total;

  /// (rank, points)
  final List<(int, int)> rows;
}

/// One row as StudentHome shows it.
class BoardRow {
  const BoardRow({
    required this.rank,
    required this.points,
    required this.label,
    this.avatarId,
    this.me = false,
  });

  final int rank;
  final int points;

  /// «طالب ٣» for others; the child's own first name for [me].
  final String label;

  /// Only the child's own row has an avatar; others get one generic avatar.
  final String? avatarId;
  final bool me;
}

class BoardView {
  const BoardView(this.rows, this.note);
  final List<BoardRow> rows;

  /// «أنت ضمن أفضل ٢٠٪ هذا الأسبوع — باقي ١٥ نقطة لتلحق بطالب ٤.» (null when
  /// the child has no points yet this week).
  final String? note;
}

const _topRows = 5;

/// Builds the rows: the top 5 (anonymous), with the child's own row in place
/// if it's among them, otherwise the top 4 + the child's own row.
BoardView buildBoard({
  required LeaderBoard? board,
  required Map<String, dynamic>? own,
  required String myName,
  required String myAvatar,
}) {
  String other(int rank) => 'طالب ${rank.arabicDigits}';
  final ownThisWeek =
      own != null && board != null && own['weekKey'] == board.weekKey;
  final myRank = ownThisWeek ? (own['rank'] as num?)?.toInt() : null;
  final myPoints = ownThisWeek ? (own['points'] as num?)?.toInt() ?? 0 : 0;
  final top = board?.rows ?? const <(int, int)>[];

  final rows = <BoardRow>[
    for (final (rank, points) in top.take(_topRows))
      rank == myRank
          ? BoardRow(
              rank: rank,
              points: points,
              label: myName,
              avatarId: myAvatar,
              me: true,
            )
          : BoardRow(rank: rank, points: points, label: other(rank)),
  ];
  if (!rows.any((r) => r.me)) {
    if (rows.length >= _topRows) rows.removeLast();
    rows.add(
      BoardRow(
        rank: myRank ?? (board?.total ?? 0) + 1,
        points: myPoints,
        label: myName,
        avatarId: myAvatar,
        me: true,
      ),
    );
  }

  String? note;
  if (myRank != null) {
    final pct = (own!['topPercent'] as num?)?.toInt() ?? 100;
    final gap = (own['gapToAbove'] as num?)?.toInt();
    // REVIEW: copy adapted from the design so it names no other child.
    note = myRank == 1 || gap == null
        ? 'أنت في المركز الأول هذا الأسبوع — استمر!'
        : 'أنت ضمن أفضل ${pct.arabicDigits}٪ هذا الأسبوع — باقي ${gap.arabicDigits} نقطة لتلحق ب${other(myRank - 1)}.';
  }
  return BoardView(rows, note);
}

/// Whole days until the board resets (Saturday 00:00 Riyadh, UTC+3).
int daysUntilReset(DateTime now) {
  final riyadh = now.toUtc().add(const Duration(hours: 3));
  final sinceSat = (riyadh.weekday + 1) % 7; // sat=0 … fri=6
  final left = 7 - sinceSat;
  return left == 0 ? 7 : left;
}
