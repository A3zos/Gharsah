import 'dart:convert';

import 'package:flutter/services.dart';

/// A hadith entry from `assets/data/hadith.json`.
///
/// Guardrail (ai/GUARDRAILS.md §1.3): until a sharia reviewer approves an
/// entry — text, takhrij, grading, source, reviewer and audio all present —
/// the app shows the fixed placeholder and plays nothing. Approving an entry
/// in the data makes it display and play with no code change.
class Hadith {
  const Hadith._({
    required this.id,
    required this.title,
    required this.isApproved,
    required String? text,
    required String? takhrij,
    this.audioAsset,
  }) : _text = text, // ignore: prefer_initializing_formals
       _takhrij = takhrij; // ignore: prefer_initializing_formals

  factory Hadith.fromJson(Map<String, dynamic> j) {
    String? str(String k) {
      final v = j[k];
      return v is String && v.trim().isNotEmpty ? v : null;
    }

    final complete = [
      'text',
      'takhrij',
      'grading',
      'source',
      'reviewedBy',
      'audio',
    ].every((k) => str(k) != null);
    final approved = j['approved'] == true && complete;
    return Hadith._(
      id: j['id'] as String,
      title: j['title'] as String,
      isApproved: approved,
      text: approved ? str('text') : null,
      takhrij: approved ? '${str('takhrij')} · ${str('grading')}' : null,
      audioAsset: approved ? str('audio') : null,
    );
  }

  static const placeholderText =
      '[نص حديث برّ الوالدين — يُعتمد لاحقًا من مصدر موثّق مع التخريج]';
  static const placeholderTakhrij = '[التخريج والدرجة — يُعتمد لاحقًا]';

  final String id;

  /// Topic title, e.g. «حديث برّ الوالدين» (not hadith text).
  final String title;
  final bool isApproved;
  final String? _text;
  final String? _takhrij;

  /// Asset path relative to `assets/` — only for approved entries.
  final String? audioAsset;

  String get displayText => isApproved ? _text! : placeholderText;
  String get displayTakhrij => isApproved ? _takhrij! : placeholderTakhrij;

  /// The lesson plays audio automatically only for an approved hadith.
  bool get canPlay => isApproved && audioAsset != null;
}

class HadithRepository {
  HadithRepository(Iterable<Hadith> all) : _byId = {for (final h in all) h.id: h};

  static const asset = 'assets/data/hadith.json';

  factory HadithRepository.fromJson(Map<String, dynamic> j) => HadithRepository([
    for (final h in (j['hadith'] as List).cast<Map<String, dynamic>>())
      Hadith.fromJson(h),
  ]);

  static Future<HadithRepository> load([AssetBundle? bundle]) async =>
      HadithRepository.fromJson(
        jsonDecode(await (bundle ?? rootBundle).loadString(asset))
            as Map<String, dynamic>,
      );

  final Map<String, Hadith> _byId;

  Hadith byId(String id) =>
      _byId[id] ?? (throw StateError('Unknown hadith id $id'));
}
