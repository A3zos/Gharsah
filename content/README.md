# content/ — verified content (single source of truth)

Shared by the Flutter app (`app/`) and the web app (`web/`). **Never type, retype, generate or
"fix" Quran or hadith text by hand** — every file here is produced by a builder script from a
verified source.

| Path | What | Built by (from `app/`) |
|---|---|---|
| `quran/quran_text.json` | Tanzil Uthmani text (Hafs) of the lesson surahs | `python tool/build_quran_text.py` |
| `quran/quran_meta.json` | Surah names + ayah counts (Tanzil metadata) | `python tool/build_quran_meta.py` |
| `quran/splash_ayat.json` | The splash ayat (Tanzil, verbatim-checked) | `python tool/build_splash_ayat.py` |
| `audio/quran/SSSAAA.mp3` + `manifest.json` | Alafasy per-ayah recitation, sha256 + duration; `urlPattern` for other surahs | `python tool/build_quran_audio.py` |
| `hadith/hadith.json` | Hadith entries — placeholder until vetted (`approved: false`) | by hand, **only** from a vetted source with takhrij + reviewer |
| `projects/projects.json` | Weekly practical projects | by hand (reviewed copy) |
| `lessons/*.json` | Lesson scripts in the `ai/CONTRACT.md` format | by hand / AI developer |

## How each app reads it

- **Flutter** can only bundle assets inside `app/`, so `content/` is mirrored into `app/assets/`
  (committed) by `dart run tool/sync_content.dart` (from `app/`), following `sync-map.json`.
  `flutter test` (`test/content_drift_test.dart`) fails if the two ever differ.
  Edit here, then sync — never edit `app/assets/{data,lessons,audio/quran}` directly.
- **Web** imports the JSON directly and copies `audio/quran/` into its build.

Licences: Quran text — Tanzil Project (CC BY 3.0, attribution required). Recitation — Mishary
Alafasy via islamic.network (usage terms to confirm before release; see CLAUDE.md §11).
