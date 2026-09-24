import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/arabic_digits.dart';

/// One verified ayah from `assets/data/splash_ayat.json` (Tanzil, Hafs/Uthmani).
/// The text is shown exactly as stored — never edited, generated or fetched at runtime.
class SplashAyah {
  const SplashAyah({
    required this.surah,
    required this.surahName,
    required this.ayah,
    required this.text,
    required this.isExcerpt,
    required this.source,
  });

  factory SplashAyah.fromJson(Map<String, dynamic> j) => SplashAyah(
    surah: j['surah'] as int,
    surahName: j['surahName'] as String,
    ayah: j['ayah'] as int,
    text: j['text'] as String,
    isExcerpt: j['isExcerpt'] as bool,
    source: j['source'] as String,
  );

  final int surah;
  final String surahName;
  final int ayah;
  final String text;
  final bool isExcerpt;
  final String source;

  /// «سورة العلق · ١» or, for an excerpt, «سورة طه · من الآية ١١٤».
  String get reference => isExcerpt
      ? 'سورة $surahName · من الآية ${ayah.arabicDigits}'
      : 'سورة $surahName · ${ayah.arabicDigits}';
}

class SplashAyatRepository {
  const SplashAyatRepository();

  static const _asset = 'assets/data/splash_ayat.json';
  static const _prefsKey = 'splash_ayah_next_index';

  Future<List<SplashAyah>> loadAll() async {
    final raw =
        jsonDecode(await rootBundle.loadString(_asset)) as Map<String, dynamic>;
    return (raw['ayat'] as List)
        .map((e) => SplashAyah.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  }

  /// A different ayah each launch: rotates through the list in order.
  /// If local storage is unavailable, falls back to a time-based pick.
  Future<SplashAyah> nextForLaunch() async {
    final all = await loadAll();
    var index = DateTime.now().millisecondsSinceEpoch % all.length;
    try {
      final prefs = await SharedPreferences.getInstance();
      index = (prefs.getInt(_prefsKey) ?? 0) % all.length;
      await prefs.setInt(_prefsKey, (index + 1) % all.length);
    } catch (e) {
      debugPrint('Splash rotation storage unavailable: $e');
    }
    return all[index];
  }
}
