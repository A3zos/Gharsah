import '../../../core/arabic_digits.dart';

/// One of the top-5 rows from `get_leaderboard()`: rank + points only — other
/// children are never identified (no id, name, age or avatar).
class BoardEntry {
  const BoardEntry({
    required this.rank,
    required this.points,
    this.me = false,
    this.avatar,
  });

  final int rank;
  final int points;

  /// The row's chosen avatar key — never a name or id.
  final String? avatar;

  /// This row is the child's own.
  final bool me;
}

/// This child's own standing.
class BoardStanding {
  const BoardStanding({
    required this.rank,
    required this.points,
    this.gapToAbove,
    this.inTop5 = false,
  });

  final int rank;
  final int points;

  /// Points to the next higher rank (null in first place).
  final int? gapToAbove;
  final bool inTop5;
}

/// The weekly board from `get_leaderboard()` (live; dense ranks, ties share a
/// rank; resets Saturday 00:00 Riyadh). Mirrors web/src/data/student.ts.
class LeaderBoard {
  const LeaderBoard({
    required this.weekKey,
    required this.total,
    required this.top,
    this.me,
  });

  /// Accepts the current payload `{weekKey, total, top[], me{}}` and the
  /// previous one `{weekKey, total, rows[{rank, stars, me}], own{rank, stars,
  /// gapToAbove}}`, so the app works whichever the server runs.
  factory LeaderBoard.fromRpc(Map<dynamic, dynamic> d) {
    int? i(Object? v) => v is num ? v.toInt() : null;
    final isNew = d['top'] is List;
    final pointsKey = isNew ? 'points' : 'stars';
    final rawRows = (isNew ? d['top'] : d['rows']) as List? ?? const [];
    final top = <BoardEntry>[
      for (final r in rawRows)
        if (r is Map && r['rank'] is num && r[pointsKey] is num)
          BoardEntry(
            rank: i(r['rank'])!,
            points: i(r[pointsKey])!,
            me: r['me'] == true,
            avatar: r['avatar'] is String ? r['avatar'] as String : null,
          ),
    ].take(_topRows).toList();
    final m = isNew ? d['me'] : d['own'];
    BoardStanding? me;
    if (m is Map && m['rank'] is num) {
      me = BoardStanding(
        rank: i(m['rank'])!,
        points: i(m[pointsKey]) ?? 0,
        gapToAbove: i(m['gapToAbove']),
        inTop5: isNew ? m['inTop5'] == true : top.any((r) => r.me),
      );
    }
    return LeaderBoard(
      weekKey: '${d['weekKey'] ?? ''}',
      total: i(d['total']) ?? 0,
      top: top,
      me: me,
    );
  }

  final String weekKey;
  final int total;

  /// Ranks 1–5 as the server gives them (≤ 5 rows).
  final List<BoardEntry> top;

  /// This child's own standing (always present for a paired device).
  final BoardStanding? me;
}

/// One row as StudentHome shows it.
class BoardRow {
  const BoardRow({
    required this.rank,
    required this.points,
    this.label,
    this.avatarId,
    this.me = false,
  });

  final int rank;
  final int points;

  /// Only the child's own row has a label (its first name); other rows show
  /// rank + their avatar + points only.
  final String? label;

  /// The row's avatar key (others: their chosen one; unknown → neutral).
  final String? avatarId;
  final bool me;
}

class BoardView {
  const BoardView(this.rows, this.note, {this.own, this.separator = false});

  /// The top-5 rows (the child's own row in place when it is among them).
  final List<BoardRow> rows;

  /// The child's own row below the top 5 (null when it is among them).
  final BoardRow? own;

  /// Show «⋯» between the five rows and [own].
  final bool separator;

  /// The motivation line (null when nobody has stars yet this week).
  final String? note;
}

const _topRows = 5;

/// «نجمة واحدة» / «نجمتان» / «٣ نجوم» / «١١ نجمة»
String starsPhrase(int n) {
  if (n == 1) return 'نجمة واحدة';
  if (n == 2) return 'نجمتان';
  if (n >= 3 && n <= 10) return '${n.arabicDigits} نجوم';
  return '${n.arabicDigits} نجمة';
}

/// Ranks 1–5 with the child's own row in place — or, when the child isn't in
/// the top 5, the five rows, a «⋯» separator, then the child's own row with the
/// real rank. The note motivates with the gap to the rank above.
BoardView buildBoard({
  required LeaderBoard? board,
  required String myName,
  required String myAvatar,
}) {
  final me = board?.me;
  final rows = <BoardRow>[
    for (final r in (board?.top ?? const <BoardEntry>[]).take(_topRows))
      r.me
          ? BoardRow(
              rank: r.rank,
              points: r.points,
              label: myName,
              avatarId: myAvatar,
              me: true,
            )
          : BoardRow(rank: r.rank, points: r.points, avatarId: r.avatar),
  ];
  final own = me != null && !rows.any((r) => r.me)
      ? BoardRow(
          rank: me.rank,
          points: me.points,
          label: myName,
          avatarId: myAvatar,
          me: true,
        )
      : null;
  String? note;
  if (me != null && (me.points > 0 || (board?.total ?? 0) > 0)) {
    // To pass the rank above: one star more than the gap (a tie shares it).
    final gap = me.gapToAbove;
    note = me.rank == 1 || gap == null
        ? 'أنت في المركز الأول هذا الأسبوع — استمر!'
        : 'باقي لك ${starsPhrase(gap + 1)} وتسبق المركز ${(me.rank - 1).arabicDigits}';
  }
  return BoardView(
    rows,
    note,
    own: own,
    separator: own != null && rows.length >= _topRows,
  );
}

/// Whole days until the board resets (Saturday 00:00 Riyadh, UTC+3).
int daysUntilReset(DateTime now) {
  final riyadh = now.toUtc().add(const Duration(hours: 3));
  final sinceSat = (riyadh.weekday + 1) % 7; // sat=0 … fri=6
  final left = 7 - sinceSat;
  return left == 0 ? 7 : left;
}
