#!/usr/bin/env python3
# usage (from repo root): python3 tools/make_thumb.py <game-file-id> <screenshot.png> [crop: x y w h]
import sys
from PIL import Image
gid, src = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
if len(sys.argv) > 6: x, y, w, h = map(int, sys.argv[3:7]); im = im.crop((x, y, x + w, y + h))
# cover-crop to 16:9 then 640x360
W, H = im.size; r = 16 / 9
if W / H > r: nw = int(H * r); im = im.crop(((W - nw) // 2, 0, (W - nw) // 2 + nw, H))
else: nh = int(W / r); im = im.crop((0, (H - nh) // 2, W, (H - nh) // 2 + nh))
im.resize((640, 360), Image.LANCZOS).save(f'thumbs/{gid}.jpg', quality=84, optimize=True)
print('thumbs/' + gid + '.jpg')
