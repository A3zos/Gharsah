import 'package:hijri/hijri_calendar.dart';

import 'arabic_digits.dart';

/// «٥:٠٠ مساءً» for [minutes] after midnight (12-hour clock, as in 08-Schedule).
String formatTime(int minutes) {
  final t = ((minutes % 1440) + 1440) % 1440;
  final h = t ~/ 60;
  final m = t % 60;
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '${h12.arabicDigits}:${m.toString().padLeft(2, '0').arabicDigits} '
      '${h < 12 ? 'صباحًا' : 'مساءً'}';
}

/// Hijri month names as written in the approved design (13–16).
const _hijriMonths = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

/// «١٢ رجب» — the design's date style (Umm al-Qura via package:hijri).
String formatHijriDayMonth(DateTime date) {
  final h = HijriCalendar.fromDate(date.toLocal());
  return '${h.hDay.arabicDigits} ${_hijriMonths[h.hMonth - 1]}';
}
