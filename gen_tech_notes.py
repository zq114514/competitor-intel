# -*- coding: utf-8 -*-
"""一次性批量生成新技术条目的本地预分析 aiNote（豆包lite），写回 data.js。"""
import re, json, os, sys, time, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
# 支持命令行指定月报文件，默认 data.js
target = sys.argv[1] if len(sys.argv) > 1 else 'data.js'
DATA_JS = os.path.join(BASE, 'webapp', 'js', target)
if not os.path.exists(DATA_JS):
    print('File not found:', DATA_JS); sys.exit(1)
CFG = json.load(open(os.path.join(BASE, 'ai_config.json'), encoding='utf-8'))
ARK = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

js = open(DATA_JS, encoding='utf-8').read()

# 按 id 锚点切出每条技术条目的对象块（{ id:'tN' 或 { id: 'tN' 到下一个同类起始）
entries = []
for m in re.finditer(r"\{\s*id:\s*'(t\d+)'", js):
    start = m.start()
    nxt = re.search(r"\n\s*\{\s*id:\s*'t\d+'", js[start + 10:])
    end = start + 10 + nxt.start() if nxt else len(js)
    entries.append((m.group(1), start, end))

print('found tech entries:', len(entries))

def grab(block, field):
    # 提取 'field: '...'' 或 field: `...`，支持多行
    m = re.search(field + r"\s*:\s*'((?:[^'\\]|\\.)*)'", block, re.DOTALL)
    if m: return m.group(1).replace("\\'", "'").replace('\\\\', '\\')
    m = re.search(field + r'\s*:\s*`([^`]*)`', block, re.DOTALL)
    return m.group(1) if m else ''

results = {}
for tid, s, e in entries:
    blk = js[s:e]
    title = grab(blk, 'title'); company = grab(blk, 'company'); date = grab(blk, 'date')
    point = grab(blk, 'point'); impact = grab(blk, 'impactNote'); src = grab(blk, 'src')
    prompt = (
        '你是汽车整车性能集成专家。以下为竞品月报中一条已核实的零部件新技术条目，请做预分析，'
        '输出将静态展示在月报详情页（读者为主机厂工程师与领导）：\n\n'
        f'【标题】{title}\n【企业/主体】{company}\n【日期】{date}\n'
        f'【技术概述】{point}\n【影响评估】{impact}\n【来源口径】{src}\n\n'
        '请结构化输出（400字内，纯文本，不要用markdown标题）：\n'
        '① 技术本质一句话；② 量产成熟度与风险；③ 对同级竞品格局影响；④ 我方跟进建议。\n'
        '仅依据给定条目，不得编造参数。'
    )
    payload = json.dumps({
        'model': CFG['model'],
        'messages': [{'role': 'user', 'content': prompt}],
        'stream': False,
    }).encode('utf-8')
    req = urllib.request.Request(ARK, data=payload, headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CFG['api_key'],
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.loads(r.read().decode('utf-8'))
            note = j['choices'][0]['message']['content'].strip()
            results[tid] = note
            print(tid, 'OK', len(note))
            break
        except Exception as ex:
            print(tid, 'retry', attempt, ex)
            time.sleep(3)
    time.sleep(0.5)

# 写回 data.js：在每条技术 id 行后插入 aiNote 字段（已存在则替换）
# 注意：必须用 lambda 作 replacement，否则 re.sub 会把 esc 里的 \n 还原成真换行
out = js
for tid, note in results.items():
    esc = note.replace('\\', '\\\\').replace("'", "\\'").replace('\r', '').replace('\n', '\\n')
    pat_exist = r"(id:\s*'%s',\s*\n\s*aiNote:\s*)'(?:[^'\\]|\\.)*'," % tid
    if re.search(pat_exist, out, flags=re.DOTALL):
        out = re.sub(pat_exist, lambda m: m.group(1) + "'" + esc + "',", out, count=1, flags=re.DOTALL)
    else:
        out = re.sub(r"(id:\s*'%s',)" % tid,
                     lambda m: m.group(1) + "\n    aiNote: '" + esc + "',", out, count=1)

open(DATA_JS, 'w', encoding='utf-8', newline='\n').write(out)
print('written:', len(results), 'aiNote into data.js')
