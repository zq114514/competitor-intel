# -*- coding: utf-8 -*-
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')
p = r"C:\Users\chunsheng\Desktop\S59\AI场景\AI1\_carsurvey\ls6m2.html"
s = open(p, encoding='utf-8').read()
for kw in ['Pro Max', 'Ultra', '76', '93', '103', '650', '782']:
    print(kw, s.count(kw))
# print full tabConfig object and commonConfigTable value keys
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', s, re.S)
d = json.loads(m.group(1))
v = d['props']['pageProps']['data']['blocks'][3]['value']
print(json.dumps({k:(str(x)[:200]) for k,x in v.items()}, ensure_ascii=False, indent=1))
