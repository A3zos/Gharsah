import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../theme/app_theme.dart';

String _hex(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// Icons and illustrations from the approved design, drawn from the design's own
/// SVG paths so they match the mockup. Colors always come from [AppColors].
class AppIcon extends StatelessWidget {
  const AppIcon._(this._svg, this.size, {this.semanticLabel}) : height = size;
  const AppIcon._sized(this._svg, this.size, this.height)
    : semanticLabel = null;

  final String _svg;
  final double size;
  final double height;
  final String? semanticLabel;

  /// The sprout-in-a-circle brand mark (splash, auth, child tab).
  factory AppIcon.logo({required double size}) => AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <circle cx="38" cy="38" r="36" fill="${_hex(AppColors.greenTint)}"/>
  <path d="M38 60 V34" stroke="${_hex(AppColors.deepGreen)}" stroke-width="4" stroke-linecap="round"/>
  <path d="M38 40 C28 40 22 34 22 26 C32 26 38 32 38 40 Z" fill="${_hex(AppColors.primary)}"/>
  <path d="M38 45 C48 45 54 39 54 31 C44 31 38 37 38 45 Z" fill="${_hex(AppColors.softGreen)}"/>
  <circle cx="38" cy="62" r="4" fill="${_hex(AppColors.gold)}"/>
</svg>''', size);

  /// Larger-leaf variant used on the child tab (03-Login).
  factory AppIcon.logoChild({required double size}) => AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <circle cx="38" cy="38" r="36" fill="${_hex(AppColors.greenTint)}"/>
  <path d="M38 60 V34" stroke="${_hex(AppColors.deepGreen)}" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M38 41 C27 41 21 35 21 26 C32 26 38 32 38 41 Z" fill="${_hex(AppColors.primary)}"/>
  <path d="M38 46 C49 46 55 40 55 31 C44 31 38 37 38 46 Z" fill="${_hex(AppColors.softGreen)}"/>
  <circle cx="38" cy="62" r="4" fill="${_hex(AppColors.gold)}"/>
</svg>''', size);

  factory AppIcon.seed({required double size}) => AppIcon._('''
<svg viewBox="0 0 40 40" fill="none">
  <ellipse cx="20" cy="20" rx="9" ry="13" fill="${_hex(AppColors.gold)}"/>
  <path d="M20 9 C25 14 25 26 20 31 C15 26 15 14 20 9 Z" fill="${_hex(AppColors.seedGold)}"/>
</svg>''', size);

  factory AppIcon.sprout({required double size, bool reached = true}) {
    final stem = reached ? AppColors.deepGreen : AppColors.stageOffStem;
    final c1 = reached ? AppColors.primary : AppColors.stageOffLeaf;
    final c2 = reached ? AppColors.softGreen : AppColors.stageOffLeafLight;
    return AppIcon._('''
<svg viewBox="0 0 40 40" fill="none">
  <path d="M20 33 V17" stroke="${_hex(stem)}" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M20 25 C12 25 7 20 7 13 C15 13 20 18 20 25 Z" fill="${_hex(c1)}"/>
  <path d="M20 21 C28 21 33 16 33 9 C25 9 20 14 20 21 Z" fill="${_hex(c2)}"/>
</svg>''', size);
  }

  factory AppIcon.tree({required double size, bool reached = true}) {
    final stem = reached ? AppColors.deepGreen : AppColors.stageOffStem;
    final c1 = reached ? AppColors.primary : AppColors.stageOffLeaf;
    final c2 = reached ? AppColors.softGreen : AppColors.stageOffLeafLight;
    final gold = reached ? AppColors.gold : AppColors.borderStrong;
    return AppIcon._('''
<svg viewBox="0 0 40 40" fill="none">
  <path d="M20 35 V21" stroke="${_hex(stem)}" stroke-width="3.6" stroke-linecap="round"/>
  <circle cx="20" cy="13" r="9.5" fill="${_hex(c1)}"/>
  <circle cx="10.5" cy="19.5" r="6.5" fill="${_hex(c2)}"/>
  <circle cx="29.5" cy="19.5" r="6.5" fill="${_hex(c2)}"/>
  <circle cx="15" cy="9" r="2.6" fill="${_hex(gold)}"/>
  <circle cx="27" cy="16" r="2.4" fill="${_hex(gold)}"/>
</svg>''', size);
  }

  /// Back chevron. Points right, which is "back" in RTL.
  factory AppIcon.back({double size = AppSizes.iconLg}) => AppIcon._(
    '''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M9 5 L16 12 L9 19" stroke="${_hex(AppColors.textDark)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''',
    size,
    semanticLabel: 'رجوع',
  );

  factory AppIcon.eye({required bool slashed, double size = AppSizes.iconLg}) =>
      AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M2.5 12 C5 7.5 8.5 5.5 12 5.5 C15.5 5.5 19 7.5 21.5 12 C19 16.5 15.5 18.5 12 18.5 C8.5 18.5 5 16.5 2.5 12 Z" stroke="${_hex(AppColors.textMuted)}" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="12" cy="12" r="3.2" stroke="${_hex(AppColors.textMuted)}" stroke-width="1.8"/>
  ${slashed ? '<path d="M4.5 19.5 L19.5 4.5" stroke="${_hex(AppColors.textMuted)}" stroke-width="1.8" stroke-linecap="round"/>' : ''}
</svg>''', size);

  factory AppIcon.person({required Color color, double size = 19}) =>
      AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="8" r="4" stroke="${_hex(color)}" stroke-width="1.9"/>
  <path d="M4.5 20 C4.5 15.8 7.9 13.5 12 13.5 C16.1 13.5 19.5 15.8 19.5 20" stroke="${_hex(color)}" stroke-width="1.9" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.sproutMono({required Color color, double size = 19}) =>
      AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <path d="M38 62 V34" stroke="${_hex(color)}" stroke-width="7" stroke-linecap="round"/>
  <path d="M38 42 C28 42 22 36 22 27 C32 27 38 33 38 42 Z" fill="${_hex(color)}"/>
  <path d="M38 47 C48 47 54 41 54 32 C44 32 38 38 38 47 Z" fill="${_hex(color)}" opacity="0.55"/>
</svg>''', size);

  factory AppIcon.shieldCheck({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 3.5 L19.5 6.5 V12 C19.5 16.2 16.4 19.4 12 20.5 C7.6 19.4 4.5 16.2 4.5 12 V6.5 Z" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9 12 L11.2 14.2 L15 10.2" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  factory AppIcon.info({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="9.5" stroke="${_hex(AppColors.warningText)}" stroke-width="1.8"/>
  <path d="M12 11 V16.5" stroke="${_hex(AppColors.warningText)}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="7.8" r="1.3" fill="${_hex(AppColors.warningText)}"/>
</svg>''', size);

  /// Green (i) — AddChild note (07).
  factory AppIcon.infoGreen({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="9.5" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.8"/>
  <path d="M12 11 V16.5" stroke="${_hex(AppColors.deepGreen)}" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="7.8" r="1.3" fill="${_hex(AppColors.deepGreen)}"/>
</svg>''', size);

  factory AppIcon.alertCircle({double size = AppSizes.iconSm}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="9.5" stroke="${_hex(AppColors.errorText)}" stroke-width="1.9"/>
  <path d="M12 7.5 V13" stroke="${_hex(AppColors.errorText)}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="12" cy="16.6" r="1.4" fill="${_hex(AppColors.errorText)}"/>
</svg>''', size);

  factory AppIcon.checkCircle({double size = AppSizes.iconSm}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="9.5" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9"/>
  <path d="M7.8 12.4 L10.8 15.4 L16.2 9.4" stroke="${_hex(AppColors.deepGreen)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  /// White check inside the green "valid" badge.
  factory AppIcon.check({double size = 14}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M5 12.5 L10 17.5 L19 7" stroke="${_hex(AppColors.surface)}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  /// "!" inside the berry "error" badge.
  factory AppIcon.exclaim({double size = 14}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 6 V13.5" stroke="${_hex(AppColors.errorText)}" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="12" cy="18" r="1.6" fill="${_hex(AppColors.errorText)}"/>
</svg>''', size);

  /// Header mark (05-Packages): sprout without the seed dot, thicker stem.
  factory AppIcon.logoSmall({double size = AppSizes.headerLogo}) =>
      AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <circle cx="38" cy="38" r="36" fill="${_hex(AppColors.greenTint)}"/>
  <path d="M38 60 V34" stroke="${_hex(AppColors.deepGreen)}" stroke-width="5" stroke-linecap="round"/>
  <path d="M38 40 C28 40 22 34 22 26 C32 26 38 32 38 40 Z" fill="${_hex(AppColors.primary)}"/>
  <path d="M38 45 C48 45 54 39 54 31 C44 31 38 37 38 45 Z" fill="${_hex(AppColors.softGreen)}"/>
</svg>''', size);

  factory AppIcon.settings({double size = AppSizes.iconLg}) => AppIcon._(
    '''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="3.2" stroke="${_hex(AppColors.textDark)}" stroke-width="1.8"/>
  <path d="M12 3 V5.5 M12 18.5 V21 M21 12 H18.5 M5.5 12 H3 M18.4 5.6 L16.6 7.4 M7.4 16.6 L5.6 18.4 M18.4 18.4 L16.6 16.6 M7.4 7.4 L5.6 5.6" stroke="${_hex(AppColors.textDark)}" stroke-width="1.8" stroke-linecap="round"/>
</svg>''',
    size,
    semanticLabel: 'الإعدادات',
  );

  /// ✓ in a tinted circle — plan feature bullets.
  factory AppIcon.featureCheck({double size = AppSizes.iconXs}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="11" fill="${_hex(AppColors.greenTint)}"/>
  <path d="M7 12.5 L10.5 16 L17 8.5" stroke="${_hex(AppColors.deepGreen)}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  factory AppIcon.plus({double size = AppSizes.iconLg}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 5 V19 M5 12 H19" stroke="${_hex(AppColors.surface)}" stroke-width="2.6" stroke-linecap="round"/>
</svg>''', size);

  /// Chevron pointing left ("forward" in RTL) — «الإنجازات».
  factory AppIcon.chevronForward({double size = AppSizes.iconXs}) =>
      AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M14 6 L8 12 L14 18" stroke="${_hex(AppColors.deepGreen)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  factory AppIcon.play({double size = AppSizes.iconXs}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M6 3.5 L19 12 L6 20.5 Z" fill="${_hex(AppColors.playGlyph)}"/>
</svg>''', size);

  factory AppIcon.navDashboard({
    required Color color,
    double size = AppSizes.iconNav,
  }) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M5 19 V12 M12 19 V6 M19 19 V15" stroke="${_hex(color)}" stroke-width="2.2" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.navPackages({
    required Color color,
    double size = AppSizes.iconNav,
  }) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <rect x="3" y="6" width="18" height="13" rx="4" stroke="${_hex(color)}" stroke-width="2.2"/>
  <path d="M3 11 H21" stroke="${_hex(color)}" stroke-width="2.2"/>
</svg>''', size);

  factory AppIcon.playSystem({double size = 15}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M6 3.5 L19 12 L6 20.5 Z" fill="${_hex(AppColors.playText)}"/>
</svg>''', size);

  /// App icon inside the Play sheet (sprout, no circle).
  factory AppIcon.sproutBare({double size = 34}) => AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <path d="M38 60 V34" stroke="${_hex(AppColors.deepGreen)}" stroke-width="5" stroke-linecap="round"/>
  <path d="M38 40 C28 40 22 34 22 26 C32 26 38 32 38 40 Z" fill="${_hex(AppColors.primary)}"/>
  <path d="M38 45 C48 45 54 39 54 31 C44 31 38 37 38 45 Z" fill="${_hex(AppColors.softGreen)}"/>
</svg>''', size);

  factory AppIcon.statSurahs({double size = AppSizes.iconLg}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M4 5.5 C6.5 4.2 9.5 4.2 12 5.8 C14.5 4.2 17.5 4.2 20 5.5 V18.5 C17.5 17.2 14.5 17.2 12 18.8 C9.5 17.2 6.5 17.2 4 18.5 Z" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M12 5.8 V18.8" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.8"/>
</svg>''', size);

  factory AppIcon.statAyat({double size = AppSizes.iconLg}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M6.5 3.5 H17.5 C18.3 3.5 19 4.2 19 5 V20.5 L12 16.5 L5 20.5 V5 C5 4.2 5.7 3.5 6.5 3.5 Z" stroke="${_hex(AppColors.skyDeep)}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9 8.5 H15 M9 12 H13" stroke="${_hex(AppColors.skyDeep)}" stroke-width="1.8" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.statHadith({double size = AppSizes.iconLg}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M20 12.5 C20 16.4 16.4 19.5 12 19.5 C10.9 19.5 9.9 19.3 8.9 19 L4 20.5 L5.6 16.4 C4.6 15.3 4 14 4 12.5 C4 8.6 7.6 5.5 12 5.5 C16.4 5.5 20 8.6 20 12.5 Z" stroke="${_hex(AppColors.berryDeep)}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M9 12.5 H15" stroke="${_hex(AppColors.berryDeep)}" stroke-width="1.8" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.statProjects({double size = AppSizes.iconLg}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 20 C12 15.5 14.8 12.5 19 12 C19 16.5 16.2 19.6 12 20 Z" fill="${_hex(AppColors.goldDeep)}"/>
  <path d="M12 20 C12 15.5 9.2 12.5 5 12 C5 16.5 7.8 19.6 12 20 Z" fill="${_hex(AppColors.goldMid)}"/>
  <path d="M12 20 V9.5 C12 6.5 13.8 4.5 16.5 4 C16.5 7 15 9 12 9.8" stroke="${_hex(AppColors.goldDeep)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  factory AppIcon.chevronDown({
    double size = AppSizes.iconXs,
    Color color = AppColors.textFaint,
    double stroke = 2.2,
  }) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M6 9.5 L12 15.5 L18 9.5" stroke="${_hex(color)}" stroke-width="$stroke" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  factory AppIcon.chevronUp({
    double size = AppSizes.iconXs,
    Color color = AppColors.textFaint,
    double stroke = 2.2,
  }) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M6 14.5 L12 8.5 L18 14.5" stroke="${_hex(color)}" stroke-width="$stroke" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  /// Growth illustration for the dashboard hero: 0 = بذرة, 1 = غَرْسة, 2 = شجرة.
  factory AppIcon.growthArt(int stage) {
    final g = _hex(AppColors.gold);
    final dg = _hex(AppColors.deepGreen);
    final p = _hex(AppColors.primary);
    final sg = _hex(AppColors.softGreen);
    final art = switch (stage) {
      0 =>
        '''
  <ellipse cx="80" cy="100" rx="11" ry="15" fill="$g"/>
  <path d="M80 88 C86 93 86 105 80 110 C74 105 74 93 80 88 Z" fill="${_hex(AppColors.seedGold)}"/>
  <circle cx="56" cy="84" r="3" fill="${_hex(AppColors.seedDots)}"/>
  <circle cx="106" cy="78" r="3.6" fill="${_hex(AppColors.seedDots)}"/>''',
      1 =>
        '''
  <path d="M80 114 V52" stroke="$dg" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M80 96 C64 96 54 88 54 74 C70 74 80 82 80 96 Z" fill="$p"/>
  <path d="M80 88 C96 88 106 80 106 66 C90 66 80 74 80 88 Z" fill="$sg"/>
  <path d="M80 74 C68 74 60 67 60 56 C73 56 80 63 80 74 Z" fill="$sg"/>
  <circle cx="80" cy="46" r="10" fill="$p"/>
  <circle cx="108" cy="44" r="3.4" fill="$g"/>''',
      _ =>
        '''
  <path d="M80 116 V64" stroke="$dg" stroke-width="7" stroke-linecap="round"/>
  <path d="M80 88 L62 76 M80 80 L98 68" stroke="$dg" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="80" cy="44" r="25" fill="$p"/>
  <circle cx="55" cy="58" r="17" fill="$sg"/>
  <circle cx="105" cy="58" r="17" fill="$sg"/>
  <circle cx="66" cy="36" r="5" fill="$g"/>
  <circle cx="94" cy="50" r="5" fill="$g"/>
  <circle cx="88" cy="28" r="4.4" fill="$g"/>
  <circle cx="52" cy="66" r="4.4" fill="$g"/>''',
    };
    return AppIcon._sized(
      '''
<svg viewBox="0 0 160 150" fill="none">
  <circle cx="80" cy="68" r="62" fill="${_hex(AppColors.greenTint)}"/>
$art
  <path d="M26 116 C52 107 108 107 134 116 L134 126 C108 117 52 117 26 126 Z" fill="${_hex(AppColors.borderStrong)}"/>
</svg>''',
      AppSizes.growthArtWidth,
      AppSizes.growthArtHeight,
    );
  }

  factory AppIcon.clock({
    double size = AppSizes.iconLg,
    Color color = AppColors.deepGreen,
  }) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="8.6" stroke="${_hex(color)}" stroke-width="1.9"/>
  <path d="M12 7.6 V12 L15 13.8" stroke="${_hex(color)}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  factory AppIcon.minus({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M6 12 H18" stroke="${_hex(AppColors.textDark)}" stroke-width="2.2" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.plusDark({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 6 V18 M6 12 H18" stroke="${_hex(AppColors.textDark)}" stroke-width="2.2" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.lines({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M4 7 H20 M4 12 H20 M4 17 H13" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.bell({double size = 19}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 4 C9.2 4 7 6.2 7 9 V13 L5.4 15.8 H18.6 L17 13 V9 C17 6.2 14.8 4 12 4 Z" stroke="${_hex(AppColors.textMuted)}" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="M10 18.2 C10.4 19.3 11.1 19.9 12 19.9 C12.9 19.9 13.6 19.3 14 18.2" stroke="${_hex(AppColors.textMuted)}" stroke-width="1.7" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.tick({
    required double size,
    Color color = AppColors.surface,
    double stroke = 3.6,
  }) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M5 12.5 L10 17.5 L19 7" stroke="${_hex(color)}" stroke-width="$stroke" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''', size);

  factory AppIcon.copy({double size = 19}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <rect x="8.5" y="3.5" width="12" height="14" rx="3.5" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9"/>
  <path d="M15.5 20.5 H7 C5.3 20.5 4 19.2 4 17.5 V8" stroke="${_hex(AppColors.deepGreen)}" stroke-width="1.9" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.share({double size = 19}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 16 V4 M12 4 L8 8 M12 4 L16 8" stroke="${_hex(AppColors.surface)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 14 V18 C5 19.1 5.9 20 7 20 H17 C18.1 20 19 19.1 19 18 V14" stroke="${_hex(AppColors.surface)}" stroke-width="2" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.shieldGold({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 3.5 L19.5 6.5 V12 C19.5 16.2 16.4 19.4 12 20.5 C7.6 19.4 4.5 16.2 4.5 12 V6.5 Z" stroke="${_hex(AppColors.warningText)}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M12 10 V15" stroke="${_hex(AppColors.warningText)}" stroke-width="1.9" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.playWhite({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M17.5 12 L7 5.5 V18.5 Z" fill="${_hex(AppColors.surface)}"/>
</svg>''', size);

  factory AppIcon.pauseWhite({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M9 5 V19 M15 5 V19" stroke="${_hex(AppColors.surface)}" stroke-width="2.6" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.mic({double size = AppSizes.iconMd}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <rect x="9" y="3.5" width="6" height="10.5" rx="3" stroke="${_hex(AppColors.textFaint)}" stroke-width="1.8"/>
  <path d="M5.5 11.5 C5.5 15.1 8.4 18 12 18 C15.6 18 18.5 15.1 18.5 11.5 M12 18 V20.5" stroke="${_hex(AppColors.textFaint)}" stroke-width="1.8" stroke-linecap="round"/>
</svg>''', size);

  factory AppIcon.leaves({double size = 19}) => AppIcon._('''
<svg viewBox="0 0 24 24" fill="none">
  <path d="M12 20 C12 15.5 14.8 12.5 19 12 C19 16.5 16.2 19.6 12 20 Z" fill="${_hex(AppColors.berryDeep)}"/>
  <path d="M12 20 C12 15.5 9.2 12.5 5 12 C5 16.5 7.8 19.6 12 20 Z" fill="${_hex(AppColors.berry)}"/>
</svg>''', size);

  /// Small sprout (no circle) used inline in notes (10, 16).
  factory AppIcon.sproutInline({double size = 24, double stroke = 6}) =>
      AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <path d="M38 60 V34" stroke="${_hex(AppColors.deepGreen)}" stroke-width="$stroke" stroke-linecap="round"/>
  <path d="M38 40 C28 40 22 34 22 26 C32 26 38 32 38 40 Z" fill="${_hex(AppColors.primary)}"/>
  <path d="M38 45 C48 45 54 39 54 31 C44 31 38 37 38 45 Z" fill="${_hex(AppColors.softGreen)}"/>
</svg>''', size);

  /// Tiny sprout beside «آخر إضافة» (16-DashAyat).
  factory AppIcon.sproutTiny({double size = AppSizes.iconXs}) => AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <path d="M38 62 V34" stroke="${_hex(AppColors.deepGreen)}" stroke-width="7" stroke-linecap="round"/>
  <path d="M38 42 C28 42 22 36 22 27 C32 27 38 33 38 42 Z" fill="${_hex(AppColors.primary)}"/>
  <path d="M38 47 C48 47 54 41 54 32 C44 32 38 38 38 47 Z" fill="${_hex(AppColors.softGreen)}"/>
</svg>''', size);

  /// Tree-in-a-circle mark on the success screen (11-PairingCode).
  factory AppIcon.treeMark({double size = 104}) => AppIcon._('''
<svg viewBox="0 0 76 76" fill="none">
  <circle cx="38" cy="38" r="36" fill="${_hex(AppColors.greenTint)}"/>
  <path d="M38 62 V32" stroke="${_hex(AppColors.deepGreen)}" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="38" cy="26" r="13" fill="${_hex(AppColors.primary)}"/>
  <circle cx="25" cy="35" r="8.5" fill="${_hex(AppColors.softGreen)}"/>
  <circle cx="51" cy="35" r="8.5" fill="${_hex(AppColors.softGreen)}"/>
  <circle cx="31" cy="21" r="3.2" fill="${_hex(AppColors.gold)}"/>
  <circle cx="46" cy="30" r="2.6" fill="${_hex(AppColors.gold)}"/>
</svg>''', size);

  /// Child avatar from the 10-AvatarPicker set (g1–g5 girls, b1–b4 boys).
  /// [variant] picks the design's drawing: card (tinted circle, used on
  /// Packages/AddChild), chip (circle, no mouth, dashboard chips) or picker
  /// (no circle, avatar grid).
  factory AppIcon.childAvatar(
    String id, {
    double size = AppSizes.avatar,
    AvatarVariant variant = AvatarVariant.card,
  }) {
    final a = AvatarStyle.byId(id);
    final cloth = _hex(a.cloth);
    final skin = _hex(a.skin);
    final ink = _hex(AppColors.avatarFeatures);
    final mouth = variant == AvatarVariant.chip
        ? ''
        : a.girl
        ? '<path d="M28.5 38 C30.5 40 34 40 36.5 38" stroke="$ink" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M28.5 37 C30.5 39 34 39 36.5 37" stroke="$ink" stroke-width="2" stroke-linecap="round"/>';
    final picker =
        variant == AvatarVariant.picker || variant == AvatarVariant.row;
    final circle = variant == AvatarVariant.picker
        ? ''
        : '<circle cx="32" cy="32" r="32" fill="${_hex(a.tint)}"/>';
    final String body;
    if (a.girl) {
      final shape = picker
          ? 'M32 8 C19 8 13 18 13 31 C13 44 19 53 21 58 H43 C45 53 51 44 51 31 C51 18 45 8 32 8 Z'
          : 'M32 10 C20 10 14 19 14 31 C14 43 20 52 22 57 H42 C44 52 50 43 50 31 C50 19 44 10 32 10 Z';
      body =
          '''
  <path d="$shape" fill="$cloth"/>
  <ellipse cx="32" cy="31" rx="11" ry="12.5" fill="$skin"/>
  <path d="M21 28 C21 21 25 16 32 16 C39 16 43 21 43 28 Z" fill="$cloth"/>
  <circle cx="27.5" cy="32" r="2.3" fill="$ink"/>
  <circle cx="37" cy="32" r="2.3" fill="$ink"/>''';
    } else {
      final torso = picker
          ? 'M15 58 C15 47 23 41 32 41 C41 41 49 47 49 58 Z'
          : 'M17 57 C17 47 24 42 32 42 C40 42 47 47 47 57 Z';
      final cap = picker
          ? 'M20 24 C20 16 25 11.5 32 11.5 C39 11.5 44 16 44 24 Z'
          : 'M20 24 C20 17 25 12.5 32 12.5 C39 12.5 44 17 44 24 Z';
      final capLine = variant == AvatarVariant.chip
          ? ''
          : '<path d="M20.5 25 H43.5" stroke="${_hex(AppColors.borderStrong)}" stroke-width="2" stroke-linecap="round"/>';
      body =
          '''
  <path d="$torso" fill="$cloth"/>
  <ellipse cx="32" cy="30" rx="11.5" ry="12.5" fill="$skin"/>
  <path d="$cap" fill="${_hex(AppColors.avatarCap)}"/>
  $capLine
  <circle cx="27.5" cy="31" r="2.3" fill="$ink"/>
  <circle cx="37" cy="31" r="2.3" fill="$ink"/>''';
    }
    return AppIcon._(
      '<svg viewBox="0 0 64 64" fill="none">$circle$body$mouth</svg>',
      size,
    );
  }

  @override
  Widget build(BuildContext context) {
    final pic = SvgPicture.string(_svg, width: size, height: height);
    return semanticLabel == null
        ? ExcludeSemantics(child: pic)
        : Semantics(label: semanticLabel, child: pic);
  }
}

/// card = 05/12 cards; chip = 12 chips; picker = 10 picker (no circle);
/// row = 17 leaderboard rows (picker shapes on the tinted circle).
enum AvatarVariant { card, chip, picker, row }

/// The nine modest avatars of 10-AvatarPicker, with their design labels.
class AvatarStyle {
  const AvatarStyle(this.id, this.girl, this.label, this.cloth, this.skin);

  final String id;
  final bool girl;
  final String label;
  final Color cloth;
  final Color skin;

  /// Circle behind card/chip avatars, matched to the clothing colour.
  Color get tint => switch (cloth) {
    AppColors.berry => AppColors.berryTint,
    AppColors.sky => AppColors.skyTint,
    AppColors.primary => AppColors.greenTint,
    AppColors.gold => AppColors.goldTint,
    _ => AppColors.borderSoft,
  };

  static const all = [
    AvatarStyle(
      'g1',
      true,
      'فتاة بحجاب توتي',
      AppColors.berry,
      AppColors.avatarSkinLight,
    ),
    AvatarStyle(
      'g2',
      true,
      'فتاة بحجاب سماوي',
      AppColors.sky,
      AppColors.avatarSkinTan,
    ),
    AvatarStyle(
      'g3',
      true,
      'فتاة بحجاب أخضر',
      AppColors.primary,
      AppColors.avatarSkinMid,
    ),
    AvatarStyle(
      'g4',
      true,
      'فتاة بحجاب ذهبي',
      AppColors.gold,
      AppColors.avatarSkinDeep,
    ),
    AvatarStyle(
      'g5',
      true,
      'فتاة بحجاب كريمي',
      AppColors.avatarCream,
      AppColors.avatarSkinLight,
    ),
    AvatarStyle(
      'b1',
      false,
      'فتى بثوب أخضر',
      AppColors.primary,
      AppColors.avatarSkinTan,
    ),
    AvatarStyle(
      'b2',
      false,
      'فتى بثوب سماوي',
      AppColors.sky,
      AppColors.avatarSkinMid,
    ),
    AvatarStyle(
      'b3',
      false,
      'فتى بثوب ذهبي',
      AppColors.gold,
      AppColors.avatarSkinDeep,
    ),
    AvatarStyle(
      'b4',
      false,
      'فتى بثوب كريمي',
      AppColors.avatarCream,
      AppColors.avatarSkinLight,
    ),
  ];

  static AvatarStyle byId(String id) =>
      all.firstWhere((a) => a.id == id, orElse: () => all.first);
}
