# -*- coding: utf-8 -*-
"""按 {cid}.candidates.json 的 idx 下载最终图到 webapp/img/{cid}.jpg。
用法: python pick_img.py cid=idx [cid2=idx2 ...]
"""
import io, json, sys
from pathlib import Path
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = Path(__file__).resolve().parent
IMG_DIR = BASE / "webapp" / "img"
H = {"User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
     "Referer": "https://car.autohome.com.cn/"}

with requests.Session() as s:
    for arg in sys.argv[1:]:
        cid, _, idx = arg.partition("=")
        cid, idx = cid.strip(), int(idx)
        meta = json.loads((IMG_DIR / f"{cid}.candidates.json").read_text(encoding="utf-8"))
        url = meta["candidates"][idx]
        r = s.get(url, headers=H, timeout=30)
        d = r.content
        if d[:2] != b"\xff\xd8" or len(d) <= 30000:
            print(f"[FAIL] {cid} idx={idx} {len(d)}B")
            continue
        (IMG_DIR / f"{cid}.jpg").write_bytes(d)
        print(f"[OK] {cid}.jpg {len(d)//1024}KB idx={idx} album={meta['album']}")
