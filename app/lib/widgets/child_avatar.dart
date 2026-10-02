import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../theme/app_theme.dart';

/// The child avatars: transparent head-and-shoulders portraits in
/// assets/avatars/child-{boy,girl}-{1..4}.webp (a -256 copy for anything
/// ≤ 64 px). Four per gender; the choice is stored as its key in
/// children.avatar ('boy-3', 'girl-1' …). Same keys as
/// web/src/content/avatars.ts and the database trigger
/// (supabase/migrations/20261003120000_child_avatars.sql).
class AvatarStyle {
  const AvatarStyle(this.key, this.girl, this.label);

  /// children.avatar
  final String key;
  final bool girl;
  final String label;

  static const all = [
    AvatarStyle('boy-1', false, 'فتى بغترة بيضاء'),
    AvatarStyle('boy-2', false, 'فتى بطاقية'),
    AvatarStyle('boy-3', false, 'فتى بنظارة'),
    AvatarStyle('boy-4', false, 'فتى بشماغ أحمر'),
    AvatarStyle('girl-1', true, 'فتاة بحجاب وردي'),
    AvatarStyle('girl-2', true, 'فتاة بحجاب أزرق ونظارة'),
    AvatarStyle('girl-3', true, 'فتاة بحجاب نعناعي ونظارة'),
    AvatarStyle('girl-4', true, 'فتاة بحجاب خردلي'),
  ];

  /// The four choices of one gender («شخصية الابن»).
  static List<AvatarStyle> forGender({required bool girl}) =>
      all.where((a) => a.girl == girl).toList();

  static String defaultKey({required bool girl}) => girl ? 'girl-1' : 'boy-1';

  /// The old drawn avatars → the closest new one.
  static const _legacy = {
    'g1': 'girl-1',
    'g2': 'girl-2',
    'g3': 'girl-3',
    'g4': 'girl-4',
    'g5': 'girl-1',
    'b1': 'boy-1',
    'b2': 'boy-4',
    'b3': 'boy-2',
    'b4': 'boy-3',
  };

  /// A stored value → a key of the child's gender (the database's rule).
  static String keyFor(String? stored, {required bool girl}) {
    final k = _legacy[stored] ?? stored;
    return all.any((a) => a.key == k && a.girl == girl)
        ? k!
        : defaultKey(girl: girl);
  }

  /// null = unknown ('neutral' from an older board).
  static AvatarStyle? byKey(String key) {
    final k = _legacy[key] ?? key;
    for (final a in all) {
      if (a.key == k) return a;
    }
    return null;
  }

  String asset(double size) =>
      'assets/avatars/child-$key${size <= 64 ? '-256' : ''}.webp';
}

/// A child's avatar by key. [circle] = on its circle (mint for boys, pink for
/// girls); off = the picker grid. [radius] reshapes the circle into a rounded
/// square. An unknown key → a neutral silhouette.
class ChildAvatar extends StatelessWidget {
  const ChildAvatar(
    this.id, {
    super.key,
    this.size = AppSizes.avatar,
    this.circle = true,
    this.radius,
  });

  final String id;
  final double size;
  final bool circle;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final a = AvatarStyle.byKey(id);
    if (a == null) {
      return ExcludeSemantics(
        child: SvgPicture.string(_neutral, width: size, height: size),
      );
    }
    final image = Image.asset(
      a.asset(size),
      width: size,
      height: size,
      fit: BoxFit.contain,
      alignment: Alignment.bottomCenter,
      excludeFromSemantics: true,
    );
    if (!circle) return SizedBox.square(dimension: size, child: image);
    return SizedBox.square(
      dimension: size,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius ?? size / 2),
        child: ColoredBox(
          color: a.girl ? AppColors.berryTint : AppColors.greenTint,
          child: image,
        ),
      ),
    );
  }
}

String _hex(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

final _neutral =
    '''
<svg viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="32" fill="${_hex(AppColors.borderSoft)}"/>
  <circle cx="32" cy="26" r="10" fill="${_hex(AppColors.stageOffStem)}"/>
  <path d="M14 54 C14 43 22 38 32 38 C42 38 50 43 50 54 Z" fill="${_hex(AppColors.stageOffStem)}"/>
</svg>''';
