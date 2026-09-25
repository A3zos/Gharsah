import 'package:flutter/material.dart';

import '../features/quran/data/quran_ref.dart';
import '../features/splash/data/splash_ayat_repository.dart';
import '../theme/app_theme.dart';
import 'app_content.dart';
import 'arabic_digits.dart';

/// Debug-only (`screen=font-check`): every splash ayah and every ayah of
/// Al-Ikhlas in the real ayah styles, to check Amiri Quran's Uthmani shaping
/// (ٱ, dotless ى, small waqf / iqlab marks) on a device. Not a product screen.
class DebugFontCheck extends StatelessWidget {
  const DebugFontCheck({super.key, required this.content});

  final AppContent content;

  @override
  Widget build(BuildContext context) {
    Widget ayah(String text, String ref, {bool lesson = false}) => Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        children: [
          Text.rich(
            TextSpan(
              style: lesson ? LessonText.ayah : AppTextStyles.ayah,
              children: [
                TextSpan(
                  text: '﴿',
                  style: lesson
                      ? LessonText.ayahBracket
                      : AppTextStyles.ayahBracket,
                ),
                TextSpan(text: ' $text '),
                TextSpan(
                  text: '﴾',
                  style: lesson
                      ? LessonText.ayahBracket
                      : AppTextStyles.ayahBracket,
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
          Text(ref, style: AppTextStyles.ayahRef),
        ],
      ),
    );

    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<List<SplashAyah>>(
          future: const SplashAyatRepository().loadAll(),
          builder: (context, snap) => ListView(
            padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 12),
            children: [
              for (final a in snap.data ?? const <SplashAyah>[])
                ayah(a.text, a.reference),
              for (var i = 1; i <= 4; i++)
                ayah(
                  content.text.text(QuranRef(112, i)),
                  'سورة الإخلاص · ${i.arabicDigits}',
                  lesson: true,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
