import 'dart:convert';

import 'package:flutter/services.dart';

/// A Quran ayah, referenced by surah:ayah only — the text and audio are looked
/// up from the verified assets, never embedded or generated.
class QuranRef {
  const QuranRef(this.surah, this.ayah);

  factory QuranRef.fromJson(Map<String, dynamic> j) =>
      QuranRef(j['surah'] as int, j['ayah'] as int);

  final int surah;
  final int ayah;

  /// «112:1»
  String get key => '$surah:$ayah';

  /// Asset/cache file name, e.g. `112001.mp3`.
  String get audioFileName =>
      '${surah.toString().padLeft(3, '0')}${ayah.toString().padLeft(3, '0')}.mp3';

  Map<String, dynamic> toJson() => {'surah': surah, 'ayah': ayah};

  @override
  bool operator ==(Object other) =>
      other is QuranRef && other.surah == surah && other.ayah == ayah;

  @override
  int get hashCode => Object.hash(surah, ayah);

  @override
  String toString() => 'QuranRef($key)';
}

/// Surah names + ayah counts from `assets/data/quran_meta.json` (Tanzil
/// metadata). Deliberately holds no Makki/Madani data (ai/GUARDRAILS.md §4).
class QuranMeta {
  QuranMeta(List<({String name, int ayat})> surahs)
    : assert(surahs.length == 114),
      _surahs = surahs,
      _starts = _cumulative(surahs);

  static const asset = 'assets/data/quran_meta.json';
  static const totalAyat = 6236;

  factory QuranMeta.fromJson(Map<String, dynamic> j) {
    final meta = QuranMeta([
      for (final s in (j['surahs'] as List).cast<Map<String, dynamic>>())
        (name: s['name'] as String, ayat: s['ayat'] as int),
    ]);
    assert(meta._starts.last + meta._surahs.last.ayat == totalAyat);
    return meta;
  }

  static Future<QuranMeta> load([AssetBundle? bundle]) async =>
      QuranMeta.fromJson(
        jsonDecode(await (bundle ?? rootBundle).loadString(asset))
            as Map<String, dynamic>,
      );

  final List<({String name, int ayat})> _surahs;
  final List<int> _starts;

  static List<int> _cumulative(List<({String name, int ayat})> s) {
    var n = 0;
    return [
      for (final x in s) (n += x.ayat) - x.ayat,
    ];
  }

  String surahName(int surah) => _surahs[_checkSurah(surah) - 1].name;

  int ayahCount(int surah) => _surahs[_checkSurah(surah) - 1].ayat;

  bool isValid(QuranRef r) =>
      r.surah >= 1 && r.surah <= 114 && r.ayah >= 1 && r.ayah <= ayahCount(r.surah);

  /// The global ayah number 1..6236 used by the reciter CDN.
  int globalNumber(QuranRef r) {
    if (!isValid(r)) throw RangeError('Invalid ayah reference ${r.key}');
    return _starts[r.surah - 1] + r.ayah;
  }

  static int _checkSurah(int s) =>
      (s >= 1 && s <= 114) ? s : throw RangeError('Invalid surah $s');
}
