# -*- coding: utf-8 -*-
"""
汽车之家官图下载（AI月报图片补全工具）
--------------------------------------
数据源：汽车之家图库官图分类（唯一合法来源，见《特性维度标注准则》§3.3.12）
流程： /pic/series/{id}-53.html（官图）→ 分款型相册 /pic/series-s{album}/{id}-53.html
      → data-webp 缩略图 → 去除 CDN 尺寸令牌取原图（FFD8 校验）
注意： 脚本只负责"取图+校验"，背景纯净度/3-4前侧角度须人工（AI）逐张目检；
      无合规图时 img 留空，不得用非工作室图兜底。

用法：
    python fetch_imgs.py 8677=qj-gx7 8758=z9s                 # 多车：取各车-53页默认顺序第1张
    python fetch_imgs.py 7696=bj40-hy --kw 7696=黑曜          # 指定款型相册关键词
    python fetch_imgs.py 8677=qj-gx7 --idx 2                 # 取第3张候选（0基，换图用）
    python fetch_imgs.py 8545=menglong-lh --kw 8545=力魂 --dry
输出： webapp/img/{cid}.jpg；同目录 {cid}.candidates.json 留档候选URL清单
"""
import argparse
import io
import json
import re
import sys
from pathlib import Path

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent
OUT_DIR = BASE / "webapp" / "img"
H = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": "https://car.autohome.com.cn/",
}
SIZE_TOKEN = re.compile(r"/\d+x\d+_0_q\d+_c\d+_")
ALBUM_RE = re.compile(r'/pic/series-s(\d+)/%s-53\.html[^>]*>\s*([^<（]+)\s*(\((\d+)张\))?')
WEBP_RE = re.compile(r'data-webp="(//[^"]+?\.jpg)"')


def get(session, url, encoding="gbk"):
    r = session.get(url, headers={**H, "Referer": "https://car.autohome.com.cn/"}, timeout=25)
    r.raise_for_status()
    r.encoding = encoding
    return r.text


def parse_albums(html, sid, cat):
    """款型相册：[(albumid, label, count)]"""
    albums = []
    pat = (r'href="/pic/series-s(\d+)/' + sid + r'-' + str(cat) +
           r'\.html[^>]*>\s*([^<]+?)(?:<span[^>]*>\((\d+)张\)</span>)?\s*<(?:i|/a|span)')
    for m in re.finditer(pat, html):
        albums.append((m.group(1), m.group(2).strip(), int(m.group(3) or 0)))
    return albums


def to_orig(thumbs):
    cands = []
    for u in thumbs:
        orig = SIZE_TOKEN.sub("/", "https:" + u)
        if orig not in cands:
            cands.append(orig)
    return cands


def collect_candidates(session, sid, kw):
    """返回（候选URL列表[原图]，来源说明，款型相册表）。官图53优先，无图回退外观1。"""
    albums_all = {}
    for cat in (53, 1):
        page_url = f"https://car.autohome.com.cn/pic/series/{sid}-{cat}.html"
        html = get(session, page_url)
        albums = parse_albums(html, sid, cat)
        albums_all[cat] = albums
        if kw and albums:
            hit = [a for a in albums if kw in a[1]]
            if hit:
                aid, label, cnt = hit[0]
                aurl = f"https://car.autohome.com.cn/pic/series-s{aid}/{sid}-{cat}.html"
                cands = to_orig(WEBP_RE.findall(get(session, aurl)))
                if cands:
                    return cands, f"{cat}类相册 {label}（{cnt}张）", albums_all
        cands = to_orig(WEBP_RE.findall(html))
        if cands:
            return cands, f"{cat}类页默认", albums_all
    return [], "无候选", albums_all


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pairs", nargs="+", help="sid=cid")
    ap.add_argument("--kw", action="append", default=[], metavar="SID=关键词", help="款型相册关键词")
    ap.add_argument("--idx", type=int, default=0, help="候选序号（0基，默认0）")
    ap.add_argument("--dry", action="store_true", help="只列候选不下载")
    args = ap.parse_args()

    kws = {}
    for f in args.kw:
        sid, _, kw = f.partition("=")
        kws[sid.strip()] = kw.strip()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with requests.Session() as s:
        for pair in args.pairs:
            sid, _, cid = pair.partition("=")
            sid, cid = sid.strip(), cid.strip()
            try:
                cands, label, albums = collect_candidates(s, sid, kws.get(sid, ""))
                album_flat = [(f"c{cat}", a[1], a[2]) for cat, lst in albums.items() for a in lst]
                print(f"[{cid}] sid={sid} 相册：{label}；全部相册：{[(x[1], x[2]) for x in album_flat]}")
                print(f"  候选 {len(cands)} 张；选用 idx={args.idx}")
                if not cands:
                    print("  [FAIL] 无候选图")
                    continue
                (OUT_DIR / f"{cid}.candidates.json").write_text(
                    json.dumps({"sid": sid, "album": label, "candidates": cands},
                               ensure_ascii=False, indent=2), encoding="utf-8")
                if args.dry:
                    for i, u in enumerate(cands[:8]):
                        print(f"   {i}: {u}")
                    continue
                if args.idx >= len(cands):
                    print(f"  [FAIL] idx 超界（共{len(cands)}张）")
                    continue
                url = cands[args.idx]
                r = s.get(url, headers=H, timeout=30)
                data = r.content
                ok = data[:2] == b"\xff\xd8" and len(data) > 30000
                if not ok:
                    print(f"  [FAIL] FFD8/大小异常 status={r.status_code} {len(data)}B {url}")
                    continue
                fp = OUT_DIR / f"{cid}.jpg"
                fp.write_bytes(data)
                print(f"  [OK] {fp.name} {len(data)//1024}KB idx={args.idx} {url}")
            except Exception as e:
                print(f"  [FAIL] {sid}: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
