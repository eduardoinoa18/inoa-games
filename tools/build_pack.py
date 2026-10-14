#!/usr/bin/env python3
# usage (from repo root): python3 tools/build_pack.py <name> --models a b c --hdri dawn sunset
import json, base64, os, sys
args = sys.argv[1:]; name = args[0]; models, hdri, cur = [], [], None
for a in args[1:]:
    if a == '--models': cur = models; continue
    if a == '--hdri': cur = hdri; continue
    cur.append(a)
root = os.path.dirname(os.path.abspath(__file__)) + '/../assets'
pack = {'models': {}, 'hdri': {}}
for m in models:
    p = f'{root}/models/{m}.glb'
    if not os.path.exists(p): print('MISSING model', m); continue
    pack['models'][m] = base64.b64encode(open(p, 'rb').read()).decode()
for h in hdri:
    pack['hdri'][h] = base64.b64encode(open(f'{root}/hdri/{h}.hdr', 'rb').read()).decode()
out = os.path.dirname(os.path.abspath(__file__)) + f'/../packs/{name}.json'
json.dump(pack, open(out, 'w'), separators=(',', ':'))
print(name, len(pack['models']), 'models', len(pack['hdri']), 'hdri', round(os.path.getsize(out) / 1e6, 2), 'MB')
