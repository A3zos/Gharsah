"""Rebuilds assets/data/quran_meta.json (surah names + ayah counts) from Tanzil metadata.

Used by the app to turn surah:ayah into the global ayah number (1..6236) for the
reciter audio. Nothing is typed by hand. Deliberately does NOT copy the
Meccan/Medinan column (scholars differ for some surahs — see ai/GUARDRAILS.md §4).

  1. Download https://tanzil.net/res/text/metadata/quran-data.js (CC BY 3.0)
  2. python tool/build_quran_meta.py path/to/quran-data.js assets/data/quran_meta.json
"""
import hashlib, json, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
raw = open(SRC, encoding='utf-8').read()
block = raw[raw.index('QuranData.Sura = ['):]
rows = re.findall(r"^\s*\[(\d+), (\d+), (\d+), (\d+), '([^']+)'", block, re.M)
assert len(rows) == 114, len(rows)
surahs = []
start = 0
for i, r in enumerate(rows):
    s_start, count, name = int(r[0]), int(r[1]), r[4]
    assert s_start == start, (i + 1, s_start, start)  # starts are cumulative
    surahs.append({'surah': i + 1, 'name': name, 'ayat': count})
    start += count
assert start == 6236
assert surahs[0]['name'] == 'الفاتحة' and surahs[0]['ayat'] == 7
assert surahs[111]['ayat'] == 4 and surahs[113]['ayat'] == 6

doc = {
    '_notice': 'Generated from Tanzil Quran metadata — do not edit by hand. '
               'Makki/Madani intentionally omitted (not stated until a verified dataset exists).',
    'source': 'Tanzil Quran Metadata 1.0 — tanzil.net — CC BY 3.0',
    'sourceUrl': 'https://tanzil.net/res/text/metadata/quran-data.js',
    'sourceSha256': hashlib.sha256(open(SRC, 'rb').read()).hexdigest(),
    'totalAyat': 6236,
    'surahs': surahs,
}
json.dump(doc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', OUT)
