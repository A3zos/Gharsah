import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/core/arabic_digits.dart';

void main() {
  test('Latin and Persian digits become Arabic-Indic', () {
    expect('472918'.arabicDigits, '٤٧٢٩١٨');
    expect('۴۷۲'.arabicDigits, '٤٧٢');
    expect('سورة طه · 114'.arabicDigits, 'سورة طه · ١١٤');
  });

  test('Arabic-Indic digits become Latin', () {
    expect('٤٧٢٩١٨'.latinDigits, '472918');
  });

  test('int formatting', () {
    expect(119.arabicDigits, '١١٩');
  });

  test('normalizeDigit accepts any digit form, rejects others', () {
    expect(ArabicDigits.normalizeDigit('7'), '٧');
    expect(ArabicDigits.normalizeDigit('٧'), '٧');
    expect(ArabicDigits.normalizeDigit('۷'), '٧');
    expect(ArabicDigits.normalizeDigit('a'), isNull);
    expect(ArabicDigits.normalizeDigit('12'), isNull);
  });
}
