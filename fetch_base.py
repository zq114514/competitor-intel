# -*- coding: utf-8 -*-
"""
行业基准影子库批量采集（能力分锚点标定专用，2026-10 试点）
------------------------------------------------------------------
数据源：汽车之家 getParamConf（B级源，结构化、免签名）。本脚本只采能力分标定
所需的客观参数（每车系统计"全系在售款型最优值"），输出一份汇总 JSON：
    data/raw/{YYYY-MM}/base_pool.json
注意：
  - 这是评分锚点标定的背景样本，不是月报车型，不进 data.js、不进卡片/轮播；
  - AH数据为B级，只用于分位统计，不逐款官网复核（准则§9授权，面板须注明来源与基准月）；
  - 不采价格（基准车只做参数背景板）。
用法：
    python fetch_base.py                 # 全量
    python fetch_base.py --only 5769,771 # 调试指定车系
"""
import argparse
import io
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent
API = "https://www.autohome.com.cn/web-main/car/param/getParamConf"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}
MISSING = {"", "-", "—", "暂无", "暂无报价", "None", "null", "/", "●", "○"}
MONTH = "2026-10"

# (拟定组, 车系id, 规范名)  —— 84款定稿（备选7款已并入）
MANIFEST = [
    # ===== 中型SUV（30）=====
    ("中型SUV", 5769, "特斯拉Model Y"), ("中型SUV", 7793, "小米YU7"),
    ("中型SUV", 7162, "小鹏G6"), ("中型SUV", 8014, "小鹏G7"),
    ("中型SUV", 6950, "理想L6"), ("中型SUV", 6388, "问界M5"),
    ("中型SUV", 8205, "尚界H5"), ("中型SUV", 7730, "智界R7"),
    ("中型SUV", 7652, "阿维塔07"), ("中型SUV", 7777, "极氪7X"),
    ("中型SUV", 4881, "蔚来ES6"), ("中型SUV", 5569, "蔚来EC6"),
    ("中型SUV", 7687, "乐道L60"), ("中型SUV", 5205, "零跑C11"),
    ("中型SUV", 7382, "零跑C10"), ("中型SUV", 6817, "深蓝S07"),
    ("中型SUV", 7220, "宋L EV"), ("中型SUV", 7815, "宋L DM-i"),
    ("中型SUV", 6851, "海狮07 EV"), ("中型SUV", 7977, "海狮07 DM-i"),
    ("中型SUV", 6898, "腾势N7"), ("中型SUV", 7728, "岚图知音"),
    ("中型SUV", 5048, "红旗HS5"), ("中型SUV", 4744, "探岳"),
    ("中型SUV", 3554, "昂科威Plus"), ("中型SUV", 4102, "冠道"),
    ("中型SUV", 4658, "宝马X3"),
    ("中型SUV", 3862, "奔驰GLC"), ("中型SUV", 4851, "奥迪Q5L"),
    ("中型SUV", 3989, "凯迪拉克XT5"),
    # ===== 中大型SUV（26）=====
    ("中大型SUV", 6643, "问界M7"), ("中大型SUV", 6949, "理想L7"),
    ("中大型SUV", 6910, "理想L8"), ("中大型SUV", 6492, "小鹏G9"),
    ("中大型SUV", 7305, "智己LS6"), ("中大型SUV", 7243, "领克08 EM-P"),
    ("中大型SUV", 6979, "魏牌蓝山"), ("中大型SUV", 8171, "方程豹钛7"),
    ("中大型SUV", 8005, "唐L"), ("中大型SUV", 771, "汉兰达"),
    ("中大型SUV", 3615, "锐界"), ("中大型SUV", 6700, "蔚来ES7"),
    ("中大型SUV", 6653, "坦克500新能源"), ("中大型SUV", 6548, "宝马X5"),
    ("中大型SUV", 8479, "奔驰GLE"), ("中大型SUV", 6526, "奥迪Q6"),
    ("中大型SUV", 177, "沃尔沃XC90"), ("中大型SUV", 5102, "凯迪拉克XT6"),
    ("中大型SUV", 6738, "揽巡"), ("中大型SUV", 6144, "领克09"),
    ("中大型SUV", 4094, "传祺GS8"), ("中大型SUV", 5306, "星途揽月"),
    ("中大型SUV", 4150, "红旗HS7"), ("中大型SUV", 6354, "阿维塔11"),
    ("中大型SUV", 4232, "途昂"), ("中大型SUV", 7513, "北京越野BJ60增程"),
    # ===== 中大型轿车（28）=====
    ("中大型轿车", 6962, "小米SU7"), ("中大型轿车", 6091, "极氪001"),
    ("中大型轿车", 7355, "智界S7"), ("中大型轿车", 7630, "享界S9"),
    ("中大型轿车", 7859, "汉L"), ("中大型轿车", 7838, "腾势Z9"),
    ("中大型轿车", 5264, "蔚来ET7"), ("中大型轿车", 7554, "小鹏P7+"),
    ("中大型轿车", 7126, "阿维塔12"), ("中大型轿车", 18, "奥迪A6L"),
    ("中大型轿车", 65, "宝马5系"), ("中大型轿车", 197, "奔驰E级"),
    ("中大型轿车", 4206, "沃尔沃S90"), ("中大型轿车", 3802, "凯迪拉克CT6"),
    ("中大型轿车", 5566, "红旗H9"), ("中大型轿车", 5499, "比亚迪汉"),
    ("中大型轿车", 6915, "岚图追光"), ("中大型轿车", 5845, "领克Z10"),
    ("中大型轿车", 6012, "智己L7"), ("中大型轿车", 8105, "奥迪A6L e-tron"),
    ("中大型轿车", 6640, "奔驰EQE"), ("中大型轿车", 7208, "大众ID.7 VIZZION"),
    ("中大型轿车", 4962, "亚洲龙"), ("中大型轿车", 834, "别克君越"),
    ("中大型轿车", 7935, "日产N7"),
    ("中大型轿车", 7398, "奕派eπ007"), ("中大型轿车", 7491, "极氪007"),
    ("中大型轿车", 882, "丰田皇冠"),
]


SIZE_RULES = {  # 与 analysis.js 完全一致（车长/轴距双维就低）
    "suv":   ([4650, 4850, 5050], [2700, 2850, 2950]),
    "sedan": ([4700, 4900, 5100], [2750, 2900, 3000]),
    "mpv":   ([4750, 4950, 5200], [2850, 2950, 3150]),
}
BAND_NAME = {1: "紧凑", 2: "中型", 3: "中大型", 4: "大型"}


def size_band(v, cuts):
    if v is None:
        return None
    if v < cuts[0]:
        return 1
    if v < cuts[1]:
        return 2
    if v < cuts[2]:
        return 3
    return 4


def our_group(length, wb, body):
    """webapp评分引擎同口径：车长×轴距双维就低"""
    rule = SIZE_RULES.get(body)
    if not rule:
        return None, None
    bL, bW = size_band(length, rule[0]), size_band(wb, rule[1])
    band = min(b for b in (bL, bW) if b is not None) if (bL or bW) else None
    return (BAND_NAME.get(band), band)


def fetch(session, sid, tries=2):
    last = None
    for _ in range(tries):
        try:
            r = session.get(API, params={"mode": 2, "site": 1, "seriesid": sid},
                            headers={**HEADERS, "Referer": f"https://www.autohome.com.cn/config/series/{sid}.html"},
                            timeout=25)
            r.raise_for_status()
            return r.json()["result"]
        except Exception as e:  # noqa
            last = e
            time.sleep(1.2)
    raise last


def num(v):
    """取字符串里第一个数值（兼容'520kW'/'3.5s'）；●○等无数字返回None"""
    if v is None:
        return None
    m = re.search(r"\d+(?:\.\d+)?", str(v))
    return float(m.group(0)) if m else None


def build_index(result):
    by_group, by_name = {}, {}
    for g in result["titlelist"]:
        gn = (g.get("itemtype") or "").strip()
        for it in g["items"]:
            nm = (it.get("itemname") or "").strip()
            by_group.setdefault((gn, nm), it["titleid"])
            by_name.setdefault(nm, it["titleid"])
    return by_group, by_name


def airbag_count(by_name, tv):
    """气囊点位：统计被动安全组所有'气囊/气帘'行里的●数（主●/副●=2，前后排各计）"""
    total = 0
    for nm, tid in by_name.items():
        if ("气囊" in nm or "气帘" in nm) and "气囊压力" not in nm:
            v = tv.get(tid)
            if v:
                total += str(v).count("●")
    return total or None


def parse_level_body(level_txt, condition):
    """AH级别（如'中大型SUV'/'中型车'/'大型MPV'）→ (级别, body)"""
    t = level_txt or ""
    if "SUV" in t.upper():
        body = "suv"
    elif "MPV" in t.upper():
        body = "mpv"
    elif "皮卡" in t:
        body = "pickup"
    elif t and not any(k in t for k in ("车", "轿车")):
        body = "other"  # 客车/微面等非试点品类
    else:
        body = "sedan"
    for lv in ("中大型", "中型", "大型", "紧凑型", "紧凑", "小型", "微型"):
        if t.startswith(lv) or lv in t:
            level = "紧凑" if lv in ("紧凑型", "紧凑") else lv
            break
    else:
        # 用condition兜底
        body_cond = "".join(condition)
        body = "mpv" if "MPV" in body_cond else ("suv" if "SUV" in body_cond else body)
        level = None
    return level, body


def best_among(values, lower_better=False):
    xs = [v for v in values if v is not None]
    return min(xs) if lower_better and xs else (max(xs) if xs else None)


def extract(result):
    by_group, by_name = build_index(result)
    tid = {
        "level": by_name.get("级别"),
        "energy": by_name.get("能源类型"),
        "accel": by_name.get("官方0-100km/h加速(s)"),
        "power": by_name.get("最大功率(kW)"),
        "range": by_name.get("CLTC纯电续航里程(km)"),
        "kwh": by_name.get("百公里耗电量(kWh/100km)"),
        "chargeKw": by_name.get("快充功率(kW)"),
        "tops": by_name.get("芯片总算力"),
        "lidar": by_name.get("激光雷达数量"),
        "wb": by_name.get("轴距(mm)"),
        "len": by_name.get("长度(mm)"),
        "wid": by_name.get("宽度(mm)"),
        "lwh": by_name.get("长*宽*高(mm)"),
        "motorPower": by_name.get("电动机总功率(kW)"),
        "engPower": by_group.get(("发动机", "最大功率(kW)")),
    }
    trims = result.get("datalist", [])
    rows = []
    energies = set()
    for d in trims:
        tv = {row["titleid"]: (row.get("itemname") or "").strip() for row in d.get("paramconflist", [])}

        def get(k):
            t = tid.get(k)
            return tv.get(t) if t is not None else None

        energy_txt = get("energy") or ""
        is_ev = "纯电动" in energy_txt
        if energy_txt:
            energies.add(energy_txt)
        lwh = None
        if not get("len") and get("lwh"):
            m = re.findall(r"\d+", get("lwh") or "")
            lwh = (float(m[0]), float(m[1])) if len(m) >= 2 else None
        def power_val():
            for k in ("power", "motorPower", "engPower"):
                v = num(get(k))
                if v is not None:
                    return v
            return None

        rows.append({
            "name": d.get("specname", ""),
            "status": d.get("specstatus"),
            "condition": d.get("condition", []),
            "is_ev": is_ev,
            "accel": num(get("accel")),
            "power": power_val(),
            "range": num(get("range")) if is_ev else None,
            "kwh": num(get("kwh")) if is_ev else None,
            "chargeKw": num(get("chargeKw")) if is_ev else None,
            "tops": num(get("tops")),
            "lidar": (lambda v: num(v) if num(v) is not None else (1 if v and "●" in v else None))(get("lidar")),
            "airbag": airbag_count(by_name, tv),
            "wb": num(get("wb")),
            "len": num(get("len")) or (lwh[0] if lwh else None),
            "wid": num(get("wid")) or (lwh[1] if lwh else None),
        })

    # 全系在售款型最优值（与data.js口径一致）。status!=20视为非在售，剔除
    live = [r for r in rows if r["status"] == 20] or rows
    ev = [r for r in live if r["is_ev"]]

    def agg(metric, pool, low=False):
        return best_among([r[metric] for r in pool], low)

    any_ev = bool(ev)
    level_txt = None
    d0 = trims[0] if trims else {}
    tv0 = {row["titleid"]: (row.get("itemname") or "").strip() for row in d0.get("paramconflist", [])}
    if tid["level"] is not None:
        level_txt = tv0.get(tid["level"])
    cond0 = d0.get("condition", [])
    level, body = parse_level_body(level_txt, cond0)

    def a(metric, pool, low=False):
        return best_among([r[metric] for r in pool], low)

    L, WB = a("len", live), a("wb", live)
    our_level, _ = our_group(L, WB, body)

    return {
        "trimsTotal": len(rows), "trimsLive": len(live), "energies": sorted(energies),
        "ahLevel": level_txt, "level": level, "ourLevel": our_level, "body": body,
        "m": {
            "accel": agg("accel", live, low=True),
            "powerKw": agg("power", live),
            "rangeKm": agg("range", ev),
            "kwh100": agg("kwh", ev, low=True),
            "chargeKw": agg("chargeKw", ev),
            "tops": agg("tops", live),
            "lidar": agg("lidar", live),
            "airbag": agg("airbag", live),
            "wheelbase": agg("wb", live),
            "length": agg("len", live),
            "width": agg("wid", live),
        },
        "hasEvTrim": any_ev,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    only = {int(x) for x in args.only.split(",") if x.strip()}
    manifest = [x for x in MANIFEST if not only or x[1] in only]

    out = {"benchmarkMonth": MONTH, "source": "autohome getParamConf (B级，仅用于锚点分位标定)",
           "fetchedAt": datetime.now().isoformat(timespec="seconds"), "cars": []}
    fail, moved, excluded = [], [], []
    with requests.Session() as s:
        for i, (grp, sid, canon) in enumerate(manifest, 1):
            try:
                result = fetch(s, sid)
                e = extract(result)
                ah_name = result.get("bread", {}).get("seriesname")
                ah_key = f"{e['level']}|{e['body']}" if e['level'] else None
                size_key = f"{e['ourLevel']}|{e['body']}" if e['ourLevel'] else None
                # 归组原则与 webapp deriveLevel 一致：官方/权威级别优先，尺寸规则仅缺失时兜底
                key, src = (ah_key, "AH定级") if ah_key else (size_key, "尺寸推定")
                want_key = {"中型SUV": "中型|suv", "中大型SUV": "中大型|suv", "中大型轿车": "中大型|sedan"}[grp]
                rec = {"id": sid, "name": canon, "ahName": ah_name, "wantGroup": grp,
                       "ahLevel": e["ahLevel"], "ourLevel": e["ourLevel"], "groupSrc": src,
                       "autoGroup": key, "energies": e["energies"], "trimsLive": e["trimsLive"], "m": e["m"]}
                if not key:
                    rec["excluded"] = f"级别无法判定 AH={e['ahLevel']}"
                    excluded.append(f"{canon}({sid}): 级别无法判定")
                elif key != want_key:
                    if key in ("中型|suv", "中大型|suv", "中大型|sedan"):
                        moved.append(f"{canon}({sid}): 拟入{grp} → {src}「{e['ahLevel'] or e['ourLevel']}」")
                    else:
                        rec["excluded"] = f"{src}归组{key}（AH={e['ahLevel']}）不在试点3组"
                        excluded.append(f"{canon}({sid}): {key} AH={e['ahLevel']}")
                if ah_key and size_key and ah_key != size_key:
                    moved.append(f"  · {canon}: AH「{e['ahLevel']}」≠尺寸规则「{e['ourLevel']}」（采AH）")
                out["cars"].append(rec)
                print(f"[{i:2d}/{len(manifest)}] OK {canon:16s} {str(e['ahLevel']):8s} live={e['trimsLive']:2d} "
                      f"a={e['m']['accel']} P={e['m']['powerKw']} r={e['m']['rangeKm']} chg={e['m']['chargeKw']} "
                      f"tops={e['m']['tops']} lid={e['m']['lidar']} bag={e['m']['airbag']} "
                      f"L/W/WB={e['m']['length']}/{e['m']['width']}/{e['m']['wheelbase']}")
            except Exception as ex:  # noqa
                fail.append(f"{canon}({sid}): {type(ex).__name__}: {ex}")
                print(f"[{i:2d}/{len(manifest)}] FAIL {canon}({sid}): {ex}")
            time.sleep(0.35)

    out_dir = BASE / "data" / "raw" / MONTH
    out_dir.mkdir(parents=True, exist_ok=True)
    fp = out_dir / "base_pool.json"
    fp.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    kept = [c for c in out["cars"] if not c.get("excluded")]
    print(f"\n=== 汇总：成功{len(kept)}/{len(manifest)} 失败{len(fail)} 出组{len(excluded)} ===")
    for x in moved: print("  [移动]", x)
    for x in excluded: print("  [出组]", x)
    for x in fail: print("  [失败]", x)
    print("输出：", fp)


if __name__ == "__main__":
    main()
