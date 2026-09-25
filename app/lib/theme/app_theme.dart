import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_tokens.g.dart';

// Colors, radii, shadows and font families are generated from the shared
// tokens/design-tokens.json (also used by web/). Sizes and text styles below.
export 'app_tokens.g.dart';

/// 17–23 sizes (design values).
abstract final class LessonSizes {
  static const double framePaddingTop = 24;
  static const double framePaddingH = 20;
  static const double framePaddingBottom = 26;
  static const double frameGap = 12;
  static const double maxWidth = 520;
  static const double endCall = 44;
  static const double liveDot = 8;
  static const double teacherBox = 190; // 18/20; 178 in 19/21/22, 172 in 23
  static const double teacher = 180; // 18/20; 170 in 19/21/22, 164 in 23
  static const double captionMinHeight = 34;
  static const double middleMinHeight = 292;
  static const double reportMinHeight = 250;
  static const double mic = 118; // 112 in 23
  static const double micGlyph = 50; // 48 in 23
  static const double voiceBarsHeight = 18; // 16 in 23
  static const double hintHeight = 18;
  static const double planIcon = 40;
  static const double doneArt = 132;
  static const double stepNumber = 30;
  static const double homeButtonHeight = 64;
  static const double reRecordHeight = 48;
  static const double streakDayHeight = 34;
  static const double homeAvatar = 62;
  static const double leaderMedal = 28;
  static const double leaderAvatar = 38;
  static const double heroCtaHeight = 68;
  static const double shortcutMinHeight = 124;
  static const double shortcutIcon = 54;
  static const double studentNavHeight = 90;

  /// Voice-bar heights from the design (21 bars).
  static const List<double> voiceBars = [
    9,
    14,
    7,
    16,
    11,
    18,
    6,
    13,
    17,
    8,
    15,
    10,
    18,
    7,
    14,
    9,
    16,
    11,
    6,
    13,
    8,
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

/// Font families (from [AppFontFamilies]): body = Cairo, headings/brand =
/// Baloo Bhaijaan 2, Quran ayat = Amiri Quran (Uthmani: ٱ, dotless ى, small
/// waqf marks), hadith / classical text = Amiri.
/// Line-height is distributed evenly above/below the glyphs, as in CSS, so
/// spacing matches the HTML design. Styles with no `height` use the font's
/// natural line height, like CSS `line-height: normal` in the mockups.
abstract final class AppFonts {
  /// CSS `line-height: normal` for each family (hhea metrics: Cairo 1874/1000,
  /// Baloo Bhaijaan 2 1712/1000). Applied when a style sets no height, so text
  /// boxes match the Chrome-rendered design exactly.
  static const double cairoNormal = AppFontFamilies.bodyNormalLineHeight;
  static const double balooNormal = AppFontFamilies.headingNormalLineHeight;

  static TextStyle heading(TextStyle style) => GoogleFonts.getFont(
    AppFontFamilies.heading,
    textStyle: _css(style, balooNormal),
  );
  static TextStyle body(TextStyle style) => GoogleFonts.getFont(
    AppFontFamilies.body,
    textStyle: _css(style, cairoNormal),
  );

  /// Quran ayah text (and its ﴿ ﴾ brackets) only.
  static TextStyle ayah(TextStyle style) =>
      GoogleFonts.getFont(AppFontFamilies.ayah, textStyle: _css(style, null));

  /// Hadith and other classical Arabic text — never an ayah.
  static TextStyle classical(TextStyle style) => GoogleFonts.getFont(
    AppFontFamilies.classical,
    textStyle: _css(style, null),
  );

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
      fontFamily: GoogleFonts.getFont(AppFontFamilies.body).fontFamily,
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

/// Text styles for 17–23 (child app & live lesson), from the design HTML.
/// Every style has an explicit fontSize; colors default to the design's and
/// can be overridden with copyWith.
abstract final class LessonText {
  static TextStyle _b(
    double size,
    FontWeight w, [
    Color c = AppColors.textDark,
    double? h,
  ]) => AppFonts.body(
    TextStyle(fontSize: size, fontWeight: w, color: c, height: h),
  );
  static TextStyle _h(
    double size,
    FontWeight w, [
    Color c = AppColors.textDark,
    double? h,
  ]) => AppFonts.heading(
    TextStyle(fontSize: size, fontWeight: w, color: c, height: h),
  );

  // Live call chrome (18–23)
  static TextStyle get live => _b(12, FontWeight.w800, AppColors.berryDeep);
  static TextStyle get timer => _h(13.5, FontWeight.w700, AppColors.textMuted);
  static TextStyle get caption =>
      _b(17, FontWeight.w700, AppColors.textDark, 1.7);
  static TextStyle get hint => _b(12.5, FontWeight.w700, AppColors.textMuted);

  // 18 plan + ayah
  static TextStyle get planTitle =>
      _h(17, FontWeight.w700, AppColors.textDark, 1.5);
  static TextStyle get planRow => _b(15.5, FontWeight.w700);
  static TextStyle get planMeta =>
      _b(12.5, FontWeight.w800, AppColors.textMuted);
  static TextStyle get chip => _b(12, FontWeight.w800);
  static TextStyle get ayah => AppFonts.ayah(
    const TextStyle(fontSize: 31, height: 1.9, color: AppColors.textDark),
  );
  static TextStyle get ayahBracket => AppFonts.ayah(
    const TextStyle(fontSize: 35, height: 1.9, color: AppColors.ayahBracket),
  );
  static TextStyle get ayahRef => _b(13, FontWeight.w700, AppColors.textMuted);

  // 20 hadith
  static TextStyle get hadithTopic => _h(28, FontWeight.w700);
  static TextStyle get hadithBadge =>
      _b(12.5, FontWeight.w800, AppColors.berryDeep);
  static TextStyle get hadithPlaceholder =>
      _b(15, FontWeight.w700, AppColors.warningText, 1.85);
  static TextStyle get hadithText => AppFonts.classical(
    const TextStyle(fontSize: 24, height: 1.9, color: AppColors.textDark),
  );
  static TextStyle get takhrij => _b(13, FontWeight.w700, AppColors.textFaint);

  // 19 / 23 celebration
  static TextStyle get doneTitle =>
      _h(29, FontWeight.w700, AppColors.deepGreen, 1.5);
  static TextStyle get statNumber =>
      _h(28, FontWeight.w800, AppColors.deepGreen, 1.2);
  static TextStyle get statLabel =>
      _b(12.5, FontWeight.w700, AppColors.textMuted);
  static TextStyle get doneRow => _h(20, FontWeight.w700, AppColors.deepGreen);
  static TextStyle get streakTitle => _b(14, FontWeight.w800);
  static TextStyle get streakDay =>
      _b(12, FontWeight.w800, AppColors.deepGreen);
  static TextStyle get homeButton => _h(20, FontWeight.w700, AppColors.surface);

  // 21 / 22 project
  static TextStyle get projectTitle =>
      _h(24, FontWeight.w700, AppColors.onGold, 1.55);
  static TextStyle get stepNumber =>
      _h(15, FontWeight.w800, AppColors.deepGreen);
  static TextStyle get stepText => _b(14.5, FontWeight.w700);
  static TextStyle get recChip => _b(13, FontWeight.w800, AppColors.berryDeep);
  static TextStyle get note =>
      _b(12.5, FontWeight.w700, AppColors.textMuted, 1.7);
  static TextStyle get reRecord => _b(14, FontWeight.w700, AppColors.textMuted);

  // 17 StudentHome
  static TextStyle get greeting =>
      _h(25, FontWeight.w700, AppColors.textDark, 1.4);
  static TextStyle get cardTitle =>
      _h(18, FontWeight.w700, AppColors.textDark, 1.5);
  static TextStyle get pillSmall =>
      _b(11, FontWeight.w800, AppColors.textMuted);
  static TextStyle get leaderName => _b(14.5, FontWeight.w700);
  static TextStyle get leaderPoints => _h(16, FontWeight.w800);
  static TextStyle get medal => _h(14, FontWeight.w800);
  static TextStyle get leaderNote =>
      _b(13, FontWeight.w700, AppColors.textDark, 1.7);
  static TextStyle get tinyCenter =>
      _b(11.5, FontWeight.w400, AppColors.textMuted);
  static TextStyle get heroTitle =>
      _h(24, FontWeight.w700, AppColors.surface, 1.4);
  static TextStyle get heroBadge => _b(11.5, FontWeight.w800, AppColors.onGold);
  static TextStyle get heroChip => _b(13.5, FontWeight.w700, AppColors.surface);
  static TextStyle get heroProgress =>
      _b(12.5, FontWeight.w700, AppColors.onDeepGreenMuted);
  static TextStyle get heroCta => _h(22, FontWeight.w700, AppColors.onGold);
  static TextStyle get shortcutTitle => _b(14.5, FontWeight.w800);
  static TextStyle get shortcutMeta =>
      _b(11.5, FontWeight.w700, AppColors.textMuted);
  static TextStyle get nav => _b(13, FontWeight.w700, AppColors.textMuted);
}
