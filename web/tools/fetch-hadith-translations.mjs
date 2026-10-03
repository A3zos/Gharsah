// Fetches hadith translations (en / id) VERBATIM from HadeethEnc (https://hadeethenc.com) —
// never written or edited by us or by any AI. Which HadeethEnc entry matches each of our
// hadiths is a Sharia reviewer's decision: set `hadeethencId` for that hadith in
// content/hadith/translations.json (together with approving the Arabic text in
// content/hadith/hadith.json), then run from web/:
//   node tools/fetch-hadith-translations.mjs
// Hadiths without a hadeethencId are left untouched (nothing is guessed). The app shows a
// translation only under an approved, displayed Arabic hadith.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '../../content/hadith/translations.json');
const data = JSON.parse(readFileSync(file, 'utf8'));

for (const [hadithId, entry] of Object.entries(data.hadith)) {
  if (!entry.hadeethencId) {
    console.log(`${hadithId}: no hadeethencId yet — skipped`);
    continue;
  }
  for (const lang of ['en', 'id']) {
    const url = `https://hadeethenc.com/api/v1/hadeeths/one/?language=${lang}&id=${entry.hadeethencId}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${hadithId} ${lang}: HTTP ${r.status}`);
    const j = await r.json();
    entry[lang] = {
      title: j.title ?? null,
      hadeeth: j.hadeeth ?? null,
      attribution: j.attribution ?? null,
      grade: j.grade ?? null,
      sourceUrl: `https://hadeethenc.com/${lang}/browse/hadith/${entry.hadeethencId}`,
      fetchedAt: new Date().toISOString().slice(0, 10),
    };
    console.log(`${hadithId} ${lang}: «${String(j.title).slice(0, 60)}»`);
  }
}
writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
