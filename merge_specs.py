# -*- coding: utf-8 -*-
"""将 spec_ah_*.json 的全量 specs 键合并回 data-202610.js（官方值优先，AH值补全）"""
import json, re, os

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, 'webapp', 'js', 'data-202610.js')
SPEC_DIR = os.path.join(BASE, 'data', 'raw', '2026-10')

# 车型id -> spec_ah文件名的映射
CAR_SPEC_MAP = {
    'zj700': 'spec_ah_8131.json',
    'tg07': 'spec_ah_8733.json',
    'junyue': 'spec_ah_834.json',
    'qy-a06': 'spec_ah_8140.json',
    'deepal-l06': 'spec_ah_8244.json',
}

# 读取 data-202610.js
with open(DATA_FILE, encoding='utf-8') as f:
    js = f.read()

for car_id, spec_file in CAR_SPEC_MAP.items():
    spec_path = os.path.join(SPEC_DIR, spec_file)
    with open(spec_path, encoding='utf-8') as f:
        ah = json.load(f)
    ah_specs = ah.get('specs', {})
    if not isinstance(ah_specs, dict):
        print(f'{car_id}: specs is not dict, skip')
        continue

    # 找到该车在 data-202610.js 中的 specs 块
    # 匹配 id: 'car_id' 之后的 specs: { ... }
    id_pat = r"id:\s*'" + re.escape(car_id) + r"'"
    id_match = re.search(id_pat, js)
    if not id_match:
        print(f'{car_id}: id not found in data file')
        continue

    # 从 id 位置开始找 specs: {
    after_id = js[id_match.start():]
    specs_start_match = re.search(r'specs:\s*\{', after_id)
    if not specs_start_match:
        print(f'{car_id}: specs block not found')
        continue

    specs_start = id_match.start() + specs_start_match.end()  # 位置：specs: { 之后
    # 找到匹配的闭合大括号（考虑嵌套）
    depth = 1
    i = specs_start
    while i < len(js) and depth > 0:
        if js[i] == '{':
            depth += 1
        elif js[i] == '}':
            depth -= 1
        i += 1
    specs_end = i - 1  # 闭合 } 的位置

    # 提取现有 specs 文本
    old_specs_text = js[specs_start:specs_end]

    # 解析现有 specs 键值对（简单解析：'key': 'value' 或 key: 'value'）
    existing = {}
    # 匹配模式：可选引号 + 键名 + 可选引号 + 冒号 + 可选空格 + 引号 + 值 + 引号
    for m in re.finditer(r"(?:'([^']+)'|([a-zA-Z_]+))\s*:\s*'((?:[^'\\]|\\.)*)'", old_specs_text):
        key = m.group(1) or m.group(2)
        val = m.group(3).replace("\\'", "'").replace('\\\\', '\\')
        existing[key] = val

    # 合并：AH specs 为主，existing（官方）覆盖
    merged = dict(ah_specs)  # 先放 AH 全量
    merged.update(existing)   # 官方值覆盖 AH 值

    # 生成新的 specs 文本
    lines = []
    for k, v in merged.items():
        v_str = str(v).replace("'", "\\'").replace('\n', '\\n')
        lines.append(f"      '{k}': '{v_str}'")
    new_specs_text = ',\n'.join(lines)

    # 替换
    js = js[:specs_start] + new_specs_text + js[specs_end:]

    print(f'{car_id}: AH={len(ah_specs)} existing={len(existing)} merged={len(merged)}')

# 写回
with open(DATA_FILE, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)

print('Done. data-202610.js updated.')
