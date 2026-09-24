# usage: compare.py design.png app.png out.png title
import sys
from PIL import Image, ImageDraw, ImageFont
d, a, out, title = sys.argv[1:5]
D = Image.open(d).convert('RGB'); A = Image.open(a).convert('RGB')
A = A.resize((D.width, int(A.height * D.width / A.width)))
H = max(D.height, A.height); pad = 40; top = 90
im = Image.new('RGB', (D.width * 2 + pad * 3, H + top + pad), (60, 60, 60))
im.paste(D, (pad, top)); im.paste(A, (D.width + pad * 2, top))
f = ImageFont.truetype('arial.ttf', 40)
dr = ImageDraw.Draw(im)
dr.text((pad, 25), f'DESIGN  {title}', fill='white', font=f)
dr.text((D.width + pad * 2, 25), 'APP (Flutter web, 390x844)', fill='white', font=f)
im.save(out); print(out)
