# -*- coding: utf-8 -*-
"""高清重采：把 webapp/img/*.jpg(400x300) 换成同款图的候选高清原图。
按 16x16 灰度感知哈希与现有缩略图匹配，避免换错照片；重采后压至1440px宽/q85控制体积。"""
import io, json, sys
from pathlib import Path
import requests
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = Path(__file__).resolve().parent
IMG_DIR = BASE / "webapp" / "img"
H = {"User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
     "Referer": "https://car.autohome.com.cn/"}
TARGET_W = 1440

def thumb(im):
    g = im.convert("L").resize((16, 16))
    px = list(g.getdata())
    avg = sum(px) / 256.0
    return [1 if p > avg else 0 for p in px]

def dist(a, b):
    return sum(x != y for x, y in zip(a, b))

def downscale_save(data, fp):
    im = Image.open(io.BytesIO(data))
    if im.width > TARGET_W:
        im = im.resize((TARGET_W, round(im.height * TARGET_W / im.width)), Image.LANCZOS)
    im = im.convert("RGB")
    im.save(fp, "JPEG", quality=85, optimize=True)
    return im

ok = fail = nojd = 0
jobs = sorted(IMG_DIR.glob("*.candidates.json"))
print("候选清单数:", len(jobs))
with requests.Session() as s:
    for cj in jobs:
        cid = cj.name.replace(".candidates.json", "")
        cur = IMG_DIR / f"{cid}.jpg"
        if not cur.exists():
            continue
        cur_im = Image.open(cur)
        if cur_im.width >= 1000:
            continue  # 已是高清
        meta = json.loads(cj.read_text(encoding="utf-8"))
        t0 = thumb(cur_im)
        best, best_d = None, 999
        for u in meta["candidates"]:
            try:
                r = s.get(u, headers=H, timeout=25)
                if r.content[:2] != b"\xff\xd8":
                    continue
                im = Image.open(io.BytesIO(r.content))
                d = dist(t0, thumb(im))
                if d < best_d:
                    best, best_d = (u, r.content), d
            except Exception:
                continue
        if best is None:
            print(f"[NO CAND] {cid}")
            nojd += 1
            continue
        if best_d > 96:  # 256位哈希差异过大，疑似换了照片
            print(f"[MISMATCH] {cid} d={best_d} 保留原图")
            fail += 1
            continue
        im = downscale_save(best[1], cur)
        ok += 1
        print(f"[OK] {cid} d={best_d} -> {im.width}x{im.height} {cur.stat().st_size//1024}KB")
print(f"完成: 高清化{ok} 未匹配{fail} 无候选{nojd}")
