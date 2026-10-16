# -*- coding: utf-8 -*-
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = r"C:\Users\chunsheng\Desktop\S59\AI场景\AI1\_carsurvey\ls6m2.html"
s = open(p, encoding='utf-8').read()
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', s, re.S)
d = json.loads(m.group(1))
tc = d['props']['pageProps']['data']['blocks'][3]['value']['tabConfig']
ev = tc[1]['value']
print("pure ev value type:", type(ev))
print(json.dumps(ev, ensure_ascii=False)[:1500])
