# -*- coding: utf-8 -*-
"""
基准影子库分位计算（读 data/raw/2026-10/base_pool.json）
------------------------------------------------------------------
输出：
  1) 每试点组（中型SUV/中大型SUV/中大型轿车）各指标的 P90/P75/P60/P45/P30
     （越大越好与越小越好统一取"最优方向"的分位：脚本同时给出方向标注）；
  2) P90/P30 的 bootstrap 95% 置信带（尾部不稳预警）；
  3) 全试点池统一尺指标（tops/lidar/airbag/chargeKw仅EV）的分位；
  4) 与 analysis.js 现行经验锚点的并列对照；
  5) data/raw/2026-10/base_percentiles.json 落盘供锚点评审。
每个车系1票（全系在售款型最优值，不按款型数/销量加权）。
用法： python base_calc.py
"""
import io
import json
import random
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = Path(__file__).resolve().parent
POOL = BASE / "data" / "raw" / "2026-10" / "base_pool.json"
OUT = BASE / "data" / "raw" / "2026-10" / "base_percentiles.json"
PS = [90, 75, 60, 45, 30]
random.seed(20261009)

# 指标：(字段, 中文, 方向 high/low, 是否仅纯电车系)
METRICS = [
    ("accel", "零百加速 s", "low", False),
    ("powerKw", "最大功率 kW", "high", False),
    ("rangeKm", "CLTC续航 km", "high", True),
    ("kwh100", "电耗 kWh/100km", "low", True),
    ("wheelbase", "轴距 mm", "high", False),
    ("length", "车长 mm", "high", False),
    ("width", "车宽 mm", "high", False),
]
UNIV = [
    ("chargeKw", "峰值充电功率 kW", "high", True),
    ("tops", "智驾算力 TOPS", "high", False),
    ("lidar", "激光雷达 颗", "high", False),
    ("airbag", "气囊点位", "high", False),
]
PILOT = {"中型|suv": "中型SUV", "中大型|suv": "中大型SUV", "中大型|sedan": "中大型轿车"}
# 现行经验锚点（analysis.js STD_VER=20261009a），仅试点3组，用于对照
CUR = {
    "中型SUV": {
        "accel": [4.5, 5.5, 6.6, 7.8, 9.5, 11.5], "powerKw": [400, 330, 250, 190, 140, 100],
        "kwh100": [13.0, 14.0, 15.5, 17.0, 19.0, 21.0],
        "wheelbase": [2920, 2850, 2780, 2710, 2650, 2600],
        "length": [4920, 4850, 4770, 4680, 4590, 4500],
        "width": [1950, 1910, 1865, 1820, 1775, 1730]},
    "中大型SUV": {
        "accel": [3.9, 4.8, 6.0, 7.3, 9.0, 11.0], "powerKw": [520, 430, 330, 250, 180, 130],
        "kwh100": [14.0, 15.5, 17.0, 18.5, 20.5, 22.5],
        "wheelbase": [3040, 2960, 2880, 2800, 2730, 2670],
        "length": [5130, 5050, 4960, 4870, 4780, 4690],
        "width": [2000, 1955, 1905, 1855, 1810, 1765]},
    "中大型轿车": {  # 代码 key=中大型|sedan
        "accel": [3.5, 4.3, 5.3, 6.5, 8.0, 10.0], "powerKw": [500, 420, 320, 240, 170, 120],
        "kwh100": [12.0, 13.0, 14.0, 15.3, 17.0, 19.0],
        "wheelbase": [3080, 3000, 2920, 2840, 2770, 2700],
        "length": [5180, 5100, 5010, 4920, 4830, 4740],
        "width": [1980, 1935, 1890, 1845, 1800, 1755]},
}
CUR_RANGE = {"sedan": [850, 720, 620, 520, 420, 320], "suv": [800, 680, 590, 500, 410, 320]}
CUR_UNIV = {"chargeKw": [550, 400, 250, 150, 90, 50], "tops": [750, 508, 254, 128, 60, 20],
            "airbag": [12, 10, 8, 6, 4, 2]}


def parse_ah(t):
    if not t:
        return None, None
    tu = t.upper()
    if "SUV" in tu:
        body = "suv"
    elif "MPV" in tu:
        body = "mpv"
    elif "皮卡" in t:
        body = "pickup"
    elif not any(k in t for k in ("车", "轿车")):
        body = "other"
    else:
        body = "sedan"
    level = None
    for lv in ("中大型", "中型", "大型", "紧凑型", "紧凑", "小型", "微型"):
        if t.startswith(lv) or lv in t:
            level = "紧凑" if lv in ("紧凑型", "紧凑") else lv
            break
    return level, body


def pct_sorted(xs, p):
    """线性插值经验分位（与numpy linear同口径），xs已排序；p为百分位0-100"""
    if not xs:
        return None
    if len(xs) == 1:
        return float(xs[0])
    h = (p / 100) * (len(xs) - 1)
    lo = int(h)
    frac = h - lo
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * frac


def rnd(v):
    if v is None:
        return None
    return round(v, 2)


def boot_ci(xs, p, b=1000):
    if len(xs) < 8:
        return None
    n = len(xs)
    vals = []
    for _ in range(b):
        sample = [xs[random.randrange(n)] for _ in range(n)]
        sample.sort()
        vals.append(pct_sorted(sample, p))
    vals.sort()
    return [rnd(vals[int(b * 0.025)]), rnd(vals[int(b * 0.975)])]


def dist(values, field, high):
    xs = sorted(v for v in values if v is not None)
    if not xs:
        return None
    # 对"越小越好"指标，P90指第90百分位原值（劣侧），校准90分要用P10；统一直接输出各百分位原值，方向在映射时处理
    return {
        "n": len(xs), "min": rnd(xs[0]), "max": rnd(xs[-1]),
        "P": {p: rnd(pct_sorted(xs, p)) for p in PS},
        "ci90": boot_ci(xs, 90), "ci30": boot_ci(xs, 30),
    }


def main():
    pool = json.loads(POOL.read_text(encoding="utf-8"))
    groups, members = {}, {}
    for c in pool["cars"]:
        # 不采信采集时按尺寸规则写的 excluded，统一按 AH 优先在此重算归组
        lv, bd = parse_ah(c["ahLevel"])
        if not lv:
            lv = c.get("ourLevel")
        key = f"{lv}|{bd}"
        if key not in PILOT:
            continue
        groups.setdefault(key, []).append(c)
        members.setdefault(key, []).append(f"{c['name']}({c['id']})")

    result = {"benchmarkMonth": pool["benchmarkMonth"], "groups": {}, "univ": {}}
    for key, gname in PILOT.items():
        cars = groups.get(key, [])
        print("\n" + "=" * 78)
        print(f"【{gname}】入组 {len(cars)} 款")
        print("  " + "、".join(members.get(key, [])))
        g = {"n": len(cars), "metrics": {}}
        for field, cn, direction, ev_only in METRICS:
            vals = []
            for c in cars:
                v = c["m"].get(field)
                if v is None:
                    continue
                if ev_only and c["m"].get("rangeKm") is None:
                    continue  # 无纯电款型的车系不进EV指标分布
                vals.append(v)
            d = dist(vals, field, direction == "high")
            if not d:
                continue
            # 校准锚点：90分=P90（high）/P10（low）。把"分值档"对应的原值列出
            if direction == "high":
                cuts = [d["P"][90], d["P"][75], d["P"][60], d["P"][45], d["P"][30]]
            else:
                xs = sorted(v for v in vals if v is not None)
                cuts = [pct_sorted(xs, 10), pct_sorted(xs, 25), pct_sorted(xs, 40),
                        pct_sorted(xs, 55), pct_sorted(xs, 70)]
                cuts = [rnd(x) for x in cuts]
            cur = CUR.get(gname, {}).get(field)
            print(f"  {cn:14s} n={d['n']:2d} 范围[{d['min']}~{d['max']}] "
                  f"P90={d['P'][90]} P75={d['P'][75]} P60={d['P'][60]} P45={d['P'][45]} P30={d['P'][30]}"
                  f"  CI90={d['ci90']} CI30={d['ci30']}")
            print(f"  {'':14s} 建议90~30档原值={cuts}  现行经验100~30={cur}")
            g["metrics"][field] = {**d, "cutsSuggest": cuts, "currentAnchor": cur, "dir": direction}
        # 续航（按车身，EV车系）
        evs = [c["m"]["rangeKm"] for c in cars if c["m"].get("rangeKm") is not None]
        if evs:
            d = dist(evs, "rangeKm", True)
            cuts = [d["P"][90], d["P"][75], d["P"][60], d["P"][45], d["P"][30]]
            body = "suv" if key.endswith("suv") else "sedan"
            print(f"  {'CLTC续航':14s} n={d['n']:2d} 范围[{d['min']}~{d['max']}] 建议档={cuts} 现行={CUR_RANGE[body]}")
            g["metrics"]["rangeKm"] = {**d, "cutsSuggest": cuts, "currentAnchor": CUR_RANGE[body], "dir": "high"}
        result["groups"][gname] = g

    # 续航按车身合并（与STD_BODY设计一致，扩大EV样本）
    print("\n" + "=" * 78)
    print("【续航·按车身合并】（SUV两组合并 / 轿车组）")
    for body, gnames in (("suv", ["中型SUV", "中大型SUV"]), ("sedan", ["中大型轿车"])):
        evs = []
        for gn in gnames:
            for c in groups.get({"中型SUV": "中型|suv", "中大型SUV": "中大型|suv", "中大型轿车": "中大型|sedan"}[gn], []):
                if c["m"].get("rangeKm") is not None:
                    evs.append(c["m"]["rangeKm"])
        d = dist(evs, "rangeKm", True)
        if d:
            cuts = [d["P"][90], d["P"][75], d["P"][60], d["P"][45], d["P"][30]]
            print(f"  {body:5s} n={d['n']:2d} 范围[{d['min']}~{d['max']}] 建议90~30档={cuts} "
                  f"CI90={d['ci90']} CI30={d['ci30']} 现行={CUR_RANGE[body]}")
            result.setdefault("rangeBody", {})[body] = {**d, "cutsSuggest": cuts,
                                                        "currentAnchor": CUR_RANGE[body], "dir": "high"}

    # 统一尺：全试点池合并
    print("\n" + "=" * 78)
    print("【全品类统一尺】（3组合计，charge/tops/lidar/airbag）")
    allcars = [c for cs in groups.values() for c in cs]
    for field, cn, direction, ev_only in UNIV:
        vals = []
        for c in allcars:
            v = c["m"].get(field)
            if v is None:
                continue
            if ev_only and c["m"].get("rangeKm") is None:
                continue
            vals.append(v)
        d = dist(vals, field, direction == "high")
        if not d:
            print(f"  {cn:14s} 无样本"); continue
        if direction == "high":
            cuts = [d["P"][90], d["P"][75], d["P"][60], d["P"][45], d["P"][30]]
        else:
            xs = sorted(vals)
            cuts = [rnd(x) for x in [pct_sorted(xs, 10), pct_sorted(xs, 25), pct_sorted(xs, 40),
                                     pct_sorted(xs, 55), pct_sorted(xs, 70)]]
        print(f"  {cn:14s} n={d['n']:2d} 范围[{d['min']}~{d['max']}] 分位={d['P']} CI90={d['ci90']}")
        print(f"  {'':14s} 建议90~30档={cuts} 现行={CUR_UNIV.get(field)}")
        result["univ"][field] = {**d, "cutsSuggest": cuts, "currentAnchor": CUR_UNIV.get(field), "dir": direction}

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n输出：", OUT)


if __name__ == "__main__":
    main()
