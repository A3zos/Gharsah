import 'dart:convert';

import 'package:flutter/services.dart';

import 'quran_ref.dart';

/// Verified ayah text for the lesson surahs (`assets/data/quran_text.json`,
/// generated from Tanzil by tool/build_quran_text.py). Shown exactly as
/// stored — never edited, generated or fetched at runtime.
class QuranTextRepository {
  QuranTextRepository._(this._text, this.source);

  static const asset = 'assets/data/quran_text.json';

  factory QuranTextRepository.fromJson(Map<String, dynamic> j) =>
      QuranTextRepository._({
        for (final a in (j['ayat'] as List).cast<Map<String, dynamic>>())
          QuranRef(a['surah'] as int, a['ayah'] as int): a['text'] as String,
      }, j['source'] as String);

  static Future<QuranTextRepository> load([AssetBundle? bundle]) async =>
      QuranTextRepository.fromJson(
        jsonDecode(await (bundle ?? rootBundle).loadString(asset))
            as Map<String, dynamic>,
      );

  final Map<QuranRef, String> _text;
  final String source;

  bool has(QuranRef r) => _text.containsKey(r);

  /// Throws if the ayah isn't bundled — lessons may only use bundled surahs.
  String text(QuranRef r) =>
      _text[r] ?? (throw StateError('Ayah ${r.key} is not in the verified asset'));
}
