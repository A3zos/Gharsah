import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/quran/data/quran_audio_repository.dart';
import 'package:gharsah/features/quran/data/quran_ref.dart';
import 'package:gharsah/features/quran/data/quran_text_repository.dart';

Map<String, dynamic> _json(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

void main() {
  final meta = QuranMeta.fromJson(_json(QuranMeta.asset));
  final manifest = RecitationManifest.fromJson(_json(RecitationManifest.asset));
  final text = QuranTextRepository.fromJson(_json(QuranTextRepository.asset));

  group('global ayah number', () {
    test('known anchors', () {
      expect(meta.globalNumber(const QuranRef(1, 1)), 1);
      expect(meta.globalNumber(const QuranRef(2, 1)), 8);
      expect(meta.globalNumber(const QuranRef(112, 1)), 6222);
      expect(meta.globalNumber(const QuranRef(114, 6)), 6236);
    });

    test('rejects refs outside the mushaf', () {
      for (final r in const [
        QuranRef(0, 1),
        QuranRef(1, 0),
        QuranRef(1, 8),
        QuranRef(112, 5),
        QuranRef(115, 1),
      ]) {
        expect(() => meta.globalNumber(r), throwsRangeError, reason: r.key);
      }
    });

    test('is a bijection over all 6236 ayat', () {
      var expected = 1;
      for (var s = 1; s <= 114; s++) {
        for (var a = 1; a <= meta.ayahCount(s); a++) {
          expect(meta.globalNumber(QuranRef(s, a)), expected++);
        }
      }
      expect(expected - 1, QuranMeta.totalAyat);
    });

    test('meta holds names + counts only (no Makki/Madani)', () {
      final raw = File(QuranMeta.asset).readAsStringSync();
      expect(raw.contains('Meccan'), isFalse);
      expect(raw.contains('Medinan'), isFalse);
      expect(meta.surahName(112), 'الإخلاص');
      expect(meta.ayahCount(112), 4);
    });
  });

  group('bundled reciter audio', () {
    const bundledSurahs = [1, 108, 111, 112, 113, 114];

    test('manifest covers every ayah of the bundled surahs', () {
      final expected = {
        for (final s in bundledSurahs)
          for (var a = 1; a <= meta.ayahCount(s); a++) QuranRef(s, a),
      };
      expect(manifest.bundled.keys.toSet(), expected);
      expect(manifest.reciterId, 'ar.alafasy');
      expect(manifest.riwaya, contains('Hafs'));
    });

    test('every bundled file exists and matches its sha256', () {
      for (final b in manifest.bundled.values) {
        final f = File('${RecitationManifest.dir}/${b.file}');
        expect(f.existsSync(), isTrue, reason: b.file);
        expect(
          sha256.convert(f.readAsBytesSync()).toString(),
          b.sha256,
          reason: b.file,
        );
        expect(b.file, b.ref.audioFileName);
        expect(b.duration.inMilliseconds, greaterThan(1000), reason: b.file);
      }
    });

    test('manifest global numbers agree with the meta', () {
      for (final f
          in (_json(RecitationManifest.asset)['files'] as List)
              .cast<Map<String, dynamic>>()) {
        final r = QuranRef(f['surah'] as int, f['ayah'] as int);
        expect(f['global'], meta.globalNumber(r), reason: r.key);
      }
    });
  });

  group('verified text', () {
    test('lesson surahs are present, ayah 1 has no basmala prefix', () {
      for (var a = 1; a <= 4; a++) {
        expect(text.has(QuranRef(112, a)), isTrue);
      }
      final basmala = text.text(const QuranRef(1, 1));
      expect(text.text(const QuranRef(112, 1)).startsWith(basmala), isFalse);
      expect(() => text.text(const QuranRef(2, 1)), throwsStateError);
    });

    test('text and audio cover the same ayat', () {
      for (final r in manifest.bundled.keys) {
        expect(text.has(r), isTrue, reason: r.key);
      }
    });
  });
}
