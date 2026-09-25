"""Rebuilds ../content/quran/quran_text.json — the verified Tanzil text of the lesson surahs.

Nothing is typed by hand: every text is taken verbatim from the downloaded Tanzil
file (only the basmala prefix Tanzil puts on ayah 1 of surahs other than 1 and 9
is removed — it is not part of the ayah in Hafs numbering).

  1. Download quran-uthmani.txt as described in tool/build_splash_ayat.py.
  2. python tool/build_quran_text.py path/to/quran-uthmani.txt ../content/quran/quran_text.json
  3. dart run tool/sync_content.dart   (mirror content/ into app/assets/)
"""
import hashlib, json, sys

SRC, OUT = sys.argv[1], sys.argv[2]
# Keep in sync with tool/build_quran_audio.py.
SURAHS = [1, 108, 111, 112, 113, 114]

verses = {}
for line in open(SRC, encoding='utf-8').read().splitlines():
    if not line or line.startswith('#'):
        continue
    s, a, t = line.split('|', 2)
    verses[(int(s), int(a))] = t
assert len(verses) == 6236
basmala = verses[(1, 1)]


def text(s, a):
    t = verses[(s, a)]
    if a == 1 and s not in (1, 9):
        assert t.startswith(basmala + ' '), 'expected Tanzil basmala prefix'
        t = t[len(basmala) + 1:]
    assert t in verses[(s, a)]
    return t


doc = {
    '_notice': 'Quran text copied programmatically from the Tanzil Project — do not edit by hand.',
    'source': 'Tanzil Quran Text (Uthmani, Version 1.1) — tanzil.net — CC BY 3.0',
    'sourceUrl': 'https://tanzil.net/download/',
    'sourceSha256': hashlib.sha256(open(SRC, 'rb').read()).hexdigest(),
    'ayat': [
        {'surah': s, 'ayah': a, 'text': text(s, a)}
        for s in SURAHS
        for a in range(1, 1 + max(x for (ss, x) in verses if ss == s))
    ],
}
json.dump(doc, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('wrote', OUT, len(doc['ayat']), 'ayat')
