import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens for غَرْسة — the single source of truth (CLAUDE.md §4).
/// Values come from the approved design in `design/html`. No screen may
/// hardcode a color, size, radius or shadow; add a token here instead.
abstract final class AppColors {
  // Surfaces
  static const Color background = Color(0xFFFBF6EC); // cream
  static const Color surface = Color(0xFFFFFFFF);

  // Greens
  static const Color primary = Color(0xFF2FA98C);
  // brand / buttons / CTA text-on-light
  static const Color deepGreen = Color(0xFF1B7F69);
  static const Color darkerGreen = Color(0xFF14624F);
  static const Color greenTint = Color(0xFFEAF6F2);
  static const Color softGreen = Color(0xFF7ACBB6);

  // Gold
  static const Color gold = Color(0xFFF4B740);
  static const Color seedGold = Color(0xFFD99F23); // seed core
  static const Color goldTint = Color(0xFFFDF1DA);
  static const Color onGold = Color(0xFF4A3206);
  static const Color warningText = Color(0xFF7A5209);
  static const Color ayahBracket = Color(0xFF9C6B12);

  // Berry (errors)
  static const Color berry = Color(0xFFE86A92);
  static const Color berryDeep = Color(0xFFA8365C);
  static const Color berryTint = Color(0xFFFDE9EF);
  static const Color errorText = Color(0xFF8E2B4D);

  // Sky
  static const Color sky = Color(0xFF4EA9E8);
  static const Color skyTint = Color(0xFFE7F2FC);

  // Text
  static const Color textDark = Color(0xFF1F3D37);
  static const Color textMuted = Color(0xFF5C716C);
  static const Color placeholder = Color(0xFF8A9A95);

  // Borders
  static const Color border = Color(0xFFEFE7D6);
  static const Color borderStrong = Color(0xFFE4DCC8);
  // also the segmented-tab track
  static const Color borderSoft = Color(0xFFF4F0E4);
  static const Color inputBorder = Color(0xFFE7DECB);

  // Text on the deep-green hero card (05-Packages).
  static const Color onDeepGreenMuted = Color(0xFFE6F4EF);
  // Dark play glyph in the Google Play note (05-Packages).
  static const Color playGlyph = Color(0xFF3B4A47);

  // Avatar illustration (05-Packages child cards).
  static const Color avatarSkinLight = Color(0xFFF2C9A0);
  static const Color avatarSkinTan = Color(0xFFE0A97C);
  static const Color avatarFeatures = Color(0xFF3B2A24);
  static const Color avatarCap = Color(0xFFF7F2E6);
  static const Color avatarSkinMid = Color(0xFFC98A5E);
  static const Color avatarSkinDeep = Color(0xFF8D5A3B);
  static const Color avatarCream = Color(0xFFD8CDB4);

  // 12-Dashboard
  static const Color textFaint = Color(
    0xFF9BA9A5,
  ); // chevrons, unreached stages
  static const Color skyDeep = Color(0xFF2B6FA0); // ayat icon
  static const Color goldDeep = Color(0xFFB57A10); // projects icon
  static const Color goldMid = Color(0xFFE0A82A); // projects icon
  static const Color seedDots = Color(0xFFCFE3DC); // seed-stage sparkles
  static const Color stageOffStem = Color(0xFFCBBFA6);
  static const Color stageOffLeaf = Color(0xFFDCE6E2);
  static const Color stageOffLeafLight = Color(0xFFE8EDEA);

  // 08–11 / 13–16
  static const Color mintBorder = Color(
    0xFFCFE3DC,
  ); // open custom-time box, green code cells
  static const Color goldBorder = Color(
    0xFFEFD9A8,
  ); // gold code cells, in-progress items

  // Google Play system sheet (06-PlayConfirm) — Google's own greys, not brand.
  static const Color playSurface = Color(0xFFF8F9FA);
  static const Color playChip = Color(0xFFF1F3F4);
  static const Color playDivider = Color(0xFFE8EAED);
  static const Color playOutline = Color(0xFFDADCE0);
  static const Color playTextStrong = Color(0xFF202124);
  static const Color playText = Color(0xFF3C4043);
  static const Color playTextMuted = Color(0xFF5F6368);
  static const Color scrim = Color(0x8C172925); // rgba(23,41,37,.55)

  // Decorative background blobs (design uses translucent brand colors).
  static Color blobGreen = primary.withValues(alpha: 0.07);
  static Color blobGreenStrong = primary.withValues(alpha: 0.08);
  static Color blobGold = gold.withValues(alpha: 0.11);
  static Color blobGoldStrong = gold.withValues(alpha: 0.12);
  static Color blobSky = sky.withValues(alpha: 0.08);
  static Color blobGreenFaint = primary.withValues(alpha: 0.06);
  static Color blobGoldFaint = gold.withValues(alpha: 0.08);
  static Color heroCircle = surface.withValues(alpha: 0.07);
  static Color heroTrack = surface.withValues(alpha: 0.22);
}

abstract final class AppRadii {
  static const double chip = 14;
  static const double iconBox = 18;
  static const double row = 18;
  static const double input = 20; // text fields + auth buttons (03/04 frames)
  static const double inputCompact = 19; // signup fields (04 frame)
  static const double cta = 22;
  static const double smallCard = 24;
  static const double card = 28;
  static const double heroCard = 30;
  static const double pill = 999;

  static const double backButton = 16;
  static const double tabTrack = 20;
  static const double tab = 16;
  static const double codeCell = 17;
  static const double eyeButton = 14;
  static const double note = 18;
  static const double timelineCard = 26;

  // 05-Packages
  static const double headerButton = 15; // settings / «الإنجازات»
  static const double planCard = 26;
  static const double childCard = 24;
  static const double renewButton = 18;
  static const double subscribeButton = 17;
  static const double monthlyButton = 16;
  static const double infoNote = 20;
  static const double noteIconBox = 11;
  static const double progress = 6;

  // 07-AddChild
  static const double stepPill = 13;
  static const double ageChip = 18;
  static const double genderCard = 24;

  // 08–11 add-child flow
  static const double timeCard = 22;
  static const double smallButton = 15;
  static const double toggle = 18;
  static const double dayRow = 16;
  static const double timePill = 14;
  static const double pairingCell = 16;
  static const double actionButton = 18;
  static const double noteCard = 20;

  // 13–16 dashboard detail panels
  static const double detailPanel = 26;
  static const double projectCard = 20;
  static const double player = 18;
  static const double listRow = 16;
  static const double hideButton = 14;
  static const double summaryCard = 22;
  static const double miniBar = 5;

  // 12-Dashboard
  static const double childChip = 16;
  static const double statCard = 24;
  static const double statIcon = 14;

  // 06-PlayConfirm
  static const double sheet = 30;
  static const double playChip = 9;
  static const double playAppIcon = 15;
  static const double playPanel = 16;
  static const double playButton = 26;
}

abstract final class AppShadows {
  static const List<BoxShadow> card = [
    BoxShadow(color: Color(0x0F1F3D37), offset: Offset(0, 10), blurRadius: 26),
  ];
  static const List<BoxShadow> soft = [
    BoxShadow(color: Color(0x0A1F3D37), offset: Offset(0, 8), blurRadius: 18),
  ];
  static const List<BoxShadow> hero = [
    BoxShadow(color: Color(0x421B7F69), offset: Offset(0, 16), blurRadius: 32),
  ];
  static const List<BoxShadow> planCard = [
    BoxShadow(color: Color(0x0F1F3D37), offset: Offset(0, 10), blurRadius: 24),
  ];
  static const List<BoxShadow> childCard = [
    BoxShadow(color: Color(0x0D1F3D37), offset: Offset(0, 8), blurRadius: 20),
  ];
  static const List<BoxShadow> greenButton = [
    BoxShadow(color: Color(0x381B7F69), offset: Offset(0, 10), blurRadius: 22),
  ];
  static const List<BoxShadow> sheet = [
    BoxShadow(color: Color(0x2E172925), offset: Offset(0, -12), blurRadius: 40),
  ];
  static const List<BoxShadow> pairingCard = [
    BoxShadow(color: Color(0x121F3D37), offset: Offset(0, 12), blurRadius: 30),
  ];
  static const List<BoxShadow> tab = [
    BoxShadow(color: Color(0x141F3D37), offset: Offset(0, 4), blurRadius: 12),
  ];
}

abstract final class AppSizes {
  static const double phoneWidth = 390;
  static const double maxContentWidth = 560; // tablet centering
  static const double minTouch = 48;

  static const double screenPaddingH = 26;
  static const double buttonHeight = 58;
  static const double fieldHeight = 58;
  static const double fieldHeightCompact = 56;
  static const double fieldPaddingH = 18;
  // HTML says 1.5px, but the approved PNG export renders it as 1px; match the PNG.
  static const double borderWidth = 1;
  static const double backButton = 46;
  static const double tabHeight = 52;
  static const double codeCellWidth = 46;
  static const double codeCellHeight = 64;
  static const double strengthBarHeight = 6;

  static const double logoSplash = 84;
  static const double logoAuth = 66;
  static const double logoChild = 96;
  static const double timelineNode = 66;

  // 05-Packages
  static const double pagePaddingH = 20;
  static const double headerLogo = 40;
  static const double headerButton = 44;
  static const double renewButtonHeight = 52;
  static const double subscribeButtonHeight = 50;
  static const double monthlyButtonHeight = 48;
  static const double achievementsHeight = 44;
  static const double avatar = 56;
  static const double avatarPicker = 74;
  static const double noteIconBox = 36;
  static const double progressHeight = 10;
  static const double bottomNavHeight = 88;
  static const double iconXs = 18;
  static const double iconNav = 24;

  // 07-AddChild
  static const double stepPillHeight = 38;
  static const double stepNumber = 21;
  static const double ageChipHeight = 56;
  static const double genderCardHeight = 128;
  static const double genderAvatar = 58;
  static const double selectedBorderWidth = 2;

  // 08–11 add-child flow
  static const double dayCircle = 46;
  static const double smallButton = 44;
  static const double toggleHeight = 58;
  static const double durationHeight = 54;
  static const double avatarCardHeight = 112;
  static const double avatarCheck = 26;
  static const double avatarSelectedBorder = 2.5;
  static const double pairingCellWidth = 46;
  static const double pairingCellHeight = 62;
  static const double treeMark = 104;
  static const double successBadge = 34;
  static const double actionButtonHeight = 52;
  static const double secondaryButtonHeight = 50;

  // 13–16 dashboard detail panels
  static const double playButton = 52;
  static const double waveHeight = 32;
  static const double hideButtonHeight = 40;
  static const double listCheck = 28;
  static const double clockBadge = 34;
  static const double miniBarHeight = 8;

  // 12-Dashboard
  static const double childChipHeight = 46;
  static const double chipAvatar = 28;
  static const double statCardMinHeight = 134;
  static const double statIcon = 42;
  static const double growthArtWidth = 186;
  static const double growthArtHeight = 152;

  // 06-PlayConfirm
  static const double sheetHandleWidth = 44;
  static const double playChip = 30;
  static const double playAppIcon = 52;
  static const double playButtonHeight = 52;

  static const double iconSm = 16;
  static const double iconMd = 20;
  static const double iconLg = 22;
}

/// Font families. Body = Cairo, headings/brand = Baloo Bhaijaan 2, Quran = Amiri.
/// Line-height is distributed evenly above/below the glyphs, as in CSS, so
/// spacing matches the HTML design. Styles with no `height` use the font's
/// natural line height, like CSS `line-height: normal` in the mockups.
abstract final class AppFonts {
  /// CSS `line-height: normal` for each family (hhea metrics: Cairo 1874/1000,
  /// Baloo Bhaijaan 2 1712/1000). Applied when a style sets no height, so text
  /// boxes match the Chrome-rendered design exactly.
  static const double cairoNormal = 1.874;
  static const double balooNormal = 1.712;

  static TextStyle heading(TextStyle style) =>
      GoogleFonts.balooBhaijaan2(textStyle: _css(style, balooNormal));
  static TextStyle body(TextStyle style) =>
      GoogleFonts.cairo(textStyle: _css(style, cairoNormal));
  static TextStyle ayah(TextStyle style) =>
      GoogleFonts.amiri(textStyle: _css(style, null));

  static TextStyle _css(TextStyle s, double? normal) => s.copyWith(
    leadingDistribution: TextLeadingDistribution.even,
    height: s.height ?? normal,
  );
}

/// Text styles that fall outside the Material [TextTheme] slots.
abstract final class AppTextStyles {
  static TextStyle get ayah => AppFonts.ayah(
    const TextStyle(fontSize: 31, height: 2.05, color: AppColors.textDark),
  );

  static TextStyle get ayahBracket => AppFonts.ayah(
    const TextStyle(fontSize: 36, height: 1, color: AppColors.ayahBracket),
  );

  /// «سورة العلق · ١» under the splash ayah.
  static TextStyle get ayahRef => AppFonts.body(
    const TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      color: AppColors.textMuted,
    ),
  );

  /// «نغرس حُبّ القرآن… ويكبر معهم».
  static TextStyle get tagline => AppFonts.body(
    const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w400,
      color: AppColors.textMuted,
    ),
  );

  /// Seed / sprout / tree labels (02-Auth).
  static TextStyle get timelineLabel => AppFonts.body(
    const TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w800,
      color: AppColors.deepGreen,
    ),
  );

  /// Login subtitle «سجّل دخولك لمتابعة تقدّم أبنائك.» (14.5 / 1.7).
  static TextStyle get subtitle => AppFonts.body(
    const TextStyle(
      fontSize: 14.5,
      fontWeight: FontWeight.w400,
      height: 1.7,
      color: AppColors.textMuted,
    ),
  );

  /// Inline text links such as «نسيت كلمة المرور؟» (13.5 / 700, underlined).
  static TextStyle get linkSmall => AppFonts.body(
    const TextStyle(
      fontSize: 13.5,
      fontWeight: FontWeight.w700,
      color: AppColors.deepGreen,
      decoration: TextDecoration.underline,
      decorationColor: AppColors.deepGreen,
    ),
  );

  /// Signup field labels (13.5 / 700).
  static TextStyle get labelCompact => AppFonts.body(
    const TextStyle(
      fontSize: 13.5,
      fontWeight: FontWeight.w700,
      color: AppColors.textDark,
    ),
  );

  /// «ليس لديك حساب؟ …» footers (14, natural line height).
  static TextStyle get footer => AppFonts.body(
    const TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w400,
      color: AppColors.textMuted,
    ),
  );

  /// Helper / validation line under a field (12.5 / 500).
  static TextStyle get helper => AppFonts.body(
    const TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w500,
      color: AppColors.textMuted,
    ),
  );

  /// Child-tab prompt «أدخل الرمز الذي أعطاك إياه والدك.» (15 / 1.8).
  static TextStyle get childPrompt => AppFonts.body(
    const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w400,
      height: 1.8,
      color: AppColors.textDark,
    ),
  );

  // ── 05-Packages ──
  static TextStyle get pageTitle => AppFonts.heading(
    const TextStyle(
      fontSize: 26,
      fontWeight: FontWeight.w700,
      height: 1.5,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get sectionTitle => AppFonts.heading(
    const TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      height: 1.5,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get cardTitle => AppFonts.heading(
    const TextStyle(
      fontSize: 19,
      fontWeight: FontWeight.w700,
      height: 1.5,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get cardTitleSmall => AppFonts.heading(
    const TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w700,
      height: 1.5,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get heroNumber => AppFonts.heading(
    const TextStyle(
      fontSize: 46,
      fontWeight: FontWeight.w800,
      height: 1.1,
      color: AppColors.gold,
    ),
  );
  static TextStyle get price => AppFonts.heading(
    const TextStyle(
      fontSize: 30,
      fontWeight: FontWeight.w800,
      height: 1.2,
      color: AppColors.deepGreen,
    ),
  );
  static TextStyle get priceSmall => AppFonts.heading(
    const TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w800,
      height: 1.2,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get priceUnit => AppFonts.body(
    const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w700,
      color: AppColors.textMuted,
    ),
  );
  static TextStyle get chip => AppFonts.body(
    const TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w800,
      color: AppColors.onGold,
    ),
  );
  static TextStyle get caption => AppFonts.body(
    const TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w400,
      color: AppColors.textMuted,
    ),
  );
  static TextStyle get body13 => AppFonts.body(
    const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w400,
      color: AppColors.textMuted,
    ),
  );
  static TextStyle get body135 => AppFonts.body(
    const TextStyle(
      fontSize: 13.5,
      fontWeight: FontWeight.w400,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get childName => AppFonts.body(
    const TextStyle(
      fontSize: 17,
      fontWeight: FontWeight.w700,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get buttonMedium => AppFonts.body(
    const TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w700,
      color: AppColors.surface,
    ),
  );
  static TextStyle get buttonSmall => AppFonts.body(
    const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      color: AppColors.deepGreen,
    ),
  );
  static TextStyle get navLabel => AppFonts.body(
    const TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w700,
      color: AppColors.textMuted,
    ),
  );

  // ── 07-AddChild ──
  static TextStyle get pageTitleSmall => AppFonts.heading(
    const TextStyle(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      height: 1.5,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get stepLabel => AppFonts.body(
    const TextStyle(
      fontSize: 12.5,
      fontWeight: FontWeight.w700,
      color: AppColors.textMuted,
    ),
  );
  static TextStyle get stepNumber => AppFonts.body(
    const TextStyle(
      fontSize: 11.5,
      fontWeight: FontWeight.w800,
      color: AppColors.textMuted,
    ),
  );
  static TextStyle get ageDigit => AppFonts.heading(
    const TextStyle(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get optionLabel => AppFonts.body(
    const TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      color: AppColors.textDark,
    ),
  );

  // ── 08–11 add-child flow ──
  static TextStyle get intro => AppFonts.body(
    const TextStyle(
      fontSize: 13.5,
      fontWeight: FontWeight.w400,
      height: 1.8,
      color: AppColors.textMuted,
    ),
  );
  static TextStyle get dayShort => AppFonts.body(
    const TextStyle(
      fontSize: 10.5,
      fontWeight: FontWeight.w700,
      height: 1.2,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get timeBig => AppFonts.heading(
    const TextStyle(
      fontSize: 26,
      fontWeight: FontWeight.w700,
      height: 1.4,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get actionLabel => AppFonts.body(
    const TextStyle(
      fontSize: 15.5,
      fontWeight: FontWeight.w700,
      color: AppColors.deepGreen,
    ),
  );
  static TextStyle get pairingDigit => AppFonts.heading(
    const TextStyle(
      fontSize: 30,
      fontWeight: FontWeight.w800,
      color: AppColors.deepGreen,
    ),
  );

  // ── 13–16 dashboard detail panels ──
  static TextStyle get itemTitle => AppFonts.body(
    const TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w700,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get statusChip => AppFonts.body(
    const TextStyle(
      fontSize: 11.5,
      fontWeight: FontWeight.w800,
      color: AppColors.deepGreen,
    ),
  );
  static TextStyle get small => AppFonts.body(
    const TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w400,
      color: AppColors.textMuted,
    ),
  );
  static TextStyle get summaryNumber => AppFonts.heading(
    const TextStyle(
      fontSize: 44,
      fontWeight: FontWeight.w800,
      height: 1,
      color: AppColors.textDark,
    ),
  );

  // ── 12-Dashboard ──
  static TextStyle get statNumber => AppFonts.heading(
    const TextStyle(
      fontSize: 32,
      fontWeight: FontWeight.w800,
      height: 1.2,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get percent => AppFonts.heading(
    const TextStyle(
      fontSize: 19,
      fontWeight: FontWeight.w800,
      height: 1.3,
      color: AppColors.deepGreen,
    ),
  );
  static TextStyle get chipLabel => AppFonts.body(
    const TextStyle(
      fontSize: 14.5,
      fontWeight: FontWeight.w700,
      color: AppColors.textDark,
    ),
  );
  static TextStyle get tiny => AppFonts.body(
    const TextStyle(
      fontSize: 11.5,
      fontWeight: FontWeight.w400,
      color: AppColors.textMuted,
    ),
  );

  // ── 06-PlayConfirm (Google Play system sheet; Cairo, Google greys) ──
  static TextStyle playText(
    double size, {
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.playText,
    double? height,
  }) => AppFonts.body(
    TextStyle(fontSize: size, fontWeight: weight, color: color, height: height),
  );

  static TextStyle get codeDigit => AppFonts.heading(
    const TextStyle(
      fontSize: 26,
      fontWeight: FontWeight.w800,
      color: AppColors.deepGreen,
      height: 1.2,
    ),
  );

  /// LTR input text (email) — same metrics as body input.
  static TextStyle get input => AppFonts.body(
    const TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w400,
      color: AppColors.textDark,
    ),
  );
}

abstract final class AppTheme {
  /// Every style carries an explicit fontSize (avoids the `fontSize != null` assertion).
  static TextTheme _textTheme() {
    const dark = AppColors.textDark;
    const muted = AppColors.textMuted;
    final heading = <String, TextStyle>{
      'displayLarge': const TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        height: 1.6,
        color: AppColors.deepGreen,
      ),
      'displayMedium': const TextStyle(
        fontSize: 30,
        fontWeight: FontWeight.w700,
        height: 1.5,
        color: AppColors.deepGreen,
      ),
      'displaySmall': const TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 1.6,
        color: dark,
      ),
      'headlineLarge': const TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        height: 1.6,
        color: dark,
      ),
      'headlineMedium': const TextStyle(
        fontSize: 27,
        fontWeight: FontWeight.w700,
        height: 1.55,
        color: dark,
      ),
      'headlineSmall': const TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        height: 1.5,
        color: dark,
      ),
    };
    final body = <String, TextStyle>{
      'titleLarge': const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: dark,
      ),
      'titleMedium': const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: dark,
      ),
      'titleSmall': const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w800,
        color: dark,
      ),
      'bodyLarge': const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        height: 1.7,
        color: muted,
      ),
      'bodyMedium': const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.7,
        color: muted,
      ),
      'bodySmall': const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w400,
        height: 1.75,
        color: dark,
      ),
      'labelLarge': const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: dark,
      ),
      'labelMedium': const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: dark,
      ),
      'labelSmall': const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 1.8,
        color: muted,
      ),
    };
    TextStyle h(String k) => AppFonts.heading(heading[k]!);
    TextStyle b(String k) => AppFonts.body(body[k]!);
    return TextTheme(
      displayLarge: h('displayLarge'),
      displayMedium: h('displayMedium'),
      displaySmall: h('displaySmall'),
      headlineLarge: h('headlineLarge'),
      headlineMedium: h('headlineMedium'),
      headlineSmall: h('headlineSmall'),
      titleLarge: b('titleLarge'),
      titleMedium: b('titleMedium'),
      titleSmall: b('titleSmall'),
      bodyLarge: b('bodyLarge'),
      bodyMedium: b('bodyMedium'),
      bodySmall: b('bodySmall'),
      labelLarge: b('labelLarge'),
      labelMedium: b('labelMedium'),
      labelSmall: b('labelSmall'),
    );
  }

  static ThemeData light() {
    final textTheme = _textTheme();
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.deepGreen,
      primary: AppColors.deepGreen,
      onPrimary: AppColors.surface,
      secondary: AppColors.gold,
      onSecondary: AppColors.onGold,
      error: AppColors.berry,
      onError: AppColors.surface,
      surface: AppColors.surface,
      onSurface: AppColors.textDark,
    );

    OutlineInputBorder outline(Color c) => OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadii.input),
      borderSide: BorderSide(color: c, width: AppSizes.borderWidth),
    );

    return ThemeData(
      useMaterial3: true,
      // Phone density everywhere (web/desktop default to compact, which shrinks
      // the 58px buttons and fields from the design).
      visualDensity: VisualDensity.standard,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: textTheme,
      fontFamily: GoogleFonts.cairo().fontFamily,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.textDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: textTheme.headlineSmall,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        hoverColor: AppColors.surface, // the design has no hover tint on fields
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSizes.fieldPaddingH,
          vertical: 17,
        ),
        hintStyle: AppTextStyles.input.copyWith(color: AppColors.placeholder),
        border: outline(AppColors.inputBorder),
        enabledBorder: outline(AppColors.inputBorder),
        focusedBorder: outline(AppColors.primary),
        errorBorder: outline(AppColors.berry),
        focusedErrorBorder: outline(AppColors.berry),
        errorStyle: textTheme.bodySmall!.copyWith(
          color: AppColors.errorText,
          fontWeight: FontWeight.w500,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.deepGreen,
          foregroundColor: AppColors.surface,
          disabledBackgroundColor: AppColors.deepGreen.withValues(alpha: 0.6),
          disabledForegroundColor: AppColors.surface,
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.input),
          ),
          textStyle: textTheme.titleLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.deepGreen,
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          side: const BorderSide(
            color: AppColors.deepGreen,
            width: AppSizes.borderWidth,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.input),
          ),
          textStyle: textTheme.titleLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.deepGreen,
          minimumSize: const Size(AppSizes.minTouch, AppSizes.minTouch),
          textStyle: textTheme.labelLarge,
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.textDark,
        contentTextStyle: textTheme.bodyMedium!.copyWith(
          color: AppColors.surface,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.chip),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.background,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadii.card),
          ),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.deepGreen,
      ),
    );
  }
}
