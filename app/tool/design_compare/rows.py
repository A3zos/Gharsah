# prints vertical bands (in CSS px) that contain "ink" (pixels far from the local background) in the central column
import sys
from PIL import Image
def bands(path, x0=100, x1=680):
    im = Image.open(path).convert('RGB'); w, h = im.size; px = im.load()
    rows = []
    for y in range(h):
        ink = 0
        for x in range(x0, x1, 2):
            r, g, b = px[x, y]
            if (r + g + b) < 560 and not (abs(r-g) < 12 and abs(g-b) < 25 and r > 200): ink += 1
        rows.append(ink > 1)
    out, start = [], None
    for y, v in enumerate(rows + [False]):
        if v and start is None: start = y
        if not v and start is not None:
            if y - start > 2: out.append((round(start/2,1), round(y/2,1)))
            start = None
    return out
import os
for p in sys.argv[1:]: print(os.path.basename(p), bands(p))
