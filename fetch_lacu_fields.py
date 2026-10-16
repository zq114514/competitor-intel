# -*- coding: utf-8 -*-
"""
LACU试点字段补采（2026-10，v8.9配套）
-------------------------------------
用途：为 data_base.js 影子库批量补 LACU 雷达两个低覆盖轴的官方字段：
  1) 补能轴：AH「电池快充时间(小时)」+「电池快充电量范围(%)」
     → 线性归一为"等效20-80%分钟" eqMin = 最快小时数×60 × 60/窗口跨度%
       （窗口口径各厂不一：10-80=70%、30-80=50%、20-80=60%；线性折算为显式近似，原始值留痕）
  2) 通过性轴：AH「最小离地间隙(mm)」→ 全系最优（最大值，与LACU"官方全系最优"口径一致）
数据源：汽车之家 web-main 参数API（B级源），与 fetch_specs.py 同接口；仅urllib标准库。
输出：data/raw/{YYYY-MM}/lacu_fields.json —— AI核对后写入 data_base.js m.chargeEqMin / m.clearance。
脚本只抓取与公式换算，不推断、不编造；AH缺失输出 null。
"""
import io
import json
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = Path(__file__).resolve().parent
API = "https://www.autohome.com.cn/web-main/car/param/getParamConf"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
}
MISSING = {"", "-", "—", "暂无", "None", "null", "/"}

# data_base.js 中大型SUV组26款（id=b+AH seriesid）
SIDS = ["7793", "6950", "7730", "7977", "6643", "6949", "6910", "6492", "7305",
        "6979", "8171", "8005", "6700", "6653", "6548", "8479", "6526", "0177",
        "5102", "6738", "6144", "5306", "4150", "6354", "4232", "7513"]
# AH真实seriesid（b0177为早年ID，补采时按实际传入）
ALT = {"0177": "177"}


def fetch(sid):
    url = f"{API}?mode=1&site=1&seriesid={sid}"
    req = urllib.request.Request(url, headers={**HEADERS, "Referer": f"https://www.autohome.com.cn/config/series/{sid}.html"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))["result"]


def clean(v):
    if v is None:
        return None
    v = re.sub(r"\s+", " ", str(v)).strip()
    return None if v in MISSING else v


def collect(result, itemname):
    """跨款型收集某条目全部非空值（去重保序）"""
    tid = None
    for g in result["titlelist"]:
        for it in g["items"]:
            if (it.get("itemname") or "").strip() == itemname:
                tid = it["titleid"]
    if tid is None:
        return []
    vals = []
    for d in result["datalist"]:
        for row in d.get("paramconflist", []):
            if row["titleid"] == tid:
                v = clean(row.get("itemname"))
                if v and v not in vals:
                    vals.append(v)
    return vals


def find_tid(result, itemname):
    for g in result["titlelist"]:
        for it in g["items"]:
            if (it.get("itemname") or "").strip() == itemname:
                return it["titleid"]
    return None


def charge_pairs(result):
    """款型内行级配对：返回 [(trim名, 小时float, 窗口原文)]，保证时间与SOC窗口同版型对应"""
    tid_h, tid_p = find_tid(result, "电池快充时间(小时)"), find_tid(result, "电池快充电量范围(%)")
    pairs = []
    if tid_h is None:
        return pairs
    for d in result["datalist"]:
        h = p = None
        for row in d.get("paramconflist", []):
            if row["titleid"] == tid_h:
                h = clean(row.get("itemname"))
            elif tid_p is not None and row["titleid"] == tid_p:
                p = clean(row.get("itemname"))
        hm = re.findall(r"\d+\.?\d*", h or "")
        if hm:
            pairs.append((d.get("specname", ""), min(float(x) for x in hm), p))
    return pairs


def span_of(soc):
    """'30-80'/'10%-80%' → 跨度百分数(int)；单值(如80)默认从0起不可比，返回None"""
    if not soc:
        return None
    nums = [float(x) for x in re.findall(r"\d+\.?\d*", soc)]
    if len(nums) >= 2:
        return int(round(nums[1] - nums[0]))
    return None


def main():
    out = []
    for sid in SIDS:
        real = ALT.get(sid, sid)
        rec = {"sid": sid, "name": None, "fastH_raw": None, "socRaw_raw": None,
               "eqMin": None, "clearance": None, "clearRaw": None, "note": ""}
        try:
            res = fetch(real)
            rec["name"] = res.get("bread", {}).get("seriesname")
            ps = collect(res, "电池快充电量范围(%)")
            cls = collect(res, "最小离地间隙(mm)")
            # 行级配对后逐款型归一，全系取等效时间最短者（官方全系最优口径）
            per_trim = []
            for trim, h, soc in charge_pairs(res):
                span = span_of(soc)
                if span and span > 0:
                    per_trim.append((round(h * 60 * 60 / span, 1), h, soc, trim))
            rec["socRaw_raw"] = "/".join(ps) if ps else None
            if per_trim:
                best = min(per_trim, key=lambda x: x[0])
                rec["eqMin"] = best[0]
                rec["fastH_raw"] = f"{best[1]}h@{best[2]}"
                rec["bestTrim"] = best[3]
                if len({(x[1], x[2]) for x in per_trim}) > 1:
                    rec["note"] = "多版型快充窗口不一，已按款型配对取最优"
            else:
                hs = collect(res, "电池快充时间(小时)")
                rec["fastH_raw"] = "/".join(hs) if hs else None
                if hs:
                    rec["note"] = "快充有时间无SOC窗口，未归一"
            if cls:
                c_nums = sorted(float(x) for x in re.findall(r"\d+\.?\d*", " ".join(cls)))
                rec["clearRaw"] = "/".join(cls)
                rec["clearance"] = int(c_nums[-1]) if c_nums[-1] == int(c_nums[-1]) else c_nums[-1]
            print(f"[{'OK' if (rec['eqMin'] is not None or rec['clearance'] is not None) else 'EMPTY'}] "
                  f"{sid} {rec['name']} eqMin={rec['eqMin']} cl={rec['clearance']} "
                  f"(h={rec['fastH_raw']} soc={rec['socRaw_raw']}) {rec['note']}")
        except Exception as e:
            rec["note"] = f"FAIL {type(e).__name__}: {e}"
            print(f"[FAIL] {sid} {rec['note']}")
        out.append(rec)
    out_dir = BASE / "data" / "raw" / datetime.now().strftime("%Y-%m")
    out_dir.mkdir(parents=True, exist_ok=True)
    fp = out_dir / "lacu_fields.json"
    payload = {"source": "autohome getParamConf (B级)", "fetched_at": datetime.now().isoformat(timespec="seconds"),
               "formula": "eqMin=最快快充小时×60×60/(SOC结束%-SOC开始%)，等效20-80%分钟；clearance=全系最大最小离地间隙",
               "records": out}
    fp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    nq = sum(1 for r in out if r["eqMin"] is not None)
    nc = sum(1 for r in out if r["clearance"] is not None)
    print(f"\n汇总 {len(out)} 款：快充可归一 {nq}，离地间隙 {nc} -> {fp}")


if __name__ == "__main__":
    main()
