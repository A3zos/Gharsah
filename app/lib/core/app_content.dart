import '../features/dashboard/data/plan_progress.dart';
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
    required this.pilot,
  });

  static Future<AppContent> load() async {
    final r = await Future.wait<Object>([
      QuranMeta.load(),
      QuranTextRepository.load(),
      RecitationManifest.load(),
      HadithRepository.load(),
      ProjectRepository.load(),
    ]);
    final meta = r[0] as QuranMeta;
    final hadith = r[3] as HadithRepository;
    return AppContent(
      meta: meta,
      text: r[1] as QuranTextRepository,
      manifest: r[2] as RecitationManifest,
      hadith: hadith,
      projects: r[4] as ProjectRepository,
      pilot: await Plan.loadPilot(meta, hadith),
    );
  }

  final QuranMeta meta;
  final QuranTextRepository text;
  final RecitationManifest manifest;
  final HadithRepository hadith;
  final ProjectRepository projects;

  /// The pilot plan's steps (the parent dashboard's plan timeline).
  final Plan pilot;
}
