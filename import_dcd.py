# -*- coding: utf-8 -*-
"""
懂车帝竞品数据.xlsx -> LACU影子库 data_dcd.js（2026-10，v8.9配套）
输入：公司AI竞品采集工具导出（815个sheet，每车一个；col0=参数名，col1..=款型）
口径与 data_base.js 手工影子库一致：价格=全系入门指导价；性能/续航/快充/尺寸=全系最优；
续航/补能仅全纯电车系；快充 eqMin=快充分钟×60/SOC窗口跨度，时间与窗口同列配对。
输出：webapp/js/data_dcd.js + data/raw/2026-10/dcd_shadow.json（留痕）
不推算缺失值；打印仅汇总计数（省token）。
"""
import io, json, re, sys
from pathlib import Path
import openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = Path(__file__).resolve().parent
XLSX = BASE / "懂车帝竞品数据.xlsx"

BODY_MAP = [("SUV", "suv"), ("MPV", "mpv")]
LEVELS = ["中大型", "大型", "中型", "紧凑型", "小型", "微型"]


def level_body(s):
    if not s:
        return None, None
    s = str(s).strip()
    lv = next((x for x in LEVELS if x in s), None)
    if lv == "紧凑型":
        lv = "紧凑"  # 与webapp内规范级别词对齐（LEVEL_PATTERNS/BAND_NAME均用"紧凑"），否则紧凑级全组失配
    if "SUV" in s.upper():
        body = "suv"
    elif "MPV" in s.upper():
        body = "mpv"
    elif "车" in s:
        body = "sedan"
    else:
        body = None
    return lv, body


def num(s):
    if s is None:
        return None
    m = re.findall(r"\d+\.?\d*", str(s))
    return float(m[0]) if m else None


def price(s):
    if not s or "万" not in str(s):
        return None
    v = num(s)
    return round(v, 2) if v is not None else None


def energy_of(s):
    s = str(s or "")
    if "纯电" in s:
        return "ev"
    if "增程" in s or "插电" in s or "插混" in s:
        return "x"
    if "油电混合" in s or "混动" in s or "燃油" in s or "汽油" in s or "柴油" in s:
        return "ice"
    return None


def fast_minutes(cell):
    """'快充12分钟'/'快充0.3小时'/'快充8分25秒'/'8分半' -> 分钟（取最快）；无快充None。
    v8.9.5：与 analysis.js parseChargeMinutes 对齐，支持分秒/分半/秒/min写法。"""
    if not cell:
        return None
    cands = []
    for part in str(cell).split("\n"):
        if "快充" not in part and "闪充" not in part:
            continue
        # 区间/列举共用单位（如"24/22分钟"）先摘出
        def _range_collect(m):
            cands.extend(float(x) for x in re.findall(r"\d+(?:\.\d+)?", m.group(0)))
            return " "
        seg = re.sub(r"(?:\d+(?:\.\d+)?\s*[-–~/至]\s*)+\d+(?:\.\d+)?\s*分钟",
                     _range_collect, part)
        for m in re.finditer(r"(\d+(?:\.\d+)?)\s*分(?:钟)?(?:\s*(\d+(?:\.\d+)?)\s*秒)?", seg):
            v = float(m.group(1))
            if m.group(2) is not None:
                v += float(m.group(2)) / 60
            cands.append(v)
        for m in re.finditer(r"(\d+(?:\.\d+)?)\s*分半", seg):
            cands.append(float(m.group(1)) + 0.5)
        seg2 = re.sub(r"\d+(?:\.\d+)?\s*分(?:钟)?\s*\d+(?:\.\d+)?\s*秒", " ", seg)
        for m in re.finditer(r"(\d+(?:\.\d+)?)\s*秒", seg2):
            cands.append(float(m.group(1)) / 60)
        for m in re.finditer(r"(\d+(?:\.\d+)?)\s*min\b", seg, re.I):
            cands.append(float(m.group(1)))
        mh = re.search(r"([\d.]+)\s*小时", part)
        if mh:
            cands.append(float(mh.group(1)) * 60)
    return min(cands) if cands else None


def span(s):
    nums = re.findall(r"\d+\.?\d*", str(s or ""))
    if len(nums) >= 2:
        d = float(nums[1]) - float(nums[0])
        return d if d > 0 else None
    return None


# v8.9.9 操稳（SE3 handling）字段解析
def susp_adj(v):
    """可变悬挂调节 -> '软硬+高低'/'软硬'/'高低'/None。无此行=无可调悬架（该数据源仅装备时列行）。"""
    if not v:
        return None
    s = str(v)
    hard = "软硬" in s
    high = "高低" in s
    if hard and high:
        return "软硬+高低"
    if hard:
        return "软硬"
    if high:
        return "高低"
    return None


def chassis_chips(c):
    """高阶底盘配置（C类，平铺不打分）：{标签: 是否标配}；值含选装/选配记选装，任一版型标配即标配。"""
    chips = {}

    def add(lab, val):
        std = val is not None and not re.search(r"选装|选配", str(val))
        chips[lab] = std if lab not in chips else (chips[lab] or std)

    v = c.get("空气悬架")
    if v:
        vs = str(v).strip()
        add(("双腔空气悬架" if "双腔" in vs else "单腔空气悬架" if "单腔" in vs else "空气悬架"), v)
    if c.get("魔毯智能悬挂"):
        add("魔毯智能悬架", c.get("魔毯智能悬挂"))
    if c.get("电磁感应悬挂"):
        add("电磁感应悬架", c.get("电磁感应悬挂"))
    if c.get("后轮主动转向系统"):
        add("后轮主动转向", c.get("后轮主动转向系统"))
    if c.get("可变转向比系统"):
        add("可变转向比", c.get("可变转向比系统"))
    st = c.get("转向类型")
    if st and "电传" in str(st):
        add("线控转向", st)
    if c.get("天行全主动悬挂") or c.get("天行全主动悬架"):
        add("全主动悬架", c.get("天行全主动悬挂") or c.get("天行全主动悬架"))
    if c.get("莲花智能防侧倾控制系统"):
        add("主动防倾杆", c.get("莲花智能防侧倾控制系统"))
    return chips


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    out = []
    cov = {k: 0 for k in ["price", "accel", "rangeKm", "totalRangeKm", "chargeEqMin", "wheelbase",
                          "turn", "suspF", "suspR", "suspAdj", "drive", "chips"]}
    grp = {}
    for idx, ws in enumerate(wb.worksheets):
        name = ws.title.strip()
        all_rows = list(ws.iter_rows(min_row=1, values_only=True))
        if not all_rows:
            continue
        hdr = all_rows[0]
        rows = all_rows[1:]
        colmap = {}  # ci -> {label:value}
        labels = {}
        for r in rows:
            lab = r[0]
            if not lab:
                continue
            lab = str(lab).strip()
            labels[lab] = 1
            for ci in range(1, len(r)):
                if r[ci] is not None:
                    colmap.setdefault(ci, {})[lab] = r[ci]
        # 车系级别/车身（取第一个非空款型）
        lv = bd = None
        for c in colmap.values():
            lv, bd = level_body(c.get("级别"))
            if lv and bd:
                break
        if not lv or not bd:
            continue
        # 逐款型解析（v8.9.2：续航/快充按款型能源归属，混动车系只取其插混/增程版型，
        # 避免车系内纯电版型的全电池续航污染增程组电板续航）
        trim_en, trims = [], []
        prices, accels, wbs, lens, wids, bats = [], [], [], [], [], []
        offroad = False
        for ci in sorted(colmap.keys()):
            c = colmap[ci]
            en = energy_of(c.get("能源类型") or c.get("燃料形式"))
            if en:
                trim_en.append(en)
            if c.get("低速四驱"):
                offroad = True  # v8.9.9：硬派越野判定（整体桥结构档用途条件规则）
            tprice = price(c.get("官方指导价"))
            taccel = num(c.get("官方百公里加速时间(s)"))
            twb = num(c.get("轴距(mm)"))
            if tprice is not None:
                prices.append(tprice)
            if taccel is not None:
                accels.append(taccel)
            if twb is not None:
                wbs.append(twb)
            if (v := num(c.get("长(mm)"))) is not None:
                lens.append(v)
            if (v := num(c.get("宽(mm)"))) is not None:
                wids.append(v)
            if (v := num(c.get("电池容量(kWh)"))) is not None:
                bats.append(v)
            t = {"en": en, "name": (str(hdr[ci]).strip() if ci < len(hdr) and hdr[ci] else f"版型{ci}"),
                 "price": tprice, "accel": taccel, "wb": twb,
                 "rng": None, "tot": None, "kwh": None, "eq": None}
            t["rng"] = num(c.get("纯电续航里程(km)CLTC") or c.get("纯电续航里程(km)工信部"))
            t["tot"] = num(c.get("综合续航里程(km)CLTC"))
            t["kwh"] = num(c.get("百公里耗电量(kWh/100km)"))
            fm, sp = fast_minutes(c.get("充电时间")), span(c.get("快充电量(%)"))
            if fm and sp:
                t["eq"] = round(fm * 60 / sp, 1)
            # v8.9.9 操稳四因子（按版型列取，高配独有CDC/空悬在版型切换时联动）
            t["turn"] = (lambda v: round(v, 2) if v is not None else None)(num(c.get("最小转弯半径")))
            t["suspF"] = str(c["前悬挂形式"]).strip() if c.get("前悬挂形式") else None
            t["suspR"] = str(c["后悬挂形式"]).strip() if c.get("后悬挂形式") else None
            t["suspAdj"] = susp_adj(c.get("可变悬挂调节"))
            t["drive"] = str(c["驱动方式"]).strip() if c.get("驱动方式") else None
            t["chips"] = [{"t": k, "std": v} for k, v in chassis_chips(c).items()]
            trims.append(t)
        es = set(trim_en)
        if es == {"ev"}:
            energy = "ev"
        elif es & {"ev", "x"}:
            energy = "x"
        elif es == {"ice"}:
            energy = "ice"
        else:
            energy = (trim_en[0] if trim_en else None)
        # 能源组版型池：纯电车系取纯电版型；增程/插混车系只取x版型（不拿同系纯电版）
        if energy == "ev":
            epool = [t for t in trims if t["en"] == "ev"]
        elif energy == "x":
            epool = [t for t in trims if t["en"] == "x"] or [t for t in trims if t["en"] != "ev"]
        else:
            epool = []
        ev_ranges = [t["rng"] for t in epool if t["rng"] is not None]
        tot_ranges = [t["tot"] for t in epool if t["tot"] is not None]
        eqmins = [t["eq"] for t in epool if t["eq"] is not None]
        kwhs = [t["kwh"] for t in epool if t["kwh"] is not None and energy == "ev"]
        turns = [t["turn"] for t in epool if t["turn"] is not None]
        pool_for_chip = epool or trims
        m = {}
        if prices:
            m["price"] = min(prices)
            m["priceHi"] = round(max(prices), 2)  # v8.9.6：指导价上限，供准则第1条"多版型价格区间重叠"圈选
        if accels: m["accel"] = min(accels)
        if wbs: m["wheelbase"] = int(max(wbs))
        if lens: m["length"] = int(max(lens))
        if wids: m["width"] = int(max(wids))
        if bats: m["battery"] = max(bats)
        if ev_ranges: m["rangeKm"] = int(max(ev_ranges))          # 纯电车=CLTC总续航；增程插混=电板纯电续航
        if tot_ranges: m["totalRangeKm"] = int(max(tot_ranges))   # 仅增程插混有值
        if kwhs: m["kwh100"] = round(min(kwhs), 1)
        if eqmins: m["chargeEqMin"] = min(eqmins)                 # v8.9.2：增程插混组同样参评快充
        # v8.9.9 操稳车系级聚合：转弯半径取最小（结构件全系一致）；悬挂形式取首个非空；
        # 可调悬架取全系最强；驱动方式按版型去重枚举（两驱/四驱版本并存时并列）
        if turns: m["turn"] = min(turns)
        sf = next((t["suspF"] for t in epool if t["suspF"]), None)
        sr = next((t["suspR"] for t in epool if t["suspR"]), None)
        if sf: m["suspF"] = sf
        if sr: m["suspR"] = sr
        adj_rank = {"软硬+高低": 3, "软硬": 2, "高低": 1}
        adjs = [t["suspAdj"] for t in epool if t["suspAdj"]]
        if adjs: m["suspAdj"] = max(adjs, key=lambda x: adj_rank.get(x, 0))
        drives = []
        for t in epool:
            if t["drive"] and t["drive"] not in drives:
                drives.append(t["drive"])
        if drives: m["drive"] = "/".join(drives)
        if offroad: m["offroad"] = 1
        chip_map = {}
        for t in pool_for_chip:
            for ch in t["chips"]:
                chip_map[ch["t"]] = ch["std"] if ch["t"] not in chip_map else (chip_map[ch["t"]] or ch["std"])
        if chip_map:
            m["chips"] = [{"t": k, "std": v} for k, v in chip_map.items()]
        if not m:
            continue
        # v8.9.8：版型明细（供前端"本车版型"选择栏）；仅取参评能源组版型（ev车=纯电版，x车=x版）
        trim_out = []
        for t in epool:
            rec = {"name": t["name"], "price": t["price"], "accel": t["accel"], "wheelbase": t["wb"],
                   "rangeKm": t["rng"], "totalRangeKm": t["tot"], "chargeEqMin": t["eq"],
                   "turn": t["turn"], "suspF": t["suspF"], "suspR": t["suspR"],
                   "suspAdj": t["suspAdj"], "drive": t["drive"], "chips": t["chips"]}
            if any(v is not None and v != [] for k, v in rec.items() if k != "name"):
                trim_out.append(rec)
        # 有价按价升序（入门在前），无价排末尾；同名去重
        seen_nm, trim_dedup = set(), []
        for rec in sorted(trim_out, key=lambda r: (r["price"] is None, r["price"] or 0)):
            if rec["name"] not in seen_nm:
                seen_nm.add(rec["name"])
                trim_dedup.append(rec)
        for k in cov:
            if k in m:
                cov[k] += 1
        grp[f"{lv}|{bd}|{energy or '?'}"] = grp.get(f"{lv}|{bd}|{energy or '?'}", 0) + 1
        out.append({"id": f"dcd{idx}", "name": name, "level": lv, "body": bd,
                    "energy": energy or "?", "m": m, "trims": trim_dedup})

    js = "/* 懂车帝参数影子库（公司AI采集工具导出，2026-10基准月；厂商配置表转录口径）。\n" \
         "   815车系sheet自动抽取，口径同data_base.js（入门价/全系最优/快充SOC归一）。\n" \
         "   v8.9.2：续航与快充按款型能源归属——纯电车系取纯电版型，增程/插混车系只取其x版型；\n" \
         "   rangeKm对x车=电板CLTC纯电续航，totalRangeKm=满油满电综合续航（仅x）。\n" \
         "   v8.9.6：m.priceHi=全系指导价上限，圈选按多版型价格区间重叠（准则§9.9第1条）。\n" \
         "   v8.9.8：trims[]=参评能源组版型明细（款型名/价/加速/纯电/综合/eq快充/轴距，价升序），供前端版型选择栏。\n" \
         "   v8.9.9：操稳handling四因子——turn最小转弯半径、suspF/suspR前后悬原文、suspAdj可调(无/软硬/软硬+高低)、\n" \
         "   drive驱动方式、chips高阶底盘配置（空悬/魔毯/电磁/后轮转向/可变转向比/线控/全主动，标标配/选装）；offroad=低速四驱硬派判定。\n" \
         "   与data_base.js手工库及在库车按车名去重，已存在者不覆盖。生成：import_dcd.py */\n" \
         "window.DCD_CARS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (BASE / "webapp" / "js" / "data_dcd.js").write_text(js, encoding="utf-8")
    rawdir = BASE / "data" / "raw" / "2026-10"
    rawdir.mkdir(parents=True, exist_ok=True)
    (rawdir / "dcd_shadow.json").write_text(
        json.dumps({"source": "懂车帝竞品数据.xlsx（公司AI采集工具导出）", "schema": "v8.9.9",
                    "n": len(out), "cars": out},
                   ensure_ascii=False), encoding="utf-8")
    print("CARS:", len(out), "COV:", cov)
    key = {k: v for k, v in grp.items() if k.startswith(("中大型|suv", "中型|suv", "中大型|sedan"))}
    print("FOCUS:", json.dumps(key, ensure_ascii=False))
    # 中大型SUV增程插混组三轴覆盖（N70视角）
    xs = [c for c in out if c["level"] == "中大型" and c["body"] == "suv" and c["energy"] == "x"]
    evs = [c for c in out if c["level"] == "中大型" and c["body"] == "suv" and c["energy"] == "ev"]
    print("MIDSUV x:", len(xs), "fields:", {k: sum(1 for c in xs if k in c["m"])
          for k in ("price", "rangeKm", "totalRangeKm", "chargeEqMin")})
    print("MIDSUV ev:", len(evs), "fields:", {k: sum(1 for c in evs if k in c["m"])
          for k in ("price", "rangeKm", "chargeEqMin")})


if __name__ == "__main__":
    main()
