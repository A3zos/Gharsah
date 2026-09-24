/// Arabic-Indic numeral helpers. The UI shows ٠١٢٣٤٥٦٧٨٩ everywhere (CLAUDE.md §4).
abstract final class ArabicDigits {
  static const String _latin = '0123456789';
  static const String _arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  static const String _persian =
      '۰۱۲۳۴۵۶۷۸۹'; // Eastern (Persian/Urdu) keyboards

  /// Replaces Latin (and Persian) digits with Arabic-Indic digits. Other characters are kept.
  static String toArabic(String input) {
    final out = StringBuffer();
    for (final ch in input.split('')) {
      var i = _latin.indexOf(ch);
      if (i < 0) i = _persian.indexOf(ch);
      out.write(i >= 0 ? _arabicIndic[i] : ch);
    }
    return out.toString();
  }

  /// Replaces Arabic-Indic (and Persian) digits with Latin digits — for storage/comparison.
  static String toLatin(String input) {
    final out = StringBuffer();
    for (final ch in input.split('')) {
      var i = _arabicIndic.indexOf(ch);
      if (i < 0) i = _persian.indexOf(ch);
      out.write(i >= 0 ? _latin[i] : ch);
    }
    return out.toString();
  }

  /// Formats an integer with Arabic-Indic digits.
  static String number(int value) => toArabic(value.toString());

  /// Returns the single Arabic-Indic digit for [ch] if it is any kind of digit, otherwise null.
  static String? normalizeDigit(String ch) {
    if (ch.length != 1) return null;
    if (_arabicIndic.contains(ch)) return ch;
    var i = _latin.indexOf(ch);
    if (i < 0) i = _persian.indexOf(ch);
    return i >= 0 ? _arabicIndic[i] : null;
  }
}

extension ArabicDigitsString on String {
  String get arabicDigits => ArabicDigits.toArabic(this);
  String get latinDigits => ArabicDigits.toLatin(this);
}

extension ArabicDigitsInt on int {
  String get arabicDigits => ArabicDigits.number(this);
}
