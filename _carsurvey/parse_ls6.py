# -*- coding: utf-8 -*-
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = r"C:\Users\chunsheng\Desktop\S59\AI场景\AI1\_carsurvey\ls6m2.html"
s = open(p, encoding='utf-8').read()
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', s, re.S)
d = json.loads(m.group(1))
blocks = d['props']['pageProps']['data']['blocks']
print("blocks:", len(blocks))
for i, b in enumerate(blocks):
    v = b.get('value', {}) or {}
    print(i, b.get('type'), '|', v.get('title') or v.get('name') or '', '|', list(v.keys())[:15])
