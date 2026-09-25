"""Rebuilds ../content/quran/splash_ayat.json from the Tanzil Project's verified text.

Nothing is typed by hand: every saved text is asserted to be a verbatim substring
of the downloaded Tanzil ayah.

  1. Download (agree to Tanzil's terms) into a folder, e.g. build/tanzil/:
     - https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=false&alef=false&quranType=uthmani&outType=txt-2&agree=true
       -> quran-uthmani.txt   (format: sura|aya|text)
     - https://tanzil.net/res/text/metadata/quran-data.js -> quran-data.js
  2. python tool/build_splash_ayat.py build/tanzil ../content/quran/splash_ayat.json
  3. dart run tool/sync_content.dart   (mirror content/ into app/assets/)
"""
import json, re, sys, hashlib
S = sys.argv[1]; OUT = sys.argv[2]
raw = open(f'{S}/quran-uthmani.txt', encoding='utf-8').read()
verses = {}
for line in raw.splitlines():
    if not line or line.startswith('#'): continue
    s, a, t = line.split('|', 2); verses[(int(s), int(a))] = t
assert len(verses) == 6236
# Surah names from Tanzil metadata (index = surah number; entry 0 is empty).
meta = open(f'{S}/quran-data.js', encoding='utf-8').read()
block = meta[meta.index('QuranData.Sura = ['):]
rows = re.findall(r"^\s*\[(\d+), (\d+), (\d+), (\d+), '([^']+)'", block, re.M)
names = {i + 1: r[4] for i, r in enumerate(rows)}
assert names[1] == 'الفاتحة' and len(names) == 114
for n in (96, 20, 17, 54): assert int(rows[n-1][1]) >= {96:1,20:114,17:9,54:17}[n]

basmala = verses[(1, 1)]
def full(s, a):
    t = verses[(s, a)]
    if a == 1 and s not in (1, 9):
        assert t.startswith(basmala + ' '), 'expected Tanzil basmala prefix'
        t = t[len(basmala) + 1:]
    return t
def after_last_mark(s, a, mark):
    t = full(s, a); i = t.rindex(mark)
    ex = t[i + len(mark):].strip()
    assert t.endswith(ex); return ex

SRC = 'Tanzil Quran Text (Uthmani, Version 1.1) — tanzil.net — CC BY 3.0'
entries = [
  dict(surah=96, ayah=1, text=full(96, 1), isExcerpt=False),
  dict(surah=20, ayah=114, text=after_last_mark(20, 114, 'ۖ'), isExcerpt=True),
  dict(surah=17, ayah=9, text=full(17, 9), isExcerpt=False),
  dict(surah=54, ayah=17, text=full(54, 17), isExcerpt=False),
]
for e in entries:
    e['surahName'] = names[e['surah']]
    e['source'] = SRC
    # Every saved text must be a verbatim substring of the downloaded verse.
    assert e['text'] in verses[(e['surah'], e['ayah'])]
doc = {
  '_notice': 'Quran text copied programmatically from the Tanzil Project — do not edit by hand. '
             'Basmala prefix removed from ayah 1 (not part of the ayah in Hafs numbering). '
             'Excerpts are cut only at a waqf mark present in the source.',
  'sourceUrl': 'https://tanzil.net/download/',
  'sourceSha256': hashlib.sha256(open(f'{S}/quran-uthmani.txt','rb').read()).hexdigest(),
  'ayat': [{k: e[k] for k in ('surah','surahName','ayah','text','isExcerpt','source')} for e in entries],
}
json.dump(doc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok')
