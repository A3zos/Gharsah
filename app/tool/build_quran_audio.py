"""Downloads the reciter audio for the bundled surahs into ../content/audio/quran/ (then run tool/sync_content.dart).

Audio ONLY comes from the API — Quran text is the Tanzil asset, never fetched.
Source: Mishary Alafasy, Hafs 'an 'Asim, 128 kbps, islamic.network CDN, per ayah,
addressed by the global ayah number computed from ../content/quran/quran_meta.json.

  python tool/build_quran_audio.py            (run from app/)

Writes ../content/audio/quran/SSSAAA.mp3 + manifest.json (sha256 + durationMs per file).
The app's QuranAudioRepository verifies bundled files against the manifest and
uses the same URL pattern + sha256 check for surahs that aren't bundled.
"""
import hashlib, json, os, struct, sys, time, urllib.request

META = '../content/quran/quran_meta.json'
OUT = '../content/audio/quran'
# Keep in sync with tool/build_quran_text.py.
SURAHS = [1, 108, 111, 112, 113, 114]
URL = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/{n}.mp3'

meta = json.load(open(META, encoding='utf-8'))
counts = [s['ayat'] for s in meta['surahs']]


def global_number(surah, ayah):
    assert 1 <= surah <= 114 and 1 <= ayah <= counts[surah - 1]
    return sum(counts[:surah - 1]) + ayah


assert global_number(1, 1) == 1 and global_number(2, 1) == 8
assert global_number(112, 1) == 6222 and global_number(114, 6) == 6236

# --- MP3 duration: walk the MPEG audio frames (no external library) ----------
BITRATES = {  # (version_id, layer) -> kbps table; version 3 = MPEG1, else MPEG2/2.5
    (3, 1): [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    (2, 1): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
RATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}


def duration_ms(data):
    i = 0
    if data[:3] == b'ID3':  # skip ID3v2 tag (syncsafe size)
        size = 0
        for b in data[6:10]:
            size = (size << 7) | (b & 0x7F)
        i = 10 + size
    samples = 0
    rate = None
    frames = 0
    while i + 4 <= len(data):
        h = struct.unpack('>I', data[i:i + 4])[0]
        if (h >> 21) & 0x7FF != 0x7FF:
            i += 1
            continue
        ver = (h >> 19) & 3
        layer = (h >> 17) & 3
        br_i = (h >> 12) & 0xF
        sr_i = (h >> 10) & 3
        pad = (h >> 9) & 1
        if ver == 1 or layer != 1 or br_i in (0, 15) or sr_i == 3:
            i += 1
            continue
        br = BITRATES[(3 if ver == 3 else 2, 1)][br_i] * 1000
        sr = RATES[ver][sr_i]
        spf = 1152 if ver == 3 else 576
        size = (144 if ver == 3 else 72) * br // sr + pad
        samples += spf
        rate = sr
        frames += 1
        i += size
    assert frames > 10, 'not an MP3'
    return round(samples * 1000 / rate)


def fetch(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                assert r.status == 200
                return r.read()
        except Exception as e:  # noqa: BLE001
            print('  retry', attempt + 1, e)
            time.sleep(2)
    sys.exit('failed: ' + url)


os.makedirs(OUT, exist_ok=True)
files = []
for s in SURAHS:
    for a in range(1, counts[s - 1] + 1):
        n = global_number(s, a)
        name = f'{s:03d}{a:03d}.mp3'
        path = os.path.join(OUT, name)
        if os.path.exists(path):
            data = open(path, 'rb').read()
        else:
            data = fetch(URL.format(n=n))
            open(path, 'wb').write(data)
        files.append({
            'surah': s, 'ayah': a, 'global': n, 'file': name,
            'sha256': hashlib.sha256(data).hexdigest(),
            'bytes': len(data),
            'durationMs': duration_ms(data),
        })
        print(name, n, files[-1]['durationMs'], 'ms')

manifest = {
    'reciter': 'Mishary Rashid Alafasy',
    'reciterId': 'ar.alafasy',
    'riwaya': 'Hafs an Asim',
    'bitrateKbps': 128,
    'source': 'islamic.network CDN (AlQuran Cloud)',
    'urlPattern': URL.replace('{n}', '{global}'),
    'files': files,
}
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('wrote', len(files), 'files')
