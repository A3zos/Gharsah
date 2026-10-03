// Fetches the ayah translations shown under the Arabic in English / Indonesian, VERBATIM,
// from QuranEnc (https://quranenc.com) — never written or edited by us or by any AI.
//   en: english_saheeh (Saheeh International, revised by Noor International Center)
//   id: indonesian_affairs (Ministry of Religious Affairs, Indonesia)
// Output: content/quran/translations/{en,id}.json (not mirrored to the Flutter app).
// Run from web/:  node tools/fetch-quran-translations.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SURAHS = [1, 112, 113, 114]; // the lesson / catalogue surahs (content/lessons, pilot)
const SOURCES = {
  en: { key: 'english_saheeh' },
  id: { key: 'indonesian_affairs' },
};
const out = join(dirname(fileURLToPath(import.meta.url)), '../../content/quran/translations');

const list = await (await fetch('https://quranenc.com/api/v1/translations/list')).json();
mkdirSync(out, { recursive: true });
for (const [lang, { key }] of Object.entries(SOURCES)) {
  const meta = list.translations.find((t) => t.key === key);
  if (!meta) throw new Error(`QuranEnc has no translation «${key}»`);
  const ayat = {};
  for (const s of SURAHS) {
    const r = await fetch(`https://quranenc.com/api/v1/translation/sura/${key}/${s}`);
    if (!r.ok) throw new Error(`${key} ${s}: HTTP ${r.status}`);
    for (const a of (await r.json()).result) {
      ayat[`${a.sura}:${a.aya}`] = { translation: a.translation, footnotes: a.footnotes || null };
    }
  }
  const file = {
    _notice:
      'Copied programmatically from QuranEnc — do not edit by hand. Re-run web/tools/fetch-quran-translations.mjs.',
    source: `QuranEnc — ${meta.title}`,
    sourceUrl: `https://quranenc.com/en/browse/${key}`,
    key,
    version: meta.version,
    fetchedAt: new Date().toISOString().slice(0, 10),
    surahs: SURAHS,
    ayat,
  };
  writeFileSync(join(out, `${lang}.json`), `${JSON.stringify(file, null, 2)}\n`);
  console.log(lang, key, meta.version, Object.keys(ayat).length, 'ayat');
}
