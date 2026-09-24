import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gharsah/features/lesson/ai/ai_teacher.dart';
import 'package:gharsah/features/lesson/ai/teacher_lines.dart';
import 'package:gharsah/features/lesson/data/hadith_repository.dart';
import 'package:gharsah/features/lesson/data/lesson_script.dart';
import 'package:gharsah/features/quran/data/quran_ref.dart';

import 'fakes.dart';

void main() {
  const bank = TeacherLineBank();
  final meta = QuranMeta.fromJson(readJson(QuranMeta.asset));

  test('every lesson script parses, validates and uses known lines', () {
    for (final f in Directory('assets/lessons').listSync().whereType<File>()) {
      final script = LessonScript.fromJson(readJson(f.path));
      script.validate(meta);
      for (final s in script.steps) {
        final ids = switch (s) {
          IntroStep(:final lines) => lines,
          SurahDoneStep(:final lines, :final question) => [...lines, question],
          ProjectAssignStep(:final lines, :final question) => [...lines, question],
          ProjectReportStep(:final question) => [question],
          LessonEndStep(:final lines, :final question) => [
            ...lines,
            ?question,
          ],
          _ => const <String>[],
        };
        for (final id in ids) {
          final known = id == 'greet' || bank.has(id);
          expect(known, isTrue, reason: '${f.path}: $id');
        }
      }
    }
  });

  test('day-2 script is clearly marked interim', () {
    expect(loadScript('m01-w03-day2').interim, isTrue);
    expect(loadScript('m01-w03-ikhlas').interim, isFalse);
  });

  test('no line states Makki/Madani or contains Quran/hadith text', () {
    final all = [...TeacherLineBank.lines.values, ...TeacherLineBank.captions.values];
    for (final t in all) {
      expect(t.contains('مكّية') || t.contains('مكية') || t.contains('مدنية'),
          isFalse, reason: t);
      expect(t.contains('﴿') || t.contains('«'), isFalse, reason: t);
    }
  });

  test('line bank fills slots and refuses unknown ids / missing slots', () {
    expect(
      bank.resolve(const TeacherLine('praise.first', {'name': 'سارة', 'ordinal': 'الثانية'})),
      'أحسنت يا سارة… ننتقل للآية الثانية.',
    );
    expect(() => bank.resolve(const TeacherLine('nope')), throwsArgumentError);
    expect(() => bank.resolve(const TeacherLine('praise.first')), throwsArgumentError);
    expect(TeacherLineBank.ayatInWords(4), 'أربع آيات');
    expect(TeacherLineBank.ayatInWords(286), '٢٨٦ آية');
    expect(TeacherLineBank.ordinal(3), 'الثالثة');
  });

  group('hadith approval gate', () {
    Map<String, dynamic> entry([Map<String, dynamic> over = const {}]) => {
      'id': 'h1',
      'title': 'حديث برّ الوالدين',
      'approved': true,
      'text': 'T',
      'takhrij': 'K',
      'grading': 'G',
      'source': 'S',
      'reviewedBy': 'R',
      'audio': 'audio/hadith/h1.mp3',
      ...over,
    };

    test('the shipped entry is the unapproved placeholder', () {
      final h = HadithRepository.fromJson(readJson(HadithRepository.asset))
          .byId('PLACEHOLDER-birr-alwalidayn');
      expect(h.isApproved, isFalse);
      expect(h.canPlay, isFalse);
      expect(h.displayText, Hadith.placeholderText);
      expect(h.displayTakhrij, Hadith.placeholderTakhrij);
    });

    test('a fully approved entry displays and plays', () {
      final h = Hadith.fromJson(entry());
      expect(h.isApproved, isTrue);
      expect(h.canPlay, isTrue);
      expect(h.displayText, 'T');
      expect(h.displayTakhrij, 'K · G');
    });

    for (final missing in ['text', 'takhrij', 'grading', 'source', 'reviewedBy', 'audio']) {
      test('approved but missing $missing → placeholder, silent', () {
        final h = Hadith.fromJson(entry({missing: null}));
        expect(h.isApproved, isFalse);
        expect(h.canPlay, isFalse);
        expect(h.displayText, Hadith.placeholderText);
      });
    }

    test('not approved → placeholder even if text is present', () {
      final h = Hadith.fromJson(entry({'approved': false}));
      expect(h.displayText, Hadith.placeholderText);
      expect(h.canPlay, isFalse);
    });
  });
}
