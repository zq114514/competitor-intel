# -*- coding: utf-8 -*-
"""10月线索初筛：items.json -> 按关键词分拣候选车型/技术清单"""
import io, json, re, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

items = json.load(open(r'c:\Users\chunsheng\Desktop\S59\AI场景\AI1\data\raw\2026-10\items.json', encoding='utf-8'))
if isinstance(items, dict):
    items = items.get('items', [])

car_kw = re.compile(r'(上市|预售|首发亮相|正式发布|开启预售|售\d|售价|指导价)')
tech_kw = re.compile(r'(发布|首发|推出|亮相|研发|量产|搭载|技术|平台|电池|芯片|智驾|新增|获得|完成)')
exclude = re.compile(r'(招聘|财报|半年报|季报|年报|销量快报|月度产销|收盘|股价|市值|停电|休假|峰会|论坛|峰会邀请|获奖名单|辟谣|车展门票)')

cars, techs, others = [], [], []
seen = set()
for it in items:
    t = (it.get('title') or '').strip()
    if not t or t in seen:
        continue
    seen.add(t)
    row = f"{it.get('date','')}｜{t}｜{it.get('source','')}｜{(it.get('url') or '')[:80]}"
    if exclude.search(t):
        continue
    if car_kw.search(t) and re.search(r'(SUV|轿车|MPV|车型|汽车|品牌|序列|版|Pro|Max|L|S)', t):
        cars.append(row)
    elif tech_kw.search(t):
        techs.append(row)
    else:
        others.append(row)

print(f"=== 候选车型线索 {len(cars)} 条 ===")
for r in cars: print(r)
print(f"\n=== 候选技术线索 {len(techs)} 条 ===")
for r in techs: print(r)
