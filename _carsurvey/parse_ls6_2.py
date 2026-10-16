# -*- coding: utf-8 -*-
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = r"C:\Users\chunsheng\Desktop\S59\AI场景\AI1\_carsurvey\ls6m2.html"
s = open(p, encoding='utf-8').read()
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', s, re.S)
d = json.loads(m.group(1))
b = d['props']['pageProps']['data']['blocks'][3]
v = b['value']
print("carType:", v.get('carType'))
tc = v['tabConfig']
print("tabConfig type:", type(tc))
if isinstance(tc, list):
    for t in tc:
        print("TAB keys:", list(t.keys()))
        print("  name/title:", t.get('name'), t.get('title'), t.get('label'))
else:
    print(json.dumps(tc, ensure_ascii=False)[:2000])
