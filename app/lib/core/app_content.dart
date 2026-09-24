import '../features/lesson/data/hadith_repository.dart';
import '../features/lesson/data/project_repository.dart';
import '../features/quran/data/quran_audio_repository.dart';
import '../features/quran/data/quran_ref.dart';
import '../features/quran/data/quran_text_repository.dart';

/// Verified local content, loaded once at startup (all bundled assets —
/// nothing religious is fetched or generated at runtime).
class AppContent {
  const AppContent({
    required this.meta,
    required this.text,
    required this.manifest,
    required this.hadith,
    required this.projects,
  });

  static Future<AppContent> load() async {
    final r = await Future.wait<Object>([
      QuranMeta.load(),
      QuranTextRepository.load(),
      RecitationManifest.load(),
      HadithRepository.load(),
      ProjectRepository.load(),
    ]);
    return AppContent(
      meta: r[0] as QuranMeta,
      text: r[1] as QuranTextRepository,
      manifest: r[2] as RecitationManifest,
      hadith: r[3] as HadithRepository,
      projects: r[4] as ProjectRepository,
    );
  }

  final QuranMeta meta;
  final QuranTextRepository text;
  final RecitationManifest manifest;
  final HadithRepository hadith;
  final ProjectRepository projects;
}
