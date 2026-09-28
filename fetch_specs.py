# -*- coding: utf-8 -*-
"""
汽车之家参数配置爬取（AI月度参数补全工具）
------------------------------------------
数据源：汽车之家 web-main 参数API（B级源，结构化、免签名）
接口：  https://www.autohome.com.cn/web-main/car/param/getParamConf?mode=1&site=1&seriesid={id}
定位：  只做"抓取+结构化映射"，输出 JSON 供 AI 核对官网后写入 data.js specs{ }。
       映射目标键名 = data.js SPEC_GROUPS 统一键名（见《特性维度标注准则》§3.3.9）。
       AH缺失项输出 null（由AI用官网素材补），脚本本身不推断、不编造。

用法：
    python fetch_specs.py 6939                  # 抓单个车系（MEGA）
    python fetch_specs.py 6939 8596             # 抓多个
    python fetch_specs.py 6939 --month 2026-09  # 指定归档月份（默认当前月）
    # 车系页混入旧年款/其他动力款型时，按款型名关键词过滤（AND命中），可重复：
    python fetch_specs.py 8159 --filter 8159=2026,纯电
    python fetch_specs.py 5569 --filter 5569=灵韵 --outtag 5569=aura   # 特殊版本单独出文件
输出：  data/raw/{YYYY-MM}/spec_ah_{seriesid}[_{tag}].json
"""
import argparse
import io
import json
import re
import sys
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
MISSING = {"", "-", "—", "暂无", "暂无报价", "None", "null", "/"}

# (AH板块itemtype, AH条目itemname) -> SPEC_GROUPS键；None组名=任意板块
# 条目名匹配：exact=精确，contains=包含
MAP = [
    ("变速箱", "exact", "简称", "变速箱"),
    ("底盘转向", "exact", "四驱形式", "四驱形式"),
    ("电池/充电", "exact", "电池能量(kWh)", "电池能量 kWh"),
    ("电池/充电", "exact", "电池类型", "电池类型"),
    ("电池/充电", "exact", "CLTC纯电续航里程(km)", "纯电续航 km"),
    ("电池/充电", "exact", "百公里耗电量(kWh/100km)", "百公里电耗 kWh/100KM"),
    ("车身", "exact", "风阻系数(Cd)", "风阻系数 Cd"),
    ("基本参数", "exact", "车身结构", "车身结构"),
    ("底盘转向", "exact", "车体结构", "车身形式"),
    ("车身", "exact", "长度(mm)", "长 mm"),
    ("车身", "exact", "宽度(mm)", "宽 mm"),
    ("车身", "exact", "高度(mm)", "高 mm"),
    ("车身", "exact", "轴距(mm)", "轴距 mm"),
    ("车身", "exact", "前轮距(mm)", "前轮距 mm"),
    ("车身", "exact", "后轮距(mm)", "后轮距 mm"),
    ("车身", "exact", "接近角(°)", "接近角 °"),
    ("车身", "exact", "离去角(°)", "离去角 °"),
    ("车身", "contains", "通过角", "通过角 °"),                    # 条件行：纵向通过角(°)
    ("车身", "exact", "最小离地间隙(mm)", "最小离地间隙 mm"),       # 条件行
    ("车身", "contains", "涉水深度", "涉水深度 mm"),               # 条件行
    ("车身", "contains", "爬坡度", "最大爬坡度 %"),                # 条件行：最大爬坡度(%)
    (None, "contains", "牵引质量", "最大牵引质量 kg"),             # 条件行：最大牵引质量(kg)
    ("车身", "exact", "后备厢容积(L)", "后备箱容积"),
    ("车身", "exact", "最小转弯半径(m)", "最小转弯半径 m"),  # 统一用半径口径（AH/官方均报半径）
    ("基本参数", "exact", "整备质量(kg)", "整备质量 kg"),
    ("基本参数", "exact", "最大满载质量(kg)", "最大满载质量 kg"),
    ("车轮制动", "contains", "备胎", "备胎"),
    ("基本参数", "exact", "官方0-100km/h加速(s)", "零百加速 s"),
    ("基本参数", "exact", "最高车速(km/h)", "最高车速 km/h"),
    ("底盘转向", "exact", "前悬架类型", "前悬架类型"),
    ("底盘转向", "exact", "后悬架类型", "后悬架类型"),
    ("驾驶操控", "exact", "可变悬架功能", "可变悬架功能"),
    ("驾驶硬件", "exact", "辅助驾驶芯片", "智驾芯片"),
    ("驾驶硬件", "contains", "激光雷达数量", "激光雷达"),
]
# 特殊合成项
LEAD_HIGHWAY = ["高速路领航辅助", "高速领航辅助", "高速领航辅助驾驶"]
LEAD_CITY = ["城市路领航辅助", "城市领航辅助", "城市领航辅助驾驶", "城市NOA领航辅助"]
COMBINED_RANGE = ["综合续航里程(km)", "WLTC综合续航里程(km)", "NEDC综合续航里程(km)"]


def clean(v):
    if v is None:
        return None
    v = re.sub(r"\s+", " ", str(v)).strip()
    return None if v in MISSING else v


def fetch(session, series_id):
    r = session.get(API, params={"mode": 1, "site": 1, "seriesid": series_id},
                    headers={**HEADERS, "Referer": f"https://www.autohome.com.cn/config/series/{series_id}.html"},
                    timeout=25)
    r.raise_for_status()
    return r.json()["result"]


def build_lookup(result):
    """返回 {(组,条目名): titleid} 与 条目名->titleid（无组）"""
    by_group, by_name = {}, {}
    for g in result["titlelist"]:
        gn = (g.get("itemtype") or "").strip()
        for it in g["items"]:
            nm = (it.get("itemname") or "").strip()
            by_group[(gn, nm)] = it["titleid"]
            by_name.setdefault(nm, it["titleid"])
    return by_group, by_name


def trim_values(result, name_must=()):
    """每个配置款型：(specname, {titleid: value})，可按款型名关键词过滤（全部命中才保留）"""
    out = []
    kws = [k for k in name_must if k]
    for d in result["datalist"]:
        specname = d.get("specname", "")
        if kws and not all(k in specname for k in kws):
            continue
        vals = {row["titleid"]: clean(row.get("itemname")) for row in d.get("paramconflist", [])}
        out.append((specname, vals))
    return out


def aggregate(values):
    """跨款型聚合：全同=单值；数值=区间；文本=去重枚举"""
    vals = [v for v in values if v]
    if not vals:
        return None
    uniq = list(dict.fromkeys(vals))
    if len(uniq) == 1:
        return uniq[0]
    nums = []
    for v in uniq:
        m = re.fullmatch(r"(\d+(?:\.\d+)?)", v)
        nums.append(float(m.group(1)) if m else None)
    if all(n is not None for n in nums):
        lo, hi = min(nums), max(nums)
        a = int(lo) if lo == int(lo) else lo
        b = int(hi) if hi == int(hi) else hi
        return f"{a}-{b}"
    return "/".join(uniq[:4]) + ("等" if len(uniq) > 4 else "")


def map_specs(result, name_must=()):
    by_group, by_name = build_lookup(result)
    trims = trim_values(result, name_must)
    specs = {}

    def tid_for(group, mode, name):
        if group:
            if mode == "exact" and (group, name) in by_group:
                return by_group[(group, name)]
            if mode == "contains":
                for (gn, nm), tid in by_group.items():
                    if gn == group and name in nm:
                        return tid
        else:
            if name in by_name:
                return by_name[name]
            if mode == "contains":
                for nm, tid in by_name.items():
                    if name in nm:
                        return tid
        return None

    for group, mode, ah_name, our_key in MAP:
        tid = tid_for(group, mode, ah_name)
        if tid is None:
            continue
        specs[our_key] = aggregate([tv.get(tid) for _, tv in trims])

    # 前/后电机：仅部分款型（如四驱版）搭载时，按驱动形式标注，避免误显为全系标配
    dt_tid = by_group.get(("底盘转向", "四驱形式"))

    def motor_agg(motor_name, our_key):
        tid = by_group.get(("电动机", motor_name))
        if tid is None:
            return
        pairs = [(sn, tv.get(tid), tv.get(dt_tid) if dt_tid is not None else None)
                 for sn, tv in trims]
        with_v = [(sn, v, d) for sn, v, d in pairs if v]
        if not with_v:
            return
        val = aggregate([v for _, v, _ in with_v])
        if len(with_v) == len(pairs):
            specs[our_key] = val  # 全系搭载
            return
        # 标注判定：款型名优先（新车AH驱动字段常滞后为空），驱动形式字段为辅
        names_on = [sn for sn, _, _ in with_v]
        names_off = [sn for sn, v, _ in pairs if not v]
        drv_on = {d for _, _, d in with_v if d}
        drv_off = {d for sn, v, d in pairs if not v and d}

        def is_4wd(name, drv):
            return ("四驱" in (name or "")) or bool(drv and "四驱" in drv)

        on4 = [is_4wd(n, d) for n, _, d in with_v]
        off4 = [is_4wd(n, d) for n, v, d in pairs if not v]
        if on4 and all(on4) and not any(off4):
            specs[our_key] = f"{val}（四驱版）"
        else:
            specs[our_key] = f"{val}（部分款型）"

    motor_agg("前电动机最大功率(kW)", "前电机功率 Kw")
    motor_agg("前电动机最大扭矩(N·m)", "前电机扭矩 Nm")
    motor_agg("后电动机最大功率(kW)", "后电机功率 Kw")
    motor_agg("后电动机最大扭矩(N·m)", "后电机扭矩 Nm")

    # 系统总功率/扭矩（混动发动机组/电机组同名冲突，且部分车系"基本参数"功率只填发动机值）：
    # 基本参数值 >= 电机总值 才视为系统综合值，否则取电机总值；纯电/油车各自只有一个来源
    def vmax(v):
        nums = re.findall(r"\d+\.?\d*", v or "")
        return max(float(x) for x in nums) if nums else None

    def total_power_torque(base_name, motor_name, eng_name):
        base_tid = by_group.get(("基本参数", base_name))
        mot_tid = by_group.get(("电动机", motor_name))
        eng_tid = by_group.get(("发动机", eng_name))
        base = aggregate([tv.get(base_tid) for _, tv in trims]) if base_tid is not None else None
        mot = aggregate([tv.get(mot_tid) for _, tv in trims]) if mot_tid is not None else None
        eng = aggregate([tv.get(eng_tid) for _, tv in trims]) if eng_tid is not None else None
        if base and mot:
            return base if (vmax(base) or 0) >= (vmax(mot) or 0) else mot
        return base or mot or eng

    specs["最大功率 kW"] = total_power_torque("最大功率(kW)", "电动机总功率(kW)", "最大功率(kW)")
    specs["最大扭矩 Nm"] = total_power_torque("最大扭矩(N·m)", "电动机总扭矩(N·m)", "最大扭矩(N·m)")

    # 智驾芯片+算力合成
    chip = specs.get("智驾芯片")
    tid_t = by_name.get("芯片总算力")
    if tid_t is not None:
        tops = aggregate([tv.get(tid_t) for _, tv in trims])
        if tops:
            specs["智驾芯片"] = (f"{chip}（{tops}TOPS）" if chip else f"{tops}TOPS")

    # 领航（只认AH明确条目，避免推断）
    def lead(names):
        for nm in names:
            tid = by_name.get(nm)
            if tid is not None:
                v = aggregate([tv.get(tid) for _, tv in trims])
                if v:
                    return "支持" if v in ("●", "标配", "有") else v
        return None
    specs["高速领航"] = lead(LEAD_HIGHWAY)
    specs["城市领航"] = lead(LEAD_CITY)

    # 综合续航（插混/增程）：精确名优先，再按"综合续航"包含匹配
    for nm in COMBINED_RANGE:
        tid = by_name.get(nm)
        if tid is not None:
            v = aggregate([tv.get(tid) for _, tv in trims])
            if v:
                specs["综合续航 km"] = v
                break
    if "综合续航 km" not in specs:
        for nm, tid in by_name.items():
            if "综合续航" in nm and "纯电" not in nm:
                v = aggregate([tv.get(tid) for _, tv in trims])
                if v:
                    specs["综合续航 km"] = v
                    break

    # 快充合成 fastCharge（自由文本键）：范围+小时→分钟
    tid_h, tid_p = by_name.get("电池快充时间(小时)"), by_name.get("电池快充电量范围(%)")
    if tid_h is not None:
        hs = [tv.get(tid_h) for _, tv in trims if tv.get(tid_h)]
        ps = [tv.get(tid_p) for _, tv in trims if tv.get(tid_p)] if tid_p is not None else []
        if hs:
            try:
                mins = round(float(hs[0]) * 60)
                t = f"约{mins}分钟" if mins >= 1 else f"约{hs[0]}小时"
            except ValueError:
                t = f"约{hs[0]}小时"
            if ps:
                p = ps[0]
                if "%" not in p:
                    p += "%"
                specs["fastCharge"] = f"{p}{t}"
            else:
                specs["fastCharge"] = t

    # 轮胎：前后规格
    tid_tire_f, tid_tire_r = by_name.get("前轮胎规格"), by_name.get("后轮胎规格")
    if tid_tire_f is not None:
        f = aggregate([tv.get(tid_tire_f) for _, tv in trims])
        r = aggregate([tv.get(tid_tire_r) for _, tv in trims]) if tid_tire_r is not None else None
        if f:
            specs["轮胎"] = f if (not r or r == f) else f"前{f} / 后{r}"

    # 发动机描述（燃油/插混）：排量+进气形式
    tid_disp, tid_intake = by_name.get("排量(L)"), by_name.get("进气形式")
    if tid_disp is not None:
        disp = aggregate([tv.get(tid_disp) for _, tv in trims])
        intake = aggregate([tv.get(tid_intake) for _, tv in trims]) if tid_intake is not None else None
        if disp:
            suffix = "T" if intake and "涡轮" in intake else ("自吸" if intake else "")
            if suffix and "-" in disp:  # 多排量区间逐段加后缀，如 1.5-2 + T → 1.5T-2.0T
                parts = [(p + ".0" if re.fullmatch(r"\d", p) else p) + suffix for p in disp.split("-")]
                disp = "-".join(parts)
            elif suffix:
                disp = disp + suffix
            specs["发动机"] = disp

    # 去掉None
    return {k: v for k, v in specs.items() if v}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("series_ids", nargs="+")
    ap.add_argument("--month", default=datetime.now().strftime("%Y-%m"))
    ap.add_argument("--filter", action="append", default=[], metavar="SID=kw1,kw2",
                    help="款型名过滤（关键词全部命中），可重复；如 8159=2026,纯电")
    ap.add_argument("--outtag", action="append", default=[], metavar="SID=tag",
                    help="输出文件名后缀标签（特殊版本），可重复；如 5569=aura")
    args = ap.parse_args()

    filters, tags = {}, {}
    for f in args.filter:
        sid, _, kws = f.partition("=")
        filters[sid.strip()] = [k.strip() for k in kws.split(",") if k.strip()]
    for t in args.outtag:
        sid, _, tag = t.partition("=")
        tags[sid.strip()] = tag.strip()

    out_dir = BASE / "data" / "raw" / args.month
    out_dir.mkdir(parents=True, exist_ok=True)

    with requests.Session() as s:
        for sid in args.series_ids:
            try:
                result = fetch(s, sid)
                kws = filters.get(sid, [])
                all_trims = [d.get("specname", "") for d in result["datalist"]]
                specs = map_specs(result, kws)
                kept = [n for n in all_trims if all(k in n for k in kws)] if kws else all_trims
                tag = tags.get(sid)
                fname = f"spec_ah_{sid}{'_' + tag if tag else ''}.json"
                payload = {
                    "source": "autohome getParamConf (B级)",
                    "seriesid": sid,
                    "seriesname": result.get("bread", {}).get("seriesname"),
                    "fetched_at": datetime.now().isoformat(timespec="seconds"),
                    "filter": kws,
                    "trims": kept,
                    "trims_excluded": [n for n in all_trims if n not in kept],
                    "spec_url": f"https://www.autohome.com.cn/config/series/{sid}.html",
                    "note": "AH缺失键未输出；AI需按§3.3.9用官网素材补 智驾/悬架/气囊 等滞后项后再写data.js",
                    "specs": specs,
                }
                fp = out_dir / fname
                fp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"[OK] {sid}{('['+tag+']') if tag in tags else ''} {payload['seriesname']} "
                      f"款型={len(kept)}/{len(all_trims)} 取到={len(specs)}键 -> {fp.name}")
            except Exception as e:
                print(f"[FAIL] {sid}: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
