-- The lesson catalogue (names + refs only — no Quran or hadith text), from content/.
-- Idempotent (insert … on conflict do update): safe to re-run; it was first applied
-- by hand on the remote project. seed.sql carries the same rows for local stacks.
-- Future catalogue changes: a NEW migration (applied migrations never change).
insert into public.lessons (lesson_id, kind, ref, title, hadith_id, project_id, available, sort_order) values
  ('m01-w03-ikhlas', 'surah', '112', 'سورة الإخلاص + حديث برّ الوالدين', 'PLACEHOLDER-birr-alwalidayn', 'birr-3-acts', true, 10),
  ('m01-w03-day2', 'hadith', 'PLACEHOLDER-birr-alwalidayn', 'تقرير المشروع + حديث اليوم', 'PLACEHOLDER-birr-alwalidayn', 'birr-3-acts', true, 20),
  ('surah-113', 'surah', '113', 'سورة الفلق', null, null, false, 30),
  ('surah-114', 'surah', '114', 'سورة الناس', null, null, false, 40),
  ('hadith-birr-alwalidayn', 'hadith', 'PLACEHOLDER-birr-alwalidayn', 'حديث برّ الوالدين', 'PLACEHOLDER-birr-alwalidayn', null, false, 50),
  ('hadith-al-kadhib', 'hadith', 'PLACEHOLDER-al-kadhib', 'حديث عن الكذب', 'PLACEHOLDER-al-kadhib', null, false, 60),
  ('hadith-al-ghadab', 'hadith', 'PLACEHOLDER-al-ghadab', 'حديث عن الغضب', 'PLACEHOLDER-al-ghadab', null, false, 70),
  ('weekly-review', 'review', 'weekly', 'المراجعة الأسبوعية', null, null, false, 80)
on conflict (lesson_id) do update set
  kind = excluded.kind,
  ref = excluded.ref,
  title = excluded.title,
  hadith_id = excluded.hadith_id,
  project_id = excluded.project_id,
  available = excluded.available,
  sort_order = excluded.sort_order;
