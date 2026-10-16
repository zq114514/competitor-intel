/* ============================================================
 * 竞品技术情报站 · AI性能定位分析引擎（本地规则引擎）
 * 纯原生JS、零依赖、离线可用；数据不出内网。
 * 原理：参数抽取 → 同级分位归一 → 六轴性能画像 → 规则化结论。
 * 所有结论均可点回具体参数，不使用生成式模型、不产生推断数据。
 * 飞书智能伙伴深度解读为可选增强（见文件末 LarkAI 适配层）。
 * ============================================================ */
(function () {
  'use strict';

  /* ================= 一、归一化工具（级别/车身/能源/价格） ================= */
  const LEVEL_RANK = { '微型': 0, '小型': 1, '紧凑': 2, '中型': 3, '中大型': 4, '大型': 5 };
  const LEVEL_PATTERNS = ['中大型', '大型', '中型', '紧凑', '小型', '微型'];
  function normLevel(seg) {
    if (!seg) return null;
    if (/大六座|大四座/.test(seg)) return '大型';
    for (const lv of LEVEL_PATTERNS) if (seg.includes(lv)) return lv;
    return null;
  }
  // seg 营销化普遍（"家用SUV/运动轿车/方盒子SUV/硬派越野"），车身联合 specs['车身结构'] 判定
  function normBody(seg, struct) {
    const s = ((seg || '') + ' ' + (struct || '')).toUpperCase();
    if (/MPV/.test(s)) return 'mpv';
    if (/皮卡|PICKUP/.test(s)) return 'pickup';
    if (/SUV/.test(s)) return 'suv';
    if (/越野|非承载/.test(s)) return 'suv';
    if (/三厢|两厢|掀背|旅行|猎装|轿跑|轿车/.test(s)) return 'sedan';
    if (/车/.test(seg || '')) return 'sedan';
    return null;
  }
  const BODY_NAME = { suv: 'SUV', sedan: '轿车', mpv: 'MPV', pickup: '皮卡' };

  /* --- 级别判定：官方级别词优先；seg 无级别词时按车长/轴距机械推定（就低原则，避免夸大） ---
     档位 1紧凑 2中型 3中大型 4大型；L=车长三上界，W=轴距三上界，两档不一致时取较低档 */
  const BAND_NAME = { 1: '紧凑', 2: '中型', 3: '中大型', 4: '大型' };
  const SIZE_RULES = {
    suv:    { L: [4650, 4850, 5050], W: [2700, 2850, 2950] },
    sedan:  { L: [4700, 4900, 5100], W: [2750, 2900, 3000] },
    mpv:    { L: [4750, 4950, 5200], W: [2850, 2950, 3150] },
    pickup: { L: [5000, 5200, 5400], W: [2900, 3050, 3200] },
  };
  function sizeBand(v, cuts) {
    if (v == null) return null;
    if (v < cuts[0]) return 1;
    if (v < cuts[1]) return 2;
    if (v < cuts[2]) return 3;
    return 4;
  }
  function deriveLevel(c, body, M) {
    // AH官方级别校准优先（2026-10 影子库归组核对后对在库车的人工裁定，见SOP附录D复评记录）
    if (c.ahLevel) return { level: c.ahLevel, source: 'ah' };
    const segText = c.seg || (c.specs && (c.specs['级别'] || c.specs['车身结构'])) || '';
    const off = normLevel(segText);
    if (off) return { level: off, source: 'official' };
    const rule = SIZE_RULES[body];
    if (!rule || !M) return { level: null, source: 'none' };
    const bL = sizeBand(M.length && M.length.v, rule.L);
    const bW = sizeBand(M.wheelbase && M.wheelbase.v, rule.W);
    let band = null;
    if (bL != null && bW != null) band = Math.min(bL, bW);
    else band = bL != null ? bL : bW;
    return band ? { level: BAND_NAME[band], source: 'size' } : { level: null, source: 'none' };
  }
  function normEnergyTag(power, specText) {
    const s = (power || '') + ' ' + (specText || '');
    if (/增程/.test(s)) return 'x';
    if (/插混|插电|DM|混动/.test(s)) return 'x';
    if (/纯电/.test(s)) return 'ev';
    if (/燃油|汽油|柴油/.test(s) && !/新能源/.test(s)) return 'ice';
    return '?';
  }
  const ENERGY_NAME = { ev: '纯电', x: '插混/增程', ice: '燃油', '?': '未知' };

  // 价格解析（万元）。v8.2口径：权益价=售价；仅剔除BaaS/电池租用段。取最低数字。
  function parsePrice(c) {
    let s = c.price;
    if ((s == null || s === '—') && c.specs && c.specs['售价 万'] != null && c.specs['售价 万'] !== '—') {
      const n = parseFloat(c.specs['售价 万']);
      return isNaN(n) ? null : { min: n, max: n };
    }
    if (s == null) return null;
    s = String(s);
    const parts = s.split(/[/／]/).filter(x => !/BaaS|电池租用/i.test(x)).join(' ');
    const nums = [];
    const re = /(\d+\.?\d*)\s*万/g; let m;
    while ((m = re.exec(parts)) !== null) nums.push(parseFloat(m[1]));
    if (!nums.length) return null;
    return { min: Math.min(...nums), max: Math.max(...nums) };
  }

  /* ================= 二、指标抽取 ================= */
  // 取区间内全部合法数字
  function nums(v, lo, hi) {
    if (v == null) return [];
    return (String(v).match(/\d+\.?\d*/g) || [])
      .map(parseFloat).filter(n => n >= lo && n <= hi);
  }
  // 多版本值（如"3.8-6.5""245-425"）统一按"官方公布全系最优"取值：dir=1取最大，dir=-1取最小
  // 口径依据：车企卖点均按最强版型宣传，各车统一取能力上限横比，公平且可复核
  function bestNum(v, lo, hi, dir) {
    const a = nums(v, lo, hi);
    if (!a.length) return null;
    return dir < 0 ? Math.min.apply(null, a) : Math.max.apply(null, a);
  }
  function spec(c, key) { return c.specs ? c.specs[key] : null; }

  // 快充分钟数解析（v8.9.5）：
  //  支持 "12分钟"/"8分25秒"/"8分半"/"45秒"/"11.6min"；区间或列举共用单位（"16.5-19分钟""24/22分钟"）逐值展开取最快。
  //  无SOC窗口的纯宣传口径（"闪充11分钟补能500km"）仍返回数值但由eqMin折算环节判null——本函数只负责时间本身。
  function parseChargeMinutes(s) {
    if (!s) return null;
    const t = String(s);
    const cands = [];
    // ① 区间/列举共用一个时间单位："16.5-19分钟""24/22分钟" → 展开链上每个数字（先摘除，避免后面重复计入）
    const stripped = t.replace(/((?:\d+(?:\.\d+)?)\s*[-–~/至]\s*)+\d+(?:\.\d+)?\s*分钟/g, (m) => {
      (m.match(/\d+(?:\.\d+)?/g) || []).forEach(x => cands.push(parseFloat(x)));
      return ' ';
    });
    // ② X分Y秒 / X分钟 / X分
    let m;
    const reMin = /(\d+(?:\.\d+)?)\s*分(?:钟)?(?:\s*(\d+(?:\.\d+)?)\s*秒)?/g;
    while ((m = reMin.exec(stripped))) {
      let v = parseFloat(m[1]);
      if (m[2] != null) v += parseFloat(m[2]) / 60;
      cands.push(v);
    }
    // ③ X分半
    const reHalf = /(\d+(?:\.\d+)?)\s*分半/g;
    while ((m = reHalf.exec(stripped))) cands.push(parseFloat(m[1]) + 0.5);
    // ④ 纯秒（②已吃掉"分Y秒"中的秒；先屏蔽"分Y秒"片段，剩余的才是独立秒数）
    const secText = stripped.replace(/\d+(?:\.\d+)?\s*分(?:钟)?\s*\d+(?:\.\d+)?\s*秒/g, '＃');
    const reSec = /(\d+(?:\.\d+)?)\s*秒/g;
    while ((m = reSec.exec(secText))) cands.push(parseFloat(m[1]) / 60);
    // ⑤ 英文 min（11.7/10.7min 等）
    const reEn = /(\d+(?:\.\d+)?)\s*min\b/gi;
    while ((m = reEn.exec(stripped))) cands.push(parseFloat(m[1]));
    if (!cands.length) return null;
    return Math.min.apply(null, cands);
  }

  // 返回 {key: {v: 数值, raw: 原始展示文本}}；v=null 表示未披露/不可比
  function extractMetrics(c) {
    const M = {};
    const put = (key, v, raw) => { M[key] = { v: v == null ? null : v, raw: raw != null ? String(raw) : (v == null ? null : String(v)) }; };
    const pr = parsePrice(c);
    put('price', pr ? pr.min : null, pr ? pr.min + '万' : null);
    put('accel', bestNum(spec(c, '零百加速 s'), 2, 25, -1), spec(c, '零百加速 s'));
    let kw = bestNum(spec(c, '最大功率 kW'), 10, 2500, 1);
    if (kw == null) {
      const a = bestNum(spec(c, '前电机功率 Kw'), 1, 1500, 1), b = bestNum(spec(c, '后电机功率 Kw'), 1, 1500, 1);
      kw = (a || 0) + (b || 0) || null;
    }
    put('powerKw', kw, spec(c, '最大功率 kW'));
    put('rangeKm', bestNum(spec(c, '纯电续航 km'), 50, 2500, 1), spec(c, '纯电续航 km'));
    // CLTC综合续航（满油满电）：仅增程/插混车有意义（v8.9.2 LACU增程组综合续航轴）；纯电车不采
    put('totalRangeKm', bestNum(spec(c, '综合续航 km'), 100, 3000, 1), spec(c, '综合续航 km'));
    put('kwh100', bestNum(spec(c, '百公里电耗 kWh/100KM'), 5, 45, -1), spec(c, '百公里电耗 kWh/100KM'));
    put('battery', bestNum(spec(c, '电池能量 kWh'), 5, 300, 1), spec(c, '电池能量 kWh'));

    // 补能：新车 fastCharge 文本；竞品库 充电时间 h
    const fc = spec(c, 'fastCharge');
    // v8.9.5：快充时长解析加固——
    //  ① 支持"8分25秒/8分半/45秒/11.6min"等写法（旧版只认"X分钟"，致战舰700/全新E5误判未披露）；
    //  ② 多版型区间/列举共用一个时间单位（"16.5-19分钟""24/22分钟"）逐值展开，取最快值（竞品比能力上限）。
    let cmin = null, cminRaw = null, ckw = null, ckwRaw = null;
    if (fc) {
      cmin = parseChargeMinutes(fc);
      if (cmin != null) cminRaw = (Math.round(cmin * 100) / 100) + '分钟';
      const pk = String(fc).match(/峰值\s*(\d+\.?\d*)\s*kW/);
      const ak = String(fc).match(/(\d+\.?\d*)\s*kW/);
      if (pk) { ckw = parseFloat(pk[1]); ckwRaw = pk[1] + 'kW'; }
      else if (ak) { ckw = parseFloat(ak[1]); ckwRaw = ak[1] + 'kW'; }
    }
    if (cmin == null) {
      const hRaw = spec(c, '充电时间 h');
      const h = bestNum(hRaw, 0.05, 5, -1);
      if (h != null) { cmin = Math.round(h * 60); cminRaw = String(hRaw).match(/\d+\.?\d*/)[0] + 'h'; }
    }
    put('chargeMin', cmin, cminRaw);
    put('chargeKw', ckw, ckwRaw);
    // 等效20-80%快充分钟（LACU补能轴v8.9）：官方快充时间按SOC窗口线性归一 eqMin=分钟×60/(结束%-开始%)
    // 各厂窗口不一（10-80/20-80/30-80），线性折算是显式近似；无窗口或无时间者null，不推断
    let eqMin = null, eqRaw = null;
    if (fc && cmin != null) {
      const wm = String(fc).match(/(\d+(?:\.\d+)?)\s*%?\s*[-–~至]\s*(\d+(?:\.\d+)?)\s*%/);
      if (wm) {
        const span = parseFloat(wm[2]) - parseFloat(wm[1]);
        if (span > 0) { eqMin = Math.round(cmin * 60 / span * 10) / 10; eqRaw = `${Math.round(cmin * 100) / 100}分钟(${wm[1]}-${wm[2]}%)→${eqMin}min`; }
      }
    }
    put('chargeEqMin', eqMin, eqRaw);

    // 智驾：算力TOPS / 激光雷达颗数
    const aiText = [c.adas, spec(c, '智驾芯片'), spec(c, '激光雷达')].filter(Boolean).join(' ');
    let tops = null;
    const tm = aiText.match(/(\d+(?:\.\d+)?)\s*TOPS/i);
    if (tm) tops = parseFloat(tm[1]);
    put('tops', tops, tm ? tm[0] : null);
    let lidar = null, lidarRaw = null;
    const lm = aiText.match(/(\d+)\s*颗[^，。；,;]{0,8}?激光雷达/) || aiText.match(/(\d+)\s*激光雷达/);
    if (lm) { lidar = parseInt(lm[1], 10); lidarRaw = lm[1] + '颗'; }
    else {
      const f = spec(c, '激光雷达');
      const n2 = f ? bestNum(f, 0, 8, 1) : null;
      if (n2 != null) { lidar = n2; lidarRaw = n2 + '颗'; }
    }
    put('lidar', lidar > 8 ? null : lidar, lidarRaw);

    put('airbag', bestNum(spec(c, '气囊数'), 1, 30, 1), spec(c, '气囊数'));
    // 越野几何（LACU试点通过性维度）
    put('clearance', bestNum(spec(c, '最小离地间隙 mm'), 80, 500, 1), spec(c, '最小离地间隙 mm'));
    put('wading', bestNum(spec(c, '涉水深度 mm'), 200, 1500, 1), spec(c, '涉水深度 mm'));
    put('wheelbase', bestNum(spec(c, '轴距 mm'), 2000, 4200, 1), spec(c, '轴距 mm'));
    put('length', bestNum(spec(c, '长 mm'), 3000, 6200, 1), spec(c, '长 mm'));
    put('width', bestNum(spec(c, '宽 mm'), 1500, 2300, 1), spec(c, '宽 mm'));
    return M;
  }

  /* ================= 三、性能轴、权重与品类能力分标准卡（20261009b 混合锚点V2） =================
     评分性质：能力分（绝对标尺）。锚点按"同级品类（级别×车身）"分卡设定。
     V2混合锚点（试点三组：中型SUV/中大型SUV/中大型轿车）：100分=品类工程天花板（年检），
     90/75/60/45/30分=行业基准影子库市场分位P90/P75/P60/P45/P30（AH公开参数，半年滚动）；
     其余六组仍为工程经验锚点，面板标注"试行未校准"。续航按车身校准、充电为全品类统一校准；
     算力/激光雷达/气囊因行业库无同源口径数据，保留经验锚点，基准车不参与该两轴座次。
     名次（同级第N/M）为附属座次，分母=在库车＋行业基准车。相邻锚点间分段线性插值，无档位跳变。
     锚点评审/置信带/复评记录见SOP附录D，评审表 data/raw/2026-10/anchor_review_20261009.md。 */
  const AXES = [
    { key: 'power',  name: '动力性能', color: '#ff6b4a', metrics: ['accel', 'powerKw'] },
    { key: 'energy', name: '续航能耗', color: '#52c878', metrics: ['rangeKm', 'kwh100'], note: 'CLTC纯电续航与电耗，仅纯电车型参评' },
    { key: 'charge', name: '补能效率', color: '#35d0e0', metrics: ['chargeKw'], note: '仅纯电车型参评；快充时间各厂SOC窗口不同，仅陈列不计分' },
    { key: 'smart',  name: '智能驾驶', color: '#a878f0', metrics: ['tops', 'lidar'], note: '基于算力/激光雷达硬件代理，非实际智驾能力' },
    { key: 'safe',   name: '被动安全', color: '#e2574f', metrics: ['airbag'], note: '基于气囊数量；主动安全库内未结构化，暂不计分' },
    { key: 'space',  name: '空间尺寸', color: '#f0a13a', metrics: ['wheelbase', 'length', 'width'] },
  ];
  // 轴内权重：结果性指标>投入性指标；同源指标不重复计高权
  const AXIS_W = {
    power:  { accel: 0.70, powerKw: 0.30 },
    energy: { rangeKm: 0.60, kwh100: 0.40 },
    charge: { chargeKw: 1 },
    smart:  { tops: 0.60, lidar: 0.40 },
    safe:   { airbag: 1 },
    space:  { wheelbase: 0.40, length: 0.30, width: 0.30 },
  };
  // 轴间权重预设（面板可一键切换，全透明）
  const PRESETS = {
    equal:  { name: '综合（等权）', w: { power: 1 / 6, energy: 1 / 6, charge: 1 / 6, smart: 1 / 6, safe: 1 / 6, space: 1 / 6 } },
    sport:  { name: '性能取向',   w: { power: .25, charge: .20, smart: .20, energy: .15, safe: .10, space: .10 } },
    family: { name: '家用取向',   w: { space: .25, energy: .20, safe: .20, charge: .15, power: .10, smart: .10 } },
  };

  // 锚点分数列：每个 cuts 数组依次对应 100/90/75/60/45/30 分（端点外按末段斜率外推，钳制0-100）
  const BANDS = [100, 90, 75, 60, 45, 30];
  const gk = (level, body) => level + '|' + body;
  // 品类锚点：零百加速(s)/最大功率(kW)/百公里电耗/轴距/车长/车宽，按 级别×车身 分卡
  const STD = {
    accel: {
      '中大型|sedan': [2.5, 2.92, 3.42, 3.85, 4.77, 5.97], '中型|sedan': [4.0, 4.8, 5.8, 7.0, 8.5, 10.5], '紧凑|sedan': [4.5, 5.5, 6.8, 8.0, 9.5, 11.5],
      '中大型|suv': [2.8, 3.9, 4.3, 4.7, 5.32, 5.74], '中型|suv': [2.9, 4.05, 4.33, 5.8, 6.38, 6.7], '紧凑|suv': [5.0, 6.0, 7.2, 8.5, 10, 12],
      '大型|suv': [4.8, 5.8, 7.2, 8.8, 10.5, 13], '大型|mpv': [4.8, 5.8, 7.2, 8.8, 10.5, 12.5], '中大型|mpv': [5.8, 6.8, 8.2, 9.8, 11.5, 13.5],
    },
    powerKw: {
      '中大型|sedan': [1000, 701, 487, 397, 268, 239], '中型|sedan': [420, 350, 270, 200, 150, 110], '紧凑|sedan': [350, 280, 220, 160, 120, 90],
      '中大型|suv': [800, 575, 423, 402, 335, 250], '中型|suv': [600, 410, 364, 239, 210, 185], '紧凑|suv': [330, 270, 200, 150, 110, 85],
      '大型|suv': [550, 450, 350, 260, 190, 140], '大型|mpv': [500, 400, 300, 220, 160, 120], '中大型|mpv': [420, 340, 260, 200, 150, 110],
    },
    kwh100: {
      '紧凑|sedan': [10.5, 11.3, 12.3, 13.5, 15, 17], '中型|sedan': [11, 12, 13, 14.2, 16, 18], '中大型|sedan': [10.5, 11.3, 12.0, 13.2, 13.7, 14.1],
      '紧凑|suv': [12, 13, 14.5, 16, 18, 20], '中型|suv': [11.0, 12.26, 12.9, 13.68, 14.3, 14.82], '中大型|suv': [12.3, 12.86, 12.9, 14.14, 15.34, 15.76],
      '大型|suv': [15, 16.5, 18, 19.5, 21.5, 24], '大型|mpv': [15.5, 17, 18.5, 20, 22, 24], '中大型|mpv': [14.5, 16, 17.5, 19, 21, 23],
    },
    wheelbase: {
      '紧凑|sedan': [2820, 2760, 2700, 2640, 2580, 2520], '中型|sedan': [2960, 2890, 2820, 2750, 2690, 2630], '中大型|sedan': [3130, 3108, 3081, 3060, 3010, 3000],
      '紧凑|suv': [2780, 2730, 2680, 2620, 2560, 2500], '中型|suv': [2980, 2950, 2930, 2922, 2891, 2868], '中大型|suv': [3120, 3048, 3000, 2980, 2964, 2935],
      '大型|suv': [3150, 3060, 2970, 2890, 2820, 2760], '大型|mpv': [3350, 3240, 3130, 3030, 2940, 2860], '中大型|mpv': [3220, 3130, 3040, 2950, 2870, 2800],
    },
    length: {
      '紧凑|sedan': [4770, 4700, 4620, 4530, 4440, 4350], '中型|sedan': [4970, 4900, 4820, 4730, 4640, 4550], '中大型|sedan': [5240, 5171, 5115, 5090, 5057, 5018],
      '紧凑|suv': [4720, 4650, 4570, 4480, 4390, 4300], '中型|suv': [5000, 4923, 4857, 4834, 4825, 4793], '中大型|suv': [5160, 5117, 5059, 5042, 5011, 4989],
      '大型|suv': [5300, 5200, 5100, 5000, 4900, 4800], '大型|mpv': [5450, 5350, 5230, 5110, 5000, 4900], '中大型|mpv': [5270, 5200, 5110, 5020, 4930, 4840],
    },
    width: {
      '紧凑|sedan': [1880, 1840, 1800, 1760, 1720, 1680], '中型|sedan': [1930, 1890, 1845, 1800, 1755, 1710], '中大型|sedan': [2010, 1996, 1967, 1960, 1923, 1904],
      '紧凑|suv': [1900, 1860, 1820, 1780, 1740, 1700], '中型|suv': [2000, 1963, 1940, 1930, 1920, 1909], '中大型|suv': [2020, 2011, 1998, 1991, 1980, 1962],
      '大型|suv': [2050, 2000, 1950, 1900, 1850, 1800], '大型|mpv': [2030, 1990, 1945, 1900, 1855, 1810], '中大型|mpv': [2010, 1970, 1925, 1880, 1835, 1790],
    },
  };
  // 续航按车身分卡（风阻差异；同车身各级电池随尺寸同步增大，净续航分布近似）
  const STD_BODY = {
    rangeKm: {
      // V2混合锚点（2026-10）：轿车n=16/SUV n=26（纯电，按车身合并两级），100=工程天花板，90-30=市场分位
      sedan: [900, 836, 811, 725, 704, 691],
      suv: [900, 828, 775, 725, 678, 655],
      mpv: [750, 650, 560, 480, 400, 320],
    },
  };
  // 全品类统一尺：平台/装备属性与车型品类无关
  const STD_UNIV = {
    // V2混合锚点（2026-10，n=23）：100档800kW为裁定工程上限（兆瓦平台已量产但取保守封顶）
    chargeKw: [800, 520, 408, 270, 240, 180],
    // 以下两项AH影子库无同源口径数据（算力全系空白；AH气囊为5类点位计数，与官方8-12气囊口径不同），保留经验锚点
    tops: [750, 508, 254, 128, 60, 20],
    airbag: [12, 10, 8, 6, 4, 2],
  };
  const LIDAR_SCORE = { 0: 40, 1: 58, 2: 72, 3: 85, 4: 95 };
  const STD_VER = '20261010a';
  // V2混合锚点元数据：100档=品类工程天花板（年检），90/75/60/45/30档=市场滚动分位P90/P75/P60/P45/P30（半年滚动）
  // 校准方法/bootstrap置信带/复评记录见 SOP附录D；低分位置信带原始数据 data/raw/2026-10/base_percentiles.json
  const ANCHOR_V2 = {
    month: '2026-10',
    calibratedGroups: { '中型|suv': 30, '中大型|suv': 26, '中大型|sedan': 24 },
    rangeN: { suv: 26, sedan: 16 }, chargeN: 23,
    lowConfNote: { '中大型|suv': '电耗卡纯电样本仅9款，P10/P25区间扁平，标注试行值，随纯电新车扩充半年复算' },
  };
  function cardCalibrated(level, body) { return !!ANCHOR_V2.calibratedGroups[gk(level, body)]; }
  const LEVEL_SRC_TXT = { official: '官方标注', ah: 'AH官方级别（2026-10校准）', size: '按车长/轴距推定', none: '—' };

  // 取品类锚点：精确组 → 同车身级别就近 → null
  function groupCuts(metric, level, body) {
    const tbl = STD[metric];
    if (!tbl) return null;
    if (tbl[gk(level, body)]) return tbl[gk(level, body)];
    const want = LEVEL_RANK[level];
    if (want == null) return null;
    let best = null, bd = 99;
    Object.keys(tbl).forEach(k => {
      const [lv, bd2] = k.split('|');
      if (bd2 !== body || LEVEL_RANK[lv] == null) return;
      const d = Math.abs(LEVEL_RANK[lv] - want);
      if (d < bd) { bd = d; best = tbl[k]; }
    });
    return best;
  }
  // 锚点分段线性插值（cuts 依次对应 BANDS；排序后自动适配"越大越好/越小越好"）
  // 评分下限=30（20261010a 用户裁定）：低于末锚点（30分档/市场P30）不再外推，统一记30分下限档——
  // 外推会把P30以下的差距放大成0-30分悬崖，对低价位车失真；真实差距由座次与同级均值反映
  function anchorScore(v, cuts) {
    if (v == null || !cuts || !cuts.length) return null;
    const pts = cuts.map((c, i) => ({ c, s: BANDS[i] })).sort((a, b) => a.c - b.c);
    const interp = (p0, p1, x) => p0.s + (p1.s - p0.s) * (x - p0.c) / (p1.c - p0.c);
    let s;
    if (v <= pts[0].c) s = interp(pts[0], pts[1], v);
    else if (v >= pts[pts.length - 1].c) s = interp(pts[pts.length - 2], pts[pts.length - 1], v);
    else {
      for (let i = 1; i < pts.length; i++) {
        if (v <= pts[i].c) { s = interp(pts[i - 1], pts[i], v); break; }
      }
    }
    return Math.max(30, Math.min(100, Math.round(s)));
  }
  const METRIC_META = {
    price:     { name: '售价', unit: '万', dir: -1 },
    accel:     { name: '零百加速', unit: 's', dir: -1 },
    powerKw:   { name: '最大功率', unit: 'kW', dir: 1 },
    rangeKm:   { name: 'CLTC纯电续航', unit: 'km', dir: 1, evOnly: true },
    totalRangeKm: { name: 'CLTC综合续航', unit: 'km', dir: 1, evOnly: false },
    kwh100:    { name: '百公里电耗', unit: 'kWh', dir: -1, evOnly: true },
    battery:   { name: '电池电量', unit: 'kWh', dir: 1 },
    chargeMin: { name: '快充时间', unit: 'min', dir: -1 },
    chargeKw:  { name: '峰值充电功率', unit: 'kW', dir: 1, evOnly: true },
    chargeEqMin: { name: '等效20-80%快充时间', unit: 'min', dir: -1, evOnly: true },
    clearance: { name: '最小离地间隙', unit: 'mm', dir: 1 },
    tops:      { name: '智驾算力', unit: 'TOPS', dir: 1 },
    lidar:     { name: '激光雷达', unit: '颗', dir: 1 },
    airbag:    { name: '安全气囊', unit: '个', dir: 1 },
    wheelbase: { name: '轴距', unit: 'mm', dir: 1 },
    length:    { name: '车长', unit: 'mm', dir: 1 },
    width:     { name: '车宽', unit: 'mm', dir: 1 },
    // v8.9.9 操稳（SE3 handling）四因子
    turn:      { name: '最小转弯半径', unit: 'm', dir: -1 },
    suspF:     { name: '前悬挂形式', unit: '', dir: 0 },
    suspR:     { name: '后悬挂形式', unit: '', dir: 0 },
    suspAdj:   { name: '可调悬架', unit: '', dir: 0 },
    drive:     { name: '驱动方式', unit: '', dir: 0 },
    offroad:   { name: '硬派越野', unit: '', dir: 0 },
    chips:     { name: '高阶底盘配置', unit: '', dir: 0 },
  };
  // 对比表展示行（顺序即展示顺序）
  const TABLE_METRICS = ['price', 'accel', 'powerKw', 'rangeKm', 'kwh100', 'chargeKw', 'chargeMin', 'tops', 'lidar', 'airbag', 'wheelbase', 'length', 'width'];

  // 统一展示文本：原文已带单位/口径（如"710（CLTC）""2560TOPS""0.43h"）则直显，否则补标准单位
  function displayOf(d, mk) {
    const m = d.M[mk];
    if (!m || m.v == null) return { text: '—', v: null };
    const raw = m.raw != null ? String(m.raw) : '';
    const hasUnit = /[A-Za-z\u4e00-\u9fa5]/.test(raw);
    return { text: hasUnit ? raw : (m.v + (METRIC_META[mk].unit || '')), v: m.v, raw };
  }

  function buildPool() {
    const map = new Map();
    (typeof CARS !== 'undefined' ? CARS : []).forEach(c => {
      if (!map.has(c.id)) map.set(c.id, decorate(c, 'month'));
    });
    (typeof COMP_CARS !== 'undefined' ? COMP_CARS : []).forEach(c => {
      if (!map.has(c.id)) map.set(c.id, decorate(c, 'library'));
    });
    // 行业基准影子库：灰色背景板，仅用于锚点已校定后的同级座次分母与均值（不进卡片/对比篮/价格）
    (typeof BASE_CARS !== 'undefined' ? BASE_CARS : []).forEach(b => {
      if (!map.has(b.id)) map.set(b.id, decorateBase(b));
    });
    // 懂车帝采集工具大库（815车系抽取690）：按车名与在库/手工影子库去重；
    // 命中手工base车时不覆盖已核验值，仅回填base缺失的指标字段（v8.9.2：综合续航/增程组快充等）；命中在库车一律不覆盖聚合M值
    // v8.9.8：归一化兼容"全新/新一代/第N代/2027款"等冠词（银河E5=银河全新E5、长安启源A06），但不剥"版/款"尾缀防误伤版型车
    const normNm = s => String(s || '').replace(/[\s·]/g, '')
      .replace(/(EV|PHEV|DM-?i?|纯电|增程)$/i, '')
      .replace(/全新|新一代|第[一二三四五六1-9]代/g, '')
      .replace(/20\d{2}款?/g, '');
    (typeof DCD_CARS !== 'undefined' ? DCD_CARS : []).forEach(b => {
      const cn = normNm(b.name);
      const hit = Array.from(map.values()).find(d => {
        const n = normNm(d.name);
        return n === cn || (cn.length >= 2 && (n.indexOf(cn) >= 0 || cn.indexOf(n) >= 0));
      });
      if (hit) {
        if (hit.srcKind === 'base' && hit.M) {
          Object.keys(b.m || {}).forEach(k => {
            if ((!hit.M[k] || hit.M[k].v == null) && b.m[k] != null) {
              hit.M[k] = { v: b.m[k], raw: String(b.m[k]) + ((METRIC_META[k] && METRIC_META[k].unit) || '') };
            }
          });
        }
        // v8.9.8：懂车帝版型明细挂接给在库/手工车（同能源才挂，纯电不挂PHEV版型；data.js手工trims优先）
        if (b.trims && b.trims.length && b.energy === hit.energy
            && !(hit.raw && Array.isArray(hit.raw.trims) && hit.raw.trims.length)) {
          hit.raw = hit.raw || {};
          hit.raw.trims = b.trims;
        }
        // v8.9.9：在库车命中dcd同能源车时，回填操稳官方转录字段（在库车本身无这些结构化字段，
        // 属官方配置表同源补采，不覆盖任何已有值）；数组型chips直接挂
        if (b.energy === hit.energy) {
          ['turn', 'suspF', 'suspR', 'suspAdj', 'drive', 'offroad', 'chips'].forEach(k => {
            if (b.m && b.m[k] != null && !(hit.M[k] && hit.M[k].v != null)) {
              const v = b.m[k];
              hit.M[k] = { v, raw: Array.isArray(v) ? null : String(v) + ((METRIC_META[k] && METRIC_META[k].unit) || '') };
            }
          });
        }
        return;
      }
      map.set(b.id, decorateBase({ ...b, srcKind: 'dcd' }));
    });
    return Array.from(map.values());
  }
  // 影子库记录直接构造装饰对象：M为已抽取数值，跳过 specs 文本抽取；不含价格/智驾/气囊字段
  function decorateBase(b) {
    const M = {};
    const ALL = ['price', 'priceHi', 'accel', 'powerKw', 'rangeKm', 'totalRangeKm', 'kwh100', 'battery', 'chargeMin',
      'chargeKw', 'chargeEqMin', 'clearance', 'tops', 'lidar', 'airbag', 'wheelbase', 'length', 'width',
      'turn', 'suspF', 'suspR', 'suspAdj', 'drive', 'offroad', 'chips'];
    ALL.forEach(k => { M[k] = { v: null, raw: null }; });
    Object.keys(b.m || {}).forEach(k => {
      const v = b.m[k];
      M[k] = { v: v == null ? null : v, raw: (v == null || Array.isArray(v)) ? null : String(v) + ((METRIC_META[k] && METRIC_META[k].unit) || '') };
    });
    return {
      id: b.id, name: b.name, brand: '', seg: b.level + (BODY_NAME[b.body] || ''),
      img: null,
      raw: { specs: {}, _base: true, trims: Array.isArray(b.trims) && b.trims.length ? b.trims : undefined,
        _specUrl: b.srcKind === 'dcd'
          ? 'https://www.dongchedi.com/search?keyword=' + encodeURIComponent(b.name) : null },
      srcKind: b.srcKind || 'base',
      level: b.level, levelSource: 'ah', body: b.body, energy: b.energy || '?', M,
    };
  }
  function decorate(c, srcKind) {
    const energyType = c.specs && (c.specs['能源类型'] || c.specs['能源']);
    const segText = c.seg || (c.specs && c.specs['级别']) || '';
    const body = normBody(segText, c.specs && c.specs['车身结构']);
    const d = {
      id: c.id, name: c.name, brand: c.brand || (c.specs && c.specs['厂商']) || '',
      seg: segText,
      img: c.img, raw: c, srcKind,
      level: null, levelSource: 'none', body,
      energy: normEnergyTag(c.power, energyType),
    };
    d.M = extractMetrics(c);
    const lv = deriveLevel(c, body, d.M);
    d.level = lv.level; d.levelSource = lv.source;
    return d;
  }

  // 同级基准组：严格 = 尺寸级别 × 车身形式（能源不拆组，动力/空间/智能/补能可跨能源比；
  // 续航/电耗由指标 evOnly 自动只在纯电子集排名）。绝不跨级凑数——同级样本少就如实标注。
  function pickPeers(target, pool) {
    if (!target.level || !target.body) {
      return { peers: [target], scopeLabel: '', unrated: true };
    }
    const peers = pool.filter(d => d.level === target.level && d.body === target.body);
    const evN = peers.filter(d => d.energy === 'ev').length;
    const baseN = peers.filter(d => d.srcKind === 'base').length;
    const inN = peers.length - baseN;
    let scopeLabel;
    if (baseN > 0) {
      scopeLabel = `同级 ${target.level}${BODY_NAME[target.body]} 共${peers.length}款（在库${inN}＋行业基准${baseN}；纯电${evN}款/其他动力${peers.length - evN}款）`;
    } else {
      scopeLabel = `同级 ${target.level}${BODY_NAME[target.body]} ${peers.length}款（纯电${evN}款/其他动力${peers.length - evN}款）`;
    }
    return { peers, scopeLabel, unrated: false, evN, baseN, inN };
  }

  // 竞赛排名（1,2,2,4）：vals 为"越大越好"的可比分数数组，返回与 idx 对齐的 {rank,total,tied}
  function competitionRank(values) {
    const valid = values.map((v, i) => ({ v, i })).filter(x => x.v != null);
    const total = valid.length;
    const sorted = valid.slice().sort((a, b) => b.v - a.v);
    const ranks = new Array(values.length).fill(null);
    sorted.forEach((x, pos) => {
      let rank = pos + 1;
      if (pos > 0 && sorted[pos - 1].v === x.v) rank = ranks[sorted[pos - 1].i].rank;
      ranks[x.i] = { rank, total, tied: valid.filter(y => y.v === x.v).length > 1 };
    });
    return ranks;
  }

  // 单车指标能力分（绝对锚点，不依赖组内样本）；evOnly 指标非纯电车返回 null
  function metricScore(d, mk) {
    const meta = METRIC_META[mk];
    if (!meta) return null;
    if (meta.evOnly && d.energy !== 'ev') return null;
    const v = d.M[mk] && d.M[mk].v;
    if (v == null) return null;
    if (mk === 'lidar') {
      const k = Math.max(0, Math.min(4, v));
      return LIDAR_SCORE[k] != null ? LIDAR_SCORE[k] : null;
    }
    let cuts = null;
    if (STD_UNIV[mk]) cuts = STD_UNIV[mk];
    else if (STD_BODY[mk]) cuts = (STD_BODY[mk] || {})[d.body];
    else cuts = groupCuts(mk, d.level, d.body);
    return anchorScore(v, cuts);
  }

  // 组内单车：指标能力分 →（轴内权重）→ 轴能力分
  function evalMember(d) {
    const axes = {};
    for (const ax of AXES) {
      let sum = 0, wsum = 0;
      const parts = [];
      for (const mk of ax.metrics) {
        const s = metricScore(d, mk);
        if (s == null) continue;
        const w = AXIS_W[ax.key][mk] || 0;
        sum += s * w; wsum += w;
        parts.push({ metric: mk, score: s });
      }
      axes[ax.key] = { score: wsum ? Math.round(sum / wsum) : null, parts };
    }
    return { d, axes };
  }

  //（轴间预设权重）→ 综合能力分；cov=适用轴中的权重覆盖度（非纯电的能耗/补能为"不适用"，不计入分母，区别于"未披露"）
  function overallOf(m, presetKey) {
    const w = PRESETS[presetKey].w;
    let sum = 0, wsum = 0, wapp = 0;
    for (const ax of AXES) {
      const applicable = ax.metrics.some(mk => !METRIC_META[mk].evOnly || m.d.energy === 'ev');
      if (applicable) wapp += w[ax.key];
      const s = m.axes[ax.key].score;
      if (s == null) continue;
      sum += s * w[ax.key]; wsum += w[ax.key];
    }
    return { score: wsum ? Math.round(sum / wsum) : null,
             cov: wapp ? Math.round(wsum / wapp * 100) / 100 : 0 };
  }

  function evaluate(target, pool) {
    pool = pool || buildPool();
    const picked = pickPeers(target, pool);
    const peers = picked.peers;
    if (picked.unrated) {
      return { target, peers, scopeLabel: '', unrated: true, axes: {},
               poolN: pool.length, peerN: 0, chassis: null };
    }
    // 能力分不依赖样本数量：同级仅1款也能出绝对分，只是无座次/无均值
    const members = peers.map(evalMember);
    const selfIdx = members.findIndex(e => e.d.id === target.id);
    const axisRes = {}, peerAvg = {};
    for (const ax of AXES) {
      const rr = competitionRank(members.map(e => e.axes[ax.key].score))[selfIdx];
      const other = members.filter((e, i) => i !== selfIdx && e.axes[ax.key].score != null)
        .map(e => e.axes[ax.key].score);
      peerAvg[ax.key] = other.length ? Math.round(other.reduce((a, b) => a + b, 0) / other.length) : null;
      axisRes[ax.key] = {
        score: members[selfIdx].axes[ax.key].score,
        parts: members[selfIdx].axes[ax.key].parts,
        rank: rr ? rr.rank : null, total: rr ? rr.total : null, tied: rr ? rr.tied : false,
        avg: peerAvg[ax.key],
      };
    }
    // 三套预设的综合分与组内名次（同级比较，随预设联动）
    const overalls = {};
    for (const pk of Object.keys(PRESETS)) {
      const vals = members.map(m => overallOf(m, pk));
      const rr = competitionRank(vals.map(x => x.score))[selfIdx];
      const other = members.filter((e, i) => i !== selfIdx)
        .map(e => overallOf(e, pk).score).filter(x => x != null);
      const avg = other.length ? Math.round(other.reduce((a, b) => a + b, 0) / other.length) : null;
      overalls[pk] = {
        score: vals[selfIdx].score, cov: vals[selfIdx].cov, avg,
        rank: rr ? rr.rank : null, total: rr ? rr.total : null, tied: rr ? rr.tied : false,
      };
    }
    // 价格组内座次（价低者优 → 取负后走"越大越好"排名）；价格不进综合能力分
    const prr = competitionRank(peers.map(d => {
      const v = d.M.price && d.M.price.v;
      return v == null ? null : -v;
    }))[selfIdx];
    const poolBaseN = pool.filter(d => d.srcKind === 'base').length;
    return { target, peers, members, scopeLabel: picked.scopeLabel, unrated: false,
             levelSource: target.levelSource, axes: axisRes, peerAvg, overalls,
             poolN: pool.length, poolInN: pool.length - poolBaseN, poolBaseN,
             peerN: peers.length, peerInN: picked.inN, peerBaseN: picked.baseN, evN: picked.evN,
             calibrated: cardCalibrated(target.level, target.body), thin: peers.length < 4,
             price: { rank: prr ? prr.rank : null, total: prr ? prr.total : null, tied: prr ? prr.tied : false },
             chassis: chassisStats(target, peers) };
  }

  // 高阶底盘配置同级配备率（只统计、不计分，供结论区事实展示）
  const CHASSIS_RE = /空气悬架|空悬|CDC|CCD|FSD|魔毯|电磁|软硬调节|液压衬套|后轮转向|双叉臂|云辇|魔撼/;
  function chassisOf(d) {
    const s = d.raw.specs || {};
    const txt = [s['可变悬架功能'], s['前悬架类型'], s['后悬架类型']].filter(Boolean).join(' ');
    const adv = /空气|空悬|CDC|CCD|FSD|魔毯|电磁|软硬/.test(txt) && !/^无$/.test(String(s['可变悬架功能'] || '').trim());
    return {
      adv,
      awd: s['四驱形式'] && !/^无$/.test(String(s['四驱形式']).trim()) ? String(s['四驱形式']) : '',
      susp: [s['前悬架类型'], s['后悬架类型']].filter(x => x && x !== '无').join('/'),
      variable: s['可变悬架功能'] && String(s['可变悬架功能']).trim() !== '无' ? String(s['可变悬架功能']) : '',
      turn: (() => {
        const rv = s['最小转弯半径 m'], dv = s['最小转弯直径 m'];
        if (!rv && !dv) return '';
        const v = rv || dv;
        return (rv ? '转弯半径 ' : '转弯直径 ') + v + (/m\s*$/i.test(String(v)) ? '' : 'm');
      })(),
      text: txt,
    };
  }
  function chassisStats(target, peers) {
    const me = chassisOf(target);
    if (!me.susp && !me.variable && !me.awd) return null;
    const advN = peers.map(chassisOf).filter(c => c.adv).length;
    return { me, advN, total: peers.length,
             advRate: peers.length ? Math.round(advN / peers.length * 100) : 0 };
  }

  /* ================= 四、规则化结论（领导视角：能力分 + 同级座次 + 官方卖点印证） ================= */
  // 与同级均值的客观差值定性（不使用字母档位）
  function wordOfDiff(diff) {
    if (diff == null) return '';
    if (diff >= 12) return '能力显著领先同级';
    if (diff >= 5) return '高于同级均值';
    if (diff > -5) return '处于同级中游';
    if (diff > -12) return '低于同级均值';
    return '显著落后同级';
  }
  function diffCls(diff) {
    if (diff == null) return 'g-none';
    if (diff >= 5) return 'g-top';
    if (diff > -5) return 'g-mid';
    return 'g-low';
  }
  function factOf(target, mk) {
    const cur = target.M[mk];
    return cur && cur.v != null ? `${METRIC_META[mk].name} ${displayOf(target, mk).text}` : null;
  }

  // 官方卖点收集：新车 raw.usp；竞品库 raw.uspGroups（只引用已审核展示语，零编造）
  function collectUsps(raw) {
    if (Array.isArray(raw.usp)) return raw.usp.slice();
    if (Array.isArray(raw.uspGroups)) {
      return raw.uspGroups.flatMap(g => (g.items || []).map(it => it.t + (it.d ? '：' + it.d : '')));
    }
    return [];
  }
  const USP_KEY = {
    power: /零百|加速|\d+(\.\d+)?s|双电机|四驱|kW|马力|峰值功率|电驱|BOOST/,
    energy: /续航|电耗|CLTC|油耗|公里|风阻|能耗|电池/,
    charge: /充电|补能|超充|800V|5C|6C|快充|高压平台/,
    smart: /智驾|领航|NOA|激光雷达|TOPS|芯片|端到端|辅助驾驶|自动驾驶|感知/,
    safe: /气囊|安全|刚性|热成型|防护|防弹|碰撞|笼式|高刚性/,
    space: /轴距|空间|座椅|后备箱|前备箱|储物|车长|三排|大五座|大六座|沙发/,
  };
  const CHASSIS_USP_RE = /悬架|底盘|魔毯|空悬|空气悬架|CDC|CCD|FSD|后轮转向|麋鹿|双叉臂|五连杆|衬套|调校|转弯半径/;

  function buildVerdict(r, presetKey) {
    if (r.unrated) return { unrated: true, segName: r.target.seg || '该车型' };
    presetKey = PRESETS[presetKey] ? presetKey : 'equal';
    const t = r.target;
    const usps = collectUsps(t.raw);
    const uspFor = key => usps.find(u => USP_KEY[key].test(u)) || null;
    const segTitle = t.level + (BODY_NAME[t.body] || '车');

    // 价格句（价格不进综合能力分，只给同级座次）
    let priceTxt = '售价未披露';
    let priceCheap = false;
    if (t.M.price.raw) {
      const p = r.price;
      if (p.rank) {
        const ratio = p.rank / p.total;
        const band = ratio <= 0.34 ? '同级亲民价位' : ratio <= 0.67 ? '同级中位价位' : '同级高端价位';
        priceCheap = ratio <= 0.34;
        priceTxt = `售价${t.M.price.raw}（同级价格第${p.rank}/${p.total}低 · ${band}）`;
      } else priceTxt = `售价${t.M.price.raw}`;
    }
    const line1 = `${segTitle}·${ENERGY_NAME[t.energy] || ''}，${priceTxt}。`;

    // 轴卡：能力分 + 同级座次 + 同级均值 + 官方原值 + 官方卖点
    const sorted = AXES.map(a => ({ a, res: r.axes[a.key] }))
      .filter(x => x.res.score != null)
      .sort((x, y) => y.res.score - x.res.score);
    const cardOf = ({ a, res }) => {
      const facts = a.metrics.map(mk => factOf(t, mk)).filter(Boolean);
      // 快充时间口径不统一，补能轴只作陈列（不随 chargeKw 计分）
      if (a.key === 'charge' && t.M.chargeMin && t.M.chargeMin.v != null) {
        facts.push(`快充时间 ${displayOf(t, 'chargeMin').text}（SOC窗口各异，仅陈列）`);
      }
      return {
        key: a.key, name: a.name, rank: res.rank, total: res.total, tied: res.tied,
        score: res.score, avg: res.avg, sole: res.total === 1,
        facts: facts.slice(0, 3), usp: uspFor(a.key),
      };
    };
    // 亮点/短板按绝对能力分判定（小样本组成立，不依赖名次比例）
    const highlights = sorted.filter(x => x.res.score >= 80).slice(0, 3).map(cardOf);
    const weak = sorted.filter(x => x.res.score <= 50).slice(-2).reverse().map(cardOf);

    // 无分轴：仅"未披露"或"非纯电不可比"两类（能力分锚点不依赖对手，不再有"唯一披露无名次"）
    const missing = [], incomparable = [];
    for (const a of AXES) {
      if (r.axes[a.key] && r.axes[a.key].score != null) continue;
      const hasData = a.metrics.some(mk => t.M[mk].v != null);
      const allEvOnly = a.metrics.every(mk => METRIC_META[mk].evOnly);
      if (hasData && allEvOnly && t.energy !== 'ev') incomparable.push(a.name);
      else missing.push(a.name);
    }

    // 综合能力分（随权重预设联动）
    const ov = r.overalls[presetKey];
    const noOverall = ov.score == null || ov.cov < 0.6;
    const weakCov = !noOverall && ov.cov < 0.8;
    const diff = ov.score != null && ov.avg != null ? ov.score - ov.avg : null;
    const word = wordOfDiff(diff);

    // 核心结论（领导一句话；全具体分数，无字母档）
    let line2;
    if (noOverall) {
      line2 = `已披露参数的权重覆盖度不足六成，暂不出综合能力分，请按下列单项能力分判读。`;
    } else {
      line2 = `综合能力${ov.score}分`;
      if (ov.rank != null) line2 += `（同级${ov.tied ? '并列第' : '第'}${ov.rank}/${ov.total}，同级均值${ov.avg == null ? '—' : ov.avg + '分'}）`;
      if (word) line2 += `，${word}`;
      if (weakCov) line2 += '（参数覆盖不足八成，综合分仅供参考）';
      line2 += '。';
    }
    const hiNames = highlights.map(x => x.name);
    const wkNames = weak.map(x => x.name);
    if (hiNames.length) line2 += `能力强项：${hiNames.join('、')}（均≥80分）`;
    if (priceCheap) line2 += `${hiNames.length ? '；' : ''}价格同级亲民`;
    if (wkNames.length) line2 += `${hiNames.length || priceCheap ? '；' : ''}能力短板：${wkNames.join('、')}（均≤50分）`;
    line2 += '。';

    // 底盘/四驱（雷达外，只陈列事实+同级配备率，不打分）
    let chassis = null;
    const ch = r.chassis;
    if (ch) {
      const rows = [];
      if (ch.me.variable) rows.push(ch.me.variable);
      if (ch.me.susp) rows.push(ch.me.susp);
      if (ch.me.awd) rows.push('四驱：' + ch.me.awd);
      if (ch.me.turn) rows.push(ch.me.turn);
      const usp = usps.find(u => CHASSIS_USP_RE.test(u)) || null;
      chassis = { rows, usp, advN: ch.advN, total: ch.total };
    }

    return { unrated: false, preset: presetKey, segTitle, line1, line2,
      ov, diff, word, cls: diffCls(diff),
      highlights, weak, missing, incomparable, chassis,
      levelSource: r.levelSource, thin: r.thin, noOverall, weakCov };
  }

  // 跨级对比时各轴的"代表参数"（用原值决胜，不用各自同级的轴分）
  const AXIS_PROXY = { power: 'accel', energy: 'rangeKm', charge: 'chargeKw', smart: 'tops', safe: 'airbag', space: 'wheelbase' };
  // 多车对比结论（presetKey 决定同级总排名口径；跨级不总排名）
  function buildCompareVerdict(evals, presetKey) {
    presetKey = PRESETS[presetKey] ? presetKey : 'equal';
    const rated = evals.filter(e => !e.unrated);
    const sameLevel = rated.length === evals.length && evals.length >= 2 &&
      evals.every(e => e.target.level === evals[0].target.level && e.target.body === evals[0].target.body);
    // 仅严格同级（同级别+同车身=同一张标准卡）才按能力分总排名；跨级不排总名次
    // 覆盖度<60%的车不计算综合分，不进总排名（与单车面板闸门一致）
    const scorable = rated.filter(e => { const o = e.overalls[presetKey]; return o.score != null && o.cov >= 0.6; });
    const rank = sameLevel
      ? scorable.slice().sort((a, b) => b.overalls[presetKey].score - a.overalls[presetKey].score) : [];
    const rankSkipped = sameLevel ? rated.filter(e => !scorable.includes(e)) : [];
    const crossLevel = !sameLevel;
    // 占优轴：同级→轴分决胜；跨级→代表参数原值决胜
    const wins = {};
    for (const a of AXES) {
      let vals;
      if (sameLevel) {
        vals = evals.map(e => ({ id: e.target.id, s: e.axes[a.key].score }))
          .filter(x => x.s != null).sort((x, y) => y.s - x.s);
      } else {
        const mk = AXIS_PROXY[a.key];
        vals = evals.map(e => ({ id: e.target.id, s: e.target.M[mk].v }))
          .filter(x => x.s != null)
          .sort((x, y) => METRIC_META[mk].dir * (y.s - x.s));
      }
      if (vals.length >= 2 && vals[0].s != null && vals[0].s > vals[1].s) {
        (wins[vals[0].id] = wins[vals[0].id] || []).push(a.name);
      }
    }
    const advice = [];
    const pushAdvice = (label, mk, want) => {
      const cand = evals.filter(e => e.target.M[mk].v != null);
      if (!cand.length) return;
      cand.sort((a, b) => want * (a.target.M[mk].v - b.target.M[mk].v));
      const c = cand[0].target;
      advice.push(`${label}看 **${c.name}**（${METRIC_META[mk].name} ${displayOf(c, mk).text}）`);
    };
    pushAdvice('追求加速性能', 'accel', -1);
    pushAdvice('追求长续航', 'rangeKm', 1);
    pushAdvice('看重补能效率', 'chargeKw', 1);
    pushAdvice('看重智能化', 'tops', 1);
    pushAdvice('预算敏感', 'price', -1);
    return { rank, rankSkipped, crossLevel, wins, sameLevel, preset: presetKey, advice: advice.slice(0, 5) };
  }

  /* ================= 四点五、LACU 性能边界试点（6维·原始值同级排名，20261013/14） =================
     与能力分的区别：本模块不用锚点评分，每维只取一个"网上可观测"主指标的官方全系最优原始值，
     在严格同级组（级别×车身）内做经验分位与竞赛名次。名次即LACU，分位即雷达半径，定目标时回溯原始值。
     v8.9.1（20261014h）：通过性（离地间隙，覆盖7/26且城市SUV区分度弱）下架。
     v8.9.2（20261014i，用户裁定）：能源同组比较——纯电车与纯电车比CLTC纯电续航/快充，
     增程插混车与增程插混车比CLTC纯电续航（电板续航）/快充/CLTC综合续航；燃油车续航三轴不参评。
     雷达轴集（v8.9.9起）：动力/纯电续航/综合续航/补能/空间/成本六轴＋"操稳稳定"复合轴；纯电6轴（综合续航留缺口、操稳参评），增程插混7轴，燃油3轴（动力/空间/成本，操稳暂不参评）。
     L/A/C/U按经验分位划档（v8.8）：L=P≥90（前10%）、A=P≥70（前30%）、C=P30–70（平均水平）、
     U=P<30（后30%）；小样本护栏：n=4-6仅评L/C/U（落入A段就低记C，n=4时P90不可达不产生L），n<4不出档。
     v8.9.9（20261015z，用户裁定）：操稳稳定=最小转弯半径50%（组内百分位，越小越优）+前悬结构档20%+后悬结构档20%+可调悬架折分10%，
     缺项按有值项权重重归一；结构档不含调校水平（图面/表注均标注）；空悬/魔毯/电磁/后轮转向等配置平铺不计分；制动不做。 */
  // part: 'all'=全能源混排；'eg'=按本车能源同组（ev↔ev / x↔x）；'x'=仅增程插混组
  const LACU_AXES = [
    { key: 'power',      name: '动力性能', metric: 'accel',        dir: -1, part: 'all',
      fmt: v => (Math.round(v * 100) / 100) + 's',  tip: '主指标：零百加速（官方全系最优，越小越优）' },
    { key: 'energy',     name: '纯电续航', metric: 'rangeKm',      dir: 1, part: 'eg',
      fmt: v => Math.round(v) + 'km', tip: '主指标：CLTC纯电续航。v8.9.2起按能源同组比较：纯电车与纯电车比，增程/插混车在增程插混组内比电板纯电续航，两组不混排；燃油车不参评' },
    { key: 'totalRange', name: '综合续航', metric: 'totalRangeKm', dir: 1, part: 'x',
      fmt: v => Math.round(v) + 'km', tip: '主指标：CLTC综合续航（满油满电），仅增程/插混车在同能源组内参评；纯电车综合续航即纯电续航，不重复评' },
    { key: 'charge',     name: '补能效率', metric: 'chargeEqMin', dir: -1, part: 'eg',
      fmt: v => (Math.round(v * 10) / 10) + 'min', tip: '主指标：官方快充时间按SOC窗口线性归一的"等效20-80%分钟"（越短越优）；eqMin=官方分钟×60/(结束%-开始%)，窗口差异为线性近似；v8.9.2起按能源同组比较（增程插混车之间亦可比）；优先采用官方主打的最短SOC窗口（A级上市稿可覆盖AH配置表值）' },
    { key: 'space',      name: '空间尺寸', metric: 'wheelbase',   dir: 1, part: 'all',
      fmt: v => Math.round(v) + 'mm', tip: '主指标：轴距（车长/车宽见完整参数表）' },
    { key: 'handling',   name: '操稳稳定', metric: null, dir: 1, part: 'all', composite: 'handling',
      fmt: v => Math.round(v * 100) + '分',
      tip: 'v8.9.9复合轴（四因子综合位置分）：最小转弯半径50%（越小越优）＋前悬结构档20%＋后悬结构档20%＋可调悬架折分10%（无/软硬/软硬+高低=0/1/2）；缺项按有值项重归一，组内排名映射L/A/C/U。结构档仅代表悬挂形式（双叉臂/多连杆=3、麦弗逊/连杆支柱=2、扭力梁=1，整体桥按硬派越野用途条件判定），不含调校水平；制动不参评' },
    { key: 'cost',       name: '购置成本', metric: 'price',       dir: -1, part: 'all',
      fmt: v => (Math.round(v * 100) / 100) + '万', tip: '主指标：官方入门指导价（价低者优，全系最低价口径）；试点组（中大型SUV）基准车已补官方价，其余组别无价车不参评' },
  ];
  const BAND_NAME_LACU = { L: '大幅领先', A: '领先', C: '平均水平', U: '落后平均' };
  const AX_SHORT_LACU = { power: '动力', energy: '纯电续航', totalRange: '综合续航', charge: '补能', space: '空间', handling: '操稳', cost: '成本' };

  // v8.9.9 操稳四因子（用户2026-10-15裁定）：
  // 结构分级只代表悬挂形式、不含调校；整体桥用途条件规则——硬派越野（官方列低速四驱）记3档，城市车记1档。
  const SUSP_TIER_RULES = {
    front: [[/双叉臂|双横臂|多连杆/, 3], [/麦弗逊|连杆支柱/, 2]],
    rear:  [[/多连杆|双叉臂/, 3], [/双横臂|连杆支柱|拖臂/, 2], [/纵臂扭转梁|扭力梁|扭转梁|拖曳臂/, 1]],
  };
  function suspTier(pos, raw, offroad) {
    if (raw == null || raw === '') return null;
    const s = String(raw);
    if (/整体桥|整体式|非独立.*桥/.test(s)) return offroad ? 3 : 1;
    for (const [re, sc] of SUSP_TIER_RULES[pos]) { if (re.test(s)) return sc; }
    return null;
  }
  function suspAdjScore(raw) {
    if (raw == null || raw === '') return 0; // 该数据源仅装备可调悬架时才列行，缺失=无=0
    const s = String(raw);
    if (/软硬.*高低|高低.*软硬/.test(s)) return 2;
    if (/软硬|高低/.test(s)) return 1;
    return 0;
  }
  function mval(d, k) { const m = d.M[k]; return (m && m.v != null) ? m.v : null; }
  function handlingFactors(d) {
    const turn = mval(d, 'turn');
    const off = mval(d, 'offroad') === 1;
    return {
      turn: (turn != null && +turn > 0) ? +turn : null,
      sf: suspTier('front', mval(d, 'suspF'), off),
      sr: suspTier('rear', mval(d, 'suspR'), off),
      adj: suspAdjScore(mval(d, 'suspAdj')),
      drive: mval(d, 'drive'),
      off,
    };
  }
  function handlingDesc(f) {
    return `转弯${f.turn != null ? f.turn + 'm' : '—'} · 前悬${f.sf != null ? f.sf + '档' : '—'} · 后悬${f.sr != null ? f.sr + '档' : '—'} · 可调${f.adj} · ${f.drive || '驱动—'}`;
  }
  // 本车在该轴是否不参评（能源口径）
  const lacuSelfNA = (ax, tEnergy) =>
    ax.part === 'x' ? tEnergy !== 'x'
    : ax.part === 'eg' ? (tEnergy !== 'ev' && tEnergy !== 'x')
    : false;
  // 竞品是否进入该轴样本（能源同组原则：不跨能源混排续航/补能）
  const lacuAxisFilter = (ax, d, tEnergy) => {
    if (ax.part === 'eg') {
      if (tEnergy !== 'ev' && tEnergy !== 'x') return false;
      if (d.energy !== tEnergy) return false;
    } else if (ax.part === 'x') {
      if (tEnergy !== 'x' || d.energy !== 'x') return false;
    }
    const m = d.M[ax.metric];
    return !!(m && m.v != null);
  };
  // v8.9.4：雷达轴集按本车能源形态动态生成——不存在的维度直接不画（不留缺口、形状始终闭合）
  // 纯电车6轴（无综合续航）；增程/插混7轴（含电板纯电续航+满油满电综合续航）；燃油车3轴（动力/空间/成本，无操稳数据源）
  // v8.9.9：ev/x 增加操稳复合轴；ice 无配置表操稳字段不挂该轴
  const lacuAxesFor = en => en === 'x'
    ? LACU_AXES
    : en === 'ev'
      ? LACU_AXES.filter(a => a.key !== 'totalRange')
      : LACU_AXES.filter(a => a.part === 'all' && a.key !== 'handling');
  const LACU_ENERGY_LABEL = { ev: '纯电车·6维（无综合续航轴，含操稳）', x: '增程/插混·7维（纯电续航+综合续航+操稳）', ice: '燃油车·3维（无操稳数据源）' };

  // v8.9.5 版型口径：data.js 车型记录可带 trims[]（入门版在前）；LACU默认按入门版同口径取本车值，
  // 可切具体版型或"全系最优"（旧聚合口径）。竞品圈暂为全系聚合，表头显式标注，二期影子库款型化。
  const TRIM_METRICS = {
    price: { metric: 'price', raw: v => v + '万' },
    accel: { metric: 'accel', raw: v => v + 's' },
    rangeKm: { metric: 'rangeKm', raw: v => v + 'km（CLTC）' },
    totalRangeKm: { metric: 'totalRangeKm', raw: v => v + 'km（满油满电）' },
    chargeEqMin: { metric: 'chargeEqMin', raw: v => v + 'min（等效20-80%）' },
    wheelbase: { metric: 'wheelbase', raw: v => v + 'mm' },
    // v8.9.9 操稳版型口径
    turn: { metric: 'turn', raw: v => v + 'm' },
    suspF: { metric: 'suspF', raw: v => v },
    suspR: { metric: 'suspR', raw: v => v },
    suspAdj: { metric: 'suspAdj', raw: v => v },
    drive: { metric: 'drive', raw: v => v },
    chips: { metric: 'chips', raw: v => v },
  };
  const TRIM_BEST = 'best';
  const carTrims = d => (d && d.raw && Array.isArray(d.raw.trims) && d.raw.trims.length) ? d.raw.trims : null;
  // 按版型键生成本车有效对象（浅克隆+M覆盖）；'best'/无trims时原样返回
  function trimEffective(t, trims, key) {
    if (!trims || key === TRIM_BEST) return t;
    const i = parseInt(key, 10);
    const tr = trims[i];
    if (!tr) return t;
    const tEff = Object.assign({}, t, { M: Object.assign({}, t.M), _trim: tr, _trimIdx: i });
    Object.keys(TRIM_METRICS).forEach(k => {
      if (tr[k] != null) {
        const mm = TRIM_METRICS[k];
        const rv = mm.raw(tr[k]);
        tEff.M[mm.metric] = { v: tr[k], raw: Array.isArray(rv) ? null : rv };
      }
    });
    return tEff;
  }

  function lacuMedian(a) {
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    if (!n) return null;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function peerLabel(d) { return d.srcKind === 'base' ? '行业基准车' : d.name; }

  function lacuEval(target, pool) {
    const picked = pickPeers(target, pool);
    if (picked.unrated) return null;
    // v8.9.5：本车版型选择器——target 可能是版型口径克隆（同id、M按版型覆盖），
    // 池内同id对象一律替换为该克隆，保证本车取值、价格带、排名全部按所选版型联动。
    const swapSelf = d => d.id === target.id ? target : d;
    // 直接竞品圈（v8.7 用户裁定：价格优先）：同级别×同车身 且 官方入门指导价落入
    // [本车价-B, 本车价+B]，B=max(5万元, 本车价×15%)。无价车不进圈（ES7等官网无在售价者挂起）。
    // 本车无售价（未上市）时回退全品类组并显式标注；各轴再按 evOnly/inLib 过滤。
    const tPrice = target.M.price && target.M.price.v != null ? target.M.price.v : null;
    let rivalPool, priceMode, lo = null, hi = null, bandW = null, adjLevels = null;
    const tEn = target.energy;
    const axisList = lacuAxesFor(tEn);
    // v8.9.5：竞品序列先换本车版型克隆，再做价格带过滤——否则版型价高于整车入门价时
    // 原车会被自己的价格带挡在圈外（如战舰700顶峰版24.98 vs 整车限时价16.98），全轴误判"本车未披露"
    const peersEff = picked.peers.map(swapSelf);
    // v8.9.6：竞品[入门,顶配]指导价区间与本车价格带[lo,hi]相交即入圈（准则§9.9第1条）
    const inBand = d => {
      const pLo = d.M.price && d.M.price.v;
      if (pLo == null) return false;
      const pHi = (d.M.priceHi && d.M.priceHi.v != null && d.M.priceHi.v >= pLo) ? d.M.priceHi.v : pLo;
      return pLo <= hi && pHi >= lo;
    };
    if (tPrice == null) {
      rivalPool = peersEff.slice();
      priceMode = 'fallback';
    } else {
      bandW = Math.max(5, tPrice * 0.15);
      lo = +(tPrice - bandW).toFixed(2); hi = +(tPrice + bandW).toFixed(2);
      rivalPool = peersEff.filter(inBand);
      // v8.9.7 邻级扩圈（用户2026-10-15裁定"700款库里怎会没有同级车"）：严格同级别价格带内
      // 有价竞品不足4款（小样本无档）时，并入尺寸相邻级别（LEVEL_RANK±1）同车身、同价格带车型，
      // 如大型纯电MPV理想MEGA并入中大型MPV极氪009/腾势D9 EV等官方定级相邻的真实竞品；显式标注。
      if (rivalPool.length < 4) {
        const oi = LEVEL_RANK[target.level];
        if (oi != null) {
          const adj = Object.keys(LEVEL_RANK).filter(lv => Math.abs(LEVEL_RANK[lv] - oi) === 1);
          const have = new Set(rivalPool.map(d => d.id));
          const extra = pool.map(swapSelf).filter(d =>
            d.body === target.body && adj.indexOf(d.level) >= 0 && !have.has(d.id) && inBand(d));
          if (extra.length) { rivalPool = rivalPool.concat(extra); adjLevels = adj; priceMode = 'bandAdj'; }
          else priceMode = 'band';
        } else priceMode = 'band';
      } else {
        priceMode = 'band';
      }
      if (!rivalPool.length) { priceMode = 'fallback'; rivalPool = peersEff.slice(); } // 极端兜底全组
    }
    // 轴成员构造（圈内）；v8.9.2续航/补能按本车能源同组（纯电组/增程插混组），综合续航仅增程插混组
    // v8.9.4：轴集按本车能源形态动态裁剪，纯电车不含综合续航轴（雷达天然闭合，不留缺口）
    const axes = axisList.map(ax => {
      const res = { ax, n: 0, members: [], medVal: null,
                    p90Val: null, p70Val: null, p30Val: null,
                    topVal: null, topLabel: '', catTopVal: null, catTopLabel: '', self: null };
      // v8.9.9 handling复合轴：转弯半径组内百分位50%＋前悬档20%＋后悬档20%＋可调折分10%，
      // 单车缺因子时按有值项权重重归一（可调无行=0分参与）；其余轴沿用单指标fav排名
      let members, catMembers;
      if (ax.composite === 'handling') {
        const buildHandling = list => {
          const raw0 = list.map(swapSelf).map(d => {
            const f = handlingFactors(d);
            if (f.turn == null && f.sf == null && f.sr == null) return null;
            return { d, f };
          }).filter(Boolean);
          const tv = raw0.filter(x => x.f.turn != null).map(x => x.f.turn).sort((a, b) => a - b);
          raw0.forEach(x => {
            if (x.f.turn != null) {
              // 转弯半径越小越优：大于本值的个数+0.5并列
              const worse = tv.filter(t => t > x.f.turn).length;
              const equal = tv.filter(t => t === x.f.turn).length;
              x.tPr = tv.length === 1 ? 0.5 : (worse + 0.5 * equal) / tv.length;
            }
            const fac = [];
            if (x.tPr != null) fac.push([x.tPr, 0.5]);
            if (x.f.sf != null) fac.push([x.f.sf / 3, 0.2]);
            if (x.f.sr != null) fac.push([x.f.sr / 3, 0.2]);
            fac.push([x.f.adj / 2, 0.1]);
            const ws = fac.reduce((s, z) => s + z[1], 0);
            const sc = +(fac.reduce((s, z) => s + z[0] * z[1], 0) / ws).toFixed(4);
            x.v = sc; x.fav = sc; x.rank = null; x.pr = null;
          });
          return raw0;
        };
        members = buildHandling(rivalPool);
        catMembers = buildHandling(peersEff);
      } else {
        members = rivalPool.map(swapSelf).filter(d => lacuAxisFilter(ax, d, tEn))
          .map(d => ({ d, v: d.M[ax.metric].v, fav: ax.dir * d.M[ax.metric].v, rank: null, pr: null }));
        catMembers = peersEff.filter(d => lacuAxisFilter(ax, d, tEn))
          .map(d => ({ d, v: d.M[ax.metric].v, fav: ax.dir * d.M[ax.metric].v }));
      }
      res.n = members.length;
      if (catMembers.length) {
        const catTop = catMembers.slice().sort((a, b) => b.fav - a.fav)[0];
        res.catTopVal = catTop.v; res.catTopLabel = peerLabel(catTop.d);
      }
      if (!members.length) return res;
      const sorted = members.slice().sort((a, b) => b.fav - a.fav);
      sorted.forEach((e, i) => { e.rank = (i > 0 && sorted[i - 1].fav === e.fav) ? sorted[i - 1].rank : i + 1; });
      members.forEach(e => {
        // 经验分位：同级中"劣于或等于本车"的样本占比（第1名≈100，垫底≈0），并列取中点
        const worse = members.filter(x => x.fav < e.fav).length;
        const equal = members.filter(x => x.fav === e.fav).length;
        e.pr = members.length === 1 ? 50 : 100 * (worse + 0.5 * equal) / members.length;
      });
      res.members = members;
      res.medVal = lacuMedian(members.map(e => e.v));
      // 档位边界原始值（v8.8）：按fav升序线性插值取P90/P70/P30，再折回物理量纲；P50用中位数
      const asc = members.slice().sort((a, b) => a.fav - b.fav);
      const qAt = p => {
        const qi = p * (asc.length - 1), qi0 = Math.floor(qi);
        const qFav = asc[qi0 + 1] ? asc[qi0].fav + (asc[qi0 + 1].fav - asc[qi0].fav) * (qi - qi0) : asc[qi0].fav;
        return +(qFav * ax.dir).toFixed(2);
      };
      res.p90Val = qAt(0.9);
      res.p70Val = qAt(0.7);
      res.p30Val = qAt(0.3);
      res.topVal = sorted[0].v; res.topLabel = peerLabel(sorted[0].d);
      const se = members.find(e => e.d.id === target.id);
      if (se) {
        const n = members.length;
        let band = 'NA';
        if (n >= 4) {
          // v8.8分位档：L=P≥90（前10%）/A=P≥70（前30%）/C=P30-70/U=P<30（后30%）
          if (se.pr >= 90) band = 'L';
          else if (n >= 7 && se.pr >= 70) band = 'A';      // 小样本护栏：n=4-6不评A，落入A段就低记C
          else if (se.pr < 30) band = 'U';
          else band = 'C';
        }
        res.self = { v: se.v, rank: se.rank, pr: Math.round(se.pr), band };
        if (ax.composite === 'handling') res.self.desc = handlingDesc(se.f);
      }
      return res;
    });
    // 竞品圈口径标签
    let rivalLabel;
    if (priceMode === 'band' || priceMode === 'bandAdj') {
      rivalLabel = `竞品圈 ${rivalPool.length} 款${priceMode === 'bandAdj' ? '（含邻级车型）' : ''} · 指导价 ${lo}–${hi} 万（±${bandW.toFixed(1)}万）`;
    } else if (tPrice == null) {
      rivalLabel = `售价未公布，暂按同级全组 ${picked.peers.length} 款排名，定价后自动切换`;
    } else {
      rivalLabel = `价格带内暂无同级车，暂按全组 ${picked.peers.length} 款参考`;
    }
    return { target, scopeLabel: picked.scopeLabel, rivalLabel, priceMode, adjLevels, axes, axisList,
             enLabel: LACU_ENERGY_LABEL[tEn] || '',
             egName: tEn === 'ev' ? '纯电组' : tEn === 'x' ? '增程插混组' : '',
             rivals: rivalPool.map(d => ({ id: d.id, name: d.name, srcKind: d.srcKind, level: d.level,
               url: d.srcKind === 'dcd' ? (d.raw && d.raw._specUrl) || ''
                 : d.srcKind === 'base'
                 ? `https://www.autohome.com.cn/config/series/${String(d.id).replace(/^b0?/, '').replace(/^0177$/, '177')}.html`
                 : (d.raw && d.raw.specsUrl) || (d.raw && d.raw.srcUrl) || '' })) };
  }

  /* LACU 雷达（v8.9.2六轴：动力/纯电续航/综合续航/补能/空间/成本，能源同组比较；
     v8.9.9新增"操稳稳定"复合轴（转弯半径50%+前悬20%+后悬20%+可调悬架10%，缺项重归一，结构档不含调校）→纯电6轴/增程7轴/燃油3轴）：
     半径=圈内经验位置；四道同心环直接标注L/A/C/U档位边界（0.9/0.7/0.5/0.3），本车红色粗线（无填充）越环即读档；
     v8.9.3：路径首尾强制闭合（修复成本→动力闭合边漏画）、顶点悬停联动右侧表行高亮；
     图上不标参数数值，边界值统一在右侧表中查；悬停顶点看原值/名次/操稳因子明细。 */
  const lacuHidden = {}; // 图例隐线状态（layer -> true），模块级跨重绘保留
  const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function lacuRadar(ev) {
    const W = 400, H = 372, cx = 200, cy = 186, R = 104;
    const AX = ev.axes.map(ar => ar.ax);   // v8.9.4：几何按动态轴集（纯电5/增程6/燃油3），形状始终闭合
    const N = AX.length;
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;
    const pt = (i, ratio) => [cx + R * ratio * Math.cos(ang(i)), cy + R * ratio * Math.sin(ang(i))];
    const f1 = x => x.toFixed(1);
    // 外框环 + L/A/C/U四档环（0.9/0.7/0.5/0.3，半径即档位边界经验位置；U环红色虚线）
    let rings = '';
    const ringPts = r => AX.map((_, i) => pt(i, r).map(f1).join(',')).join(' ');
    rings += `<polygon points="${ringPts(1)}" fill="none" stroke="#2a3c5e" stroke-width="1"/>`;
    const BAND_RINGS = [
      { r: 0.9, l: 'L', color: '#d8b45a', dash: false },
      { r: 0.7, l: 'A', color: '#7e8ea8', dash: false },
      { r: 0.5, l: 'C', color: '#7e8ea8', dash: false },
      { r: 0.3, l: 'U', color: 'rgba(226,87,79,.7)', dash: true },
    ];
    BAND_RINGS.forEach(b => {
      rings += `<polygon points="${ringPts(b.r)}" fill="none" stroke="${b.color}" stroke-width="1"${b.dash ? ' stroke-dasharray="4 4"' : ''}/>`;
    });
    // 档名标在右上轴间隙：7轴间隙中心-64°/6轴-60°统一取-60°，3轴取-30°（动力顶轴与右下轴的间隙中心）
    const gAng = N === 3 ? -Math.PI / 6 : -Math.PI / 3;
    BAND_RINGS.forEach(b => {
      const lx = cx + R * (b.r + 0.035) * Math.cos(gAng);
      const ly = cy + R * (b.r + 0.035) * Math.sin(gAng) + 3;
      rings += `<text x="${f1(lx)}" y="${f1(ly)}" fill="${b.dash ? '#e2574f' : b.color}" font-size="9" font-weight="700" text-anchor="middle" style="paint-order:stroke;stroke:#0b1220;stroke-width:3px">${b.l}</text>`;
    });
    // 轴：辐条/轴名+样本子注/空轴根点（动态轴集下无"能源不适用"轴，缺口仅因本车未披露）
    let spokes = '';
    AX.forEach((a, i) => {
      const ar = ev.axes[i];
      const na = !ar || !ar.n;
      const selfNa = lacuSelfNA(a, ev.target.energy);
      const grpTag = a.part === 'all' ? '' : (ev.target.energy === 'ev' ? '纯电组·' : '增程组·');
      const sub = selfNa
        ? (a.part === 'x' ? '纯电不适用' : '燃油不参评')
        : na ? '无数据'
        : grpTag + (ar.n < 4 ? `n=${ar.n}·无档` : ar.n < 7 ? `n=${ar.n}·LCU` : `n=${ar.n}`);
      const [x1, y1] = pt(i, 1);
      const [nx, ny] = pt(i, 1.4);
      // 子注按屏幕垂直方向换行列于轴名正下方（斜轴上若沿辐条外推，y间距仅为径向差·sin30°会擦碰）
      const anchor = Math.abs(nx - cx) < 12 ? 'middle' : (nx > cx ? 'start' : 'end');
      spokes += `<g data-spoke="${a.key}"${(na || selfNa) ? ' class="lacu-axis-na"' : ''}>`;
      spokes += `<line class="lacu-spoke" x1="${cx}" y1="${cy}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="#2a3c5e" stroke-width="1"/>`;
      if (na || selfNa) { const [dx, dy] = pt(i, 0.04); spokes += `<circle cx="${f1(dx)}" cy="${f1(dy)}" r="2.4" fill="#5a6b85"/>`; }
      const arrow = a.key === 'cost' ? ' <tspan fill="#8fa0bc" font-size="10">↓</tspan>' : '';
      spokes += `<text class="lacu-spoke-name" x="${f1(nx)}" y="${f1(ny + 4)}" fill="#93a4bd" font-size="12" text-anchor="${anchor}">${a.name}${arrow}</text>`;
      // 上半侧轴子注排轴名上方（向下会压回圈内L标），下半侧排下方
      const subY = ny < cy - 1 ? ny - 12 : ny + 18;
      spokes += `<text x="${f1(nx)}" y="${f1(subY)}" fill="#67789a" font-size="8.6" text-anchor="${anchor}">${sub}</text>`;
      spokes += `</g>`;
    });
    // 多边形线：pts=[{key,idx,ratio,tip}]，null=该轴断线（留缺口）；strong=本车红线（v8.9.3：红色粗线、无填充无色块）
    const SELF_RED = '#f04b4c';
    const drawLine = (pts, color, width, dashed, layerKey, strong) => {
      const N = pts.length;
      const coords = pts.map(p => !p ? null : pt(p.idx, Math.min(0.985, Math.max(0.05, p.ratio))));
      // 路径必须首尾闭合（含缺口时按环相邻关系分段：缺口两侧各自起笔，环绕缺口不连线）
      let path = '';
      const firstNull = pts.findIndex(p => !p);
      if (firstNull === -1) {
        coords.forEach((p, i) => { if (p) path += (i === 0 ? 'M' : 'L') + f1(p[0]) + ' ' + f1(p[1]) + ' '; });
        path += 'Z ';
      } else {
        for (let k = 1; k <= N; k++) {
          const i = (firstNull + k) % N;
          if (!pts[i]) continue;
          const prev = (i + N - 1) % N;
          const p = coords[i];
          path += (pts[prev] ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]) + ' ';
        }
      }
      let s = '';
      if (strong) {
        // 仅红色稍粗描边（round连接/线帽），不填充、不加光晕色块（用户2026-10-14裁定：内部涂色太花哨）
        s += `<path d="${path}" fill="none" stroke="${SELF_RED}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
      } else {
        s += `<path d="${path}" fill="${color}" fill-opacity="${dashed ? 0.05 : 0.10}" stroke="${color}" stroke-width="${width}" ${dashed ? 'stroke-dasharray="6 4"' : ''}/>`;
      }
      pts.forEach((p, j) => {
        if (!p) return;
        const [x, y] = coords[j];
        if (strong) {
          s += `<circle data-vtx="${p.key}" data-tip="${escAttr(p.tip)}" cx="${f1(x)}" cy="${f1(y)}" r="4" fill="${SELF_RED}" stroke="#ffffff" stroke-width="1.4"/>`;
        } else {
          s += `<circle data-vtx="${p.key}" data-tip="${escAttr(p.tip)}" cx="${f1(x)}" cy="${f1(y)}" r="${dashed ? 3 : 3.2}" fill="${color}"/>`;
        }
      });
      return `<g class="lacu-layer" data-layer="${layerKey}"${lacuHidden[layerKey] ? ' style="display:none"' : ''}>${s}</g>`;
    };
    // 本车（idx为动态轴序；本车未披露的轴为null→留缺口分段，能源不适用的轴不进入轴集）
    const carSvg = drawLine(ev.axes.map((ar, i) => {
      const a = ar.ax, s2 = ar.self;
      const detail = (a.composite === 'handling' && s2.desc) ? '\n' + s2.desc : '';
      return s2 ? { key: a.key, idx: i, ratio: s2.pr / 100,
        tip: `本车：${ev.target.name}\n${a.name} ${a.fmt(s2.v)}${detail}\n第${s2.rank}/${ar.n}名${s2.band !== 'NA' ? ' · 判定' + s2.band : ' · n<4不出档'}` } : null;
    }), SELF_RED, 3, false, 'self', true);
    return `<svg viewBox="0 0 ${W} ${H}" class="radar-svg">${rings}${spokes}${carSvg}</svg>`;
  }

  function lacuLegendHTML(ev) {
    return `<span class="radar-leg" data-layer-toggle="self"><i style="background:#f04b4c"></i>本车</span>` +
      `<span class="radar-leg"><em style="background:transparent;color:#8fa0bc;font-style:normal">同心环＝L/A/C/U档位边界（越靠外越强）</em></span>`;
  }

  // v8.9.9 操稳列格式化
  const suspShort = raw => raw == null ? '' : String(raw).replace(/式(独立|非独立)悬架/g, '').replace(/纵臂扭转梁/, '扭力梁');
  const chipTags = d => {
    const cv = d.M.chips && d.M.chips.v;
    return Array.isArray(cv) ? cv : [];
  };
  // v8.9.7 竞品逐车对比表（用户2026-10-15裁定：面板必须直接呈现各车型对比，不能只有WPS链接）
  function lacuRivalTable(ev) {
    const pool = buildPool();
    const gv = (d, k) => (d.M[k] && d.M[k].v != null) ? d.M[k].v : null;
    const num = v => (v == null ? '—' : String(Math.round(v * 100) / 100));
    const km = v => (v == null ? '—' : String(v));
    const seatOf = id => ev.axes.map(ar => {
      const me = ar.members.find(x => x.d.id === id);
      return me ? (AX_SHORT_LACU[ar.ax.key] || ar.ax.name) + me.rank + '/' + ar.n : null;
    }).filter(Boolean).join('、');
    const items = ev.rivals.map(r => {
      const d = pool.find(x => x.id === r.id) || ev.target;
      const useD = r.id === ev.target.id ? ev.target : d;
      const isSelf = r.id === ev.target.id;
      const pLo = gv(useD, 'price'), pHi = gv(useD, 'priceHi');
      const priceTxt = pLo == null ? '—' : (pHi != null && pHi > pLo ? pLo + '–' + pHi : String(pLo));
      const adjTag = (ev.adjLevels && ev.adjLevels.indexOf(r.level) >= 0)
        ? '<span class="lacu-adj-tag" title="官方尺寸定级与本车相邻，因同级有价竞品不足4款按邻级扩圈入圈">邻</span>' : '';
      const srcTag = r.srcKind === 'dcd' ? '懂车帝' : r.srcKind === 'base' ? '汽车之家' : '在库官方源';
      const nm = r.url
        ? '<a href="' + escAttr(r.url) + '" target="_blank" rel="noopener">' + esc(r.name) + '</a>'
        : esc(r.name);
      const hf = handlingFactors(useD);
      const suspTxt = (hf.sf != null || hf.sr != null)
        ? `${hf.sf != null ? suspShort(gv(useD, 'suspF')) + hf.sf : '—'} / ${hf.sr != null ? suspShort(gv(useD, 'suspR')) + hf.sr : '—'}`
        : '—';
      const turnTxt = hf.turn != null ? hf.turn + 'm' : '—';
      const adjTxt = gv(useD, 'suspAdj') ? gv(useD, 'suspAdj') : '—';
      const driveTxt = gv(useD, 'drive') ? gv(useD, 'drive') : '—';
      const html = `<tr class="${isSelf ? 'lacu-self-row' : ''}">
<td class="lacu-riv-name">${nm}${adjTag}<div class="lacu-riv-src">${srcTag}</div></td>
<td>${priceTxt}</td><td>${num(gv(useD, 'accel'))}</td><td>${km(gv(useD, 'rangeKm'))}</td>
<td>${km(gv(useD, 'totalRangeKm'))}</td><td>${num(gv(useD, 'chargeEqMin'))}</td><td>${km(gv(useD, 'wheelbase'))}</td>
<td>${turnTxt}</td><td class="lacu-susp" title="前悬/后悬（结构档：3=双叉臂/多连杆，2=麦弗逊等，1=扭力梁；整体桥按用途判定；不含调校）">${suspTxt}</td>
<td>${adjTxt}</td><td class="lacu-drive">${driveTxt}</td>
<td class="lacu-seats">${seatOf(r.id) || '—'}</td></tr>`;
      return { html, isSelf, p: pLo == null ? 9999 : pLo, chips: chipTags(useD), name: r.name };
    });
    const order = items.slice().sort((a, b) => (b.isSelf - a.isSelf) || (a.p - b.p));
    // v8.9.9 操稳高阶底盘配置清单（平铺不打分；选装以斜体em标记）
    const chipRows = order.filter(x => x.chips.length).map(x =>
      `<div class="lacu-chip-line${x.isSelf ? ' self' : ''}"><span class="lacu-chip-car">${esc(x.name)}</span>` +
      x.chips.map(c => `<span class="lacu-chip${c.std ? '' : ' opt'}">${esc(c.t)}${c.std ? '' : '<em>（选装）</em>'}</span>`).join('') +
      `</div>`).join('');
    const chipBox = chipRows
      ? `<details class="lacu-chip-box" open><summary>操稳高阶底盘配置清单（平铺·不计分）</summary>${chipRows}</details>`
      : '';
    return `<div class="lacu-rival-wrap">
<table class="lacu-rival-table lacu-rival-table-h">
<thead><tr><th>车型</th><th>指导价(万)</th><th>零百(s)</th><th>CLTC纯电(km)</th><th>CLTC综合(km)</th><th>快充eq(min)</th><th>轴距(mm)</th><th>转弯半径</th><th>前/后悬(档)</th><th>可调悬架</th><th>驱动方式</th><th>各轴座次</th></tr></thead>
<tbody>${order.map(x => x.html).join('')}</tbody>
</table>
${chipBox}
<div class="lacu-src-note">金色＝本车，"邻"＝邻级车型，"—"＝未参评或未披露，座次＝名次/样本数，点车名看来源；操稳为四因子综合分（转弯半径50%/前悬20%/后悬20%/可调10%，结构档不含调校）；完整界限见WPS表格。</div>
</div>`;
  }

  function lacuHTML(carId, ev) {
    const bandCls = b => ({ L: 'lcL', A: 'lcA', C: 'lcC', U: 'lcU' }[b] || 'lcNA');
    // v8.9.5/v8.9.8 本车版型选择器：有版型明细时默认入门版、可切全系最优；无明细源时仅显示官方全系口径
    const curTrim = ev.target._trim || null;
    const curTrimName = curTrim ? curTrim.name : ((ev.trims && ev.trims.length) ? '全系最优' : '官方全系');
    let trimBar;
    if (ev.trims && ev.trims.length) {
      const opts = [`<option value="${TRIM_BEST}"${ev.trimKey === TRIM_BEST ? ' selected' : ''}>全系最优（性能取上限·价格取入门）</option>`]
        .concat(ev.trims.map((x, i) => `<option value="${i}"${String(i) === String(ev.trimKey) ? ' selected' : ''}>${esc(x.name)}${i === 0 ? '（入门版）' : ''}</option>`))
        .join('');
      trimBar = `<div class="lacu-trim-bar"><span class="lacu-trim-lab">本车版型</span><select data-lacu-trim data-car="${escAttr(carId)}">${opts}</select><span class="lacu-trim-note">本车按所选版型，竞品按全系</span></div>`;
    } else {
      trimBar = `<div class="lacu-trim-bar"><span class="lacu-trim-lab">本车版型</span><select data-lacu-trim data-car="${escAttr(carId)}" disabled><option>官方参数（全系口径）</option></select><span class="lacu-trim-note">该车型暂无分版型数据源</span></div>`;
    }
    const naText = (a, en) => a.part === 'x'
      ? (en === 'ev' ? '本车为纯电车，综合续航即纯电续航，该轴不参评' : '本车非增程/插混，该轴不参评')
      : a.part === 'eg' ? '本车为燃油车，续航/补能仅在同能源新能源组内参评'
      : '该维度竞品圈无可用数据（官方未披露/未补采）';
    const rows = ev.axes.map(ar => {
      const a = ar.ax;
      const selfNa = lacuSelfNA(a, ev.target.energy);
      if (!ar.n) {
        return `<tr data-lacuaxis="${a.key}"><td>${a.name}</td><td colspan="6" class="lacu-na">${selfNa ? naText(a, ev.target.energy) : '该维度同组竞品圈无可用数据（官方未披露/未补采）'}</td></tr>`;
      }
      const s = ar.self;
      const selfDetail = (a.composite === 'handling' && s && s.desc) ? `<br><span class="lacu-sub">${esc(s.desc)}</span>` : '';
      const selfCell = s
        ? `<b>${a.fmt(s.v)}</b><br><span class="lacu-sub">第${s.rank}/${ar.n}名</span>${selfDetail}`
        : (selfNa ? `<span class="lacu-sub">${ev.target.energy === 'ev' ? '纯电车' : ev.target.energy === 'x' ? '增程插混车' : '燃油车'}·不参评</span>` : '<span class="lacu-sub">本车未披露</span>');
      const bandCell = s
        ? (s.band === 'NA'
            ? `<span class="lacu-na">n=${ar.n}＜4不出档</span>`
            : `<span class="lacu-band ${bandCls(s.band)}">${s.band} ${BAND_NAME_LACU[s.band]}</span>`)
        : '<span class="lacu-sub">—</span>';
      const triTier = ar.n >= 4 && ar.n < 7;
      // 四档边界值：L/A/C/U；n<4全不输出，n=4-6不评A
      const noBand = ar.n < 4;
      const cellV = v => (v != null && !noBand) ? a.fmt(v) : '<span class="lacu-sub">—</span>';
      const cellL = noBand ? '<span class="lacu-sub">—</span>' : `<b class="lcL-txt">${a.fmt(ar.p90Val)}</b>`;
      const cellA = ar.n < 4 ? '<span class="lacu-sub">—</span>'
        : ar.n >= 7 ? cellV(ar.p70Val) : '<span class="lacu-sub">n＜7不评A</span>';
      return `<tr data-lacuaxis="${a.key}">
        <td title="${escAttr(a.tip)}">${a.name}</td>
        <td>${selfCell}</td>
        <td>${bandCell}${triTier ? '<br><span class="lacu-sub">n=4-6仅L/C/U</span>' : ''}</td>
        <td>${cellL}</td>
        <td>${cellA}</td>
        <td>${cellV(ar.medVal)}</td>
        <td>${cellV(ar.p30Val)}</td>
      </tr>`;
    }).join('');
    return `
    <div class="lacu-box">
      <div class="aip-sub" style="margin-top:14px">▎LACU 竞品对标（本车口径：<b style="color:#e8b95c">${esc(curTrimName)}</b>）</div>
      <div class="lacu-layout">
        <div class="lacu-radar-col">
          <div class="radar-wrap">${lacuRadar(ev)}<div class="radar-legend">${lacuLegendHTML(ev)}</div>
          ${trimBar}
          <div class="lacu-sub" style="margin-top:3px;line-height:1.5">悬停顶点看数值；n&lt;7以档级为准。</div>
          </div>
        </div>
        <div class="lacu-tbl-col">
          <table class="lacu-table">
            <thead><tr><th>维度</th><th>本车</th><th>LACU</th><th>L</th><th>A</th><th>C</th><th>U</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      <details class="lacu-src" open>
        <summary>LACU竞品数据库 · 竞品圈 ${ev.rivals.length} 款（含逐车对比，可导出WPS）▸</summary>
        <a class="lacu-shadow-link" href="javascript:void(0)" data-lacu-shadow="${escAttr(carId)}" title="生成xlsx，WPS/Excel直接打开">导出 ${esc(ev.target.name)} 的LACU竞品数据库（WPS表格，含L/A/C/U界限） <span class="lacu-shadow-arrow">↗</span></a>
        <div class="lacu-src-note">每版型一页：L/A/C/U界限表＋竞品圈明细，本车金色行，点来源可回溯。重新点击即覆盖。</div>
        <div class="lacu-src-stat">各轴样本：${ev.axes.map(ar => {
          const tag = ar.ax.part === 'all' ? '' : (ev.egName || '');
          return `${AX_SHORT_LACU[ar.ax.key] || ar.ax.name}${tag ? '（' + tag + '）' : ''} n=${ar.n}`;
        }).join('　·　')}</div>
        ${lacuRivalTable(ev)}
      </details>
      <div class="aip-base lacu-base-short">${esc(ev.rivalLabel)}　｜　L/A/C/U＝组内前10%/前30%/中位/后30%，n=4-6仅L/C/U，n&lt;4不出档；续航/补能按同能源组比；操稳＝转弯半径50%+前后悬结构档各20%+可调悬架10%综合分（结构分级不含调校，空悬等配置不计分）。数据${esc((typeof BASE_META !== 'undefined' && BASE_META.month) || '')}基准月。</div>
      <div class="lacu-tip"></div>
    </div>`;
  }
  function applyLacuHidden(host) {
    host.querySelectorAll('[data-layer-toggle]').forEach(s =>
      s.classList.toggle('lacu-leg-off', !!lacuHidden[s.getAttribute('data-layer-toggle')]));
    host.querySelectorAll('g.lacu-layer').forEach(g =>
      g.style.display = lacuHidden[g.getAttribute('data-layer')] ? 'none' : '');
  }
  const lacuTrimState = {}; // carId -> 版型键：'best'全系聚合 / '0','1'…具体版型（trims入门版在前）
  // v8.9.6 影子数据库WPS工作簿：前端按当前口径导出全部版型的LACU结构 → POST /build-shadow → openpyxl生成xlsx
  function lacuMonthKey() {
    const el = document.querySelector('.mp-item.on');
    if (el && el.getAttribute('data-month')) return el.getAttribute('data-month');
    const m = (typeof MONTHLY_POOL !== 'undefined') && MONTHLY_POOL.find(x => x.isCurrent);
    return m ? m.month : '2026-10';
  }
  const r2 = v => (v == null ? null : Math.round(v * 100) / 100);
  async function buildShadowWorkbook(carId, linkEl) {
    const pool = buildPool();
    const t = pool.find(d => d.id === carId);
    if (!t) return;
    const trims = carTrims(t);
    const keys = trims ? trims.map((_, i) => String(i)).concat([TRIM_BEST]) : [TRIM_BEST];
    const tabs = keys.map(key => {
      const ev = lacuEval(trimEffective(t, trims, key), pool);
      if (!ev) return null;
      const axes = ev.axes.map(ar => {
        // v8.9.9 操稳综合分0-1换算为百分制入表，避免与其他轴物理量纲混淆
        const k = ar.ax.composite === 'handling' ? 100 : 1;
        return {
          name: ar.ax.name + (k === 100 ? '（综合分）' : ''), n: ar.n,
          selfV: ar.self ? r2(ar.self.v * k) : null,
          selfRank: ar.self ? ar.self.rank : null,
          selfBand: ar.self ? ar.self.band : null,
          L: r2(ar.p90Val * k), A: r2(ar.p70Val * k), C: r2(ar.medVal * k), U: r2(ar.p30Val * k),
        };
      });
      const seatOf = id => ev.axes.map(ar => {
        const me = ar.members.find(x => x.d.id === id);
        return me ? ((AX_SHORT_LACU[ar.ax.key] || ar.ax.name) + me.rank) : '';
      }).filter(Boolean).join('、');
      const srcKindText = k => k === 'dcd' ? '懂车帝采集库' : k === 'base' ? '汽车之家配置页' : '在库·官方源';
      const members = ev.rivals.map(r => {
        const d = pool.find(x => x.id === r.id) || ev.target;
        const useD = r.id === ev.target.id ? ev.target : d;
        const hf = handlingFactors(useD);
        const gv2 = k => (useD.M[k] && useD.M[k].v != null && !Array.isArray(useD.M[k].v)) ? useD.M[k].v : null;
        const suspCell = (hf.sf != null || hf.sr != null)
          ? `${hf.sf != null ? suspShort(gv2('suspF')) + hf.sf : '—'} / ${hf.sr != null ? suspShort(gv2('suspR')) + hf.sr : '—'}`
          : null;
        return {
          name: r.self ? r.name : (ev.adjLevels && ev.adjLevels.indexOf(d.level) >= 0 ? r.name + '（邻·' + d.level + '）' : r.name),
          self: r.id === ev.target.id,
          price: r2(useD.M.price && useD.M.price.v), accel: r2(useD.M.accel && useD.M.accel.v),
          rangeKm: useD.M.rangeKm ? useD.M.rangeKm.v : null,
          totalRangeKm: useD.M.totalRangeKm ? useD.M.totalRangeKm.v : null,
          eqMin: r2(useD.M.chargeEqMin && useD.M.chargeEqMin.v),
          wheelbase: useD.M.wheelbase ? useD.M.wheelbase.v : null,
          turn: hf.turn != null ? r2(hf.turn) : null, susp: suspCell,
          suspAdj: gv2('suspAdj'), drive: gv2('drive'),
          axes: seatOf(r.id), src: srcKindText(r.srcKind), url: r.url || '',
          _p: useD.M.price && useD.M.price.v != null ? useD.M.price.v : 9999,
        };
      }).sort((a, b) => (b.self - a.self) || (a._p - b._p))
        .map(({ _p, ...rest }) => rest);
      return {
        label: key === TRIM_BEST ? '全系最优' : (trims[key].name + (/^0$/.test(key) ? '（入门版）' : '')),
        band: ev.rivalLabel, axes, members,
      };
    }).filter(Boolean);
    const payload = {
      month: lacuMonthKey(), monthLabel: (typeof REPORT_MONTH !== 'undefined' ? REPORT_MONTH : ''),
      id: carId, name: t.name, builtAt: new Date().toLocaleString('zh-CN'), tabs,
    };
    const old = linkEl ? linkEl.innerHTML : '';
    if (linkEl) { linkEl.innerHTML = '正在按当前口径生成WPS表格，请稍候…'; linkEl.classList.add('busy'); }
    try {
      const resp = await fetch('/build-shadow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await resp.json();
      if (!resp.ok || !j.ok) throw new Error(j.error || ('HTTP ' + resp.status));
      // 用隐式a[download]触发，规避弹窗拦截（WPS/Excel在下载栏直接打开）；并在链接下给出直接入口
      const fname = j.path.split('/').pop();
      const a2 = document.createElement('a');
      a2.href = j.path + '?t=' + Date.now();
      a2.download = fname;
      document.body.appendChild(a2); a2.click(); a2.remove();
      if (linkEl) {
        let okEl = linkEl.parentElement && linkEl.parentElement.querySelector('.lacu-shadow-ok');
        if (!okEl) {
          okEl = document.createElement('div');
          okEl.className = 'lacu-shadow-ok';
          linkEl.insertAdjacentElement('afterend', okEl);
        }
        okEl.innerHTML = '✅ 已生成 <a href="' + j.path + '" target="_blank" rel="noopener">' + fname + '</a>，已开始下载；未自动打开可点文件名';
      }
    } catch (e) {
      alert('WPS表格生成失败：' + e.message);
    } finally {
      if (linkEl) { linkEl.innerHTML = old; linkEl.classList.remove('busy'); }
    }
  }
  function mountLacu(carId) {
    const panel = document.querySelector('#modalBox .ai-panel');
    const host = panel && panel.querySelector('[data-lacu]');
    if (!host) return;
    const pool = buildPool();
    const t = pool.find(d => d.id === carId);
    if (!t) { host.innerHTML = ''; return; }
    const trims = carTrims(t);
    let trimKey = lacuTrimState[carId];
    if (trimKey == null || (trimKey !== TRIM_BEST && !trims)) trimKey = trims ? '0' : TRIM_BEST; // v8.9.5：有版型数据默认入门版
    const tEff = trimEffective(t, trims, trimKey);
    const ev = lacuEval(tEff, pool);
    if (!ev) { host.innerHTML = ''; return; }
    ev.trims = trims; ev.trimKey = trimKey;
    host.innerHTML = lacuHTML(carId, ev);
    applyLacuHidden(host);
    if (!host.dataset.lacuBound) {
      host.dataset.lacuBound = '1';
      // 图例隐线
      host.addEventListener('click', e => {
        const leg = e.target.closest && e.target.closest('[data-layer-toggle]');
        if (!leg || !host.contains(leg)) return;
        const lk = leg.getAttribute('data-layer-toggle');
        lacuHidden[lk] = !lacuHidden[lk];
        applyLacuHidden(host);
      });
      // v8.9.5：本车版型切换（雷达/矩阵/来源表/竞品价格带整体重算）
      host.addEventListener('change', e => {
        const sel = e.target.closest && e.target.closest('[data-lacu-trim]');
        if (!sel) return;
        lacuTrimState[sel.getAttribute('data-car')] = sel.value;
        mountLacu(sel.getAttribute('data-car'));
      });
      // v8.9.6：影子数据库WPS表格（xlsx）即时生成并打开
      host.addEventListener('click', e => {
        const link = e.target.closest && e.target.closest('[data-lacu-shadow]');
        if (!link || !host.contains(link)) return;
        buildShadowWorkbook(link.getAttribute('data-lacu-shadow'), link);
      });
      // 顶点浮签 + 顶点↔表行双向高亮（mouseover/mousemove/mouseout 委托）
      host.addEventListener('mouseover', e => {
        const v = e.target.closest && e.target.closest('[data-tip]');
        const tip = host.querySelector('.lacu-tip');
        if (v && tip) { tip.textContent = v.getAttribute('data-tip'); tip.style.display = 'block'; }
        const row = e.target.closest && e.target.closest('tr[data-lacuaxis]');
        const vtx = e.target.closest && e.target.closest('[data-vtx]');
        const k = row ? row.getAttribute('data-lacuaxis') : (vtx ? vtx.getAttribute('data-vtx') : null);
        host.querySelectorAll('.lacu-hi').forEach(el => el.classList.remove('lacu-hi'));
        host.querySelectorAll('tr.lacu-row-hi').forEach(el => el.classList.remove('lacu-row-hi'));
        if (k) {
          host.querySelectorAll(`[data-spoke="${k}"]`).forEach(el => el.classList.add('lacu-hi'));
          host.querySelectorAll(`[data-vtx="${k}"]`).forEach(el => el.classList.add('lacu-hi'));
          host.querySelectorAll(`tr[data-lacuaxis="${k}"]`).forEach(el => el.classList.add('lacu-row-hi'));
          // 顶点悬停时把对应表行滚入可视区（长表格/折叠面板场景）
          if (vtx) { const tr = host.querySelector(`tr[data-lacuaxis="${k}"]`); if (tr) tr.scrollIntoView({ block: 'nearest' }); }
        }
      });
      host.addEventListener('mousemove', e => {
        const tip = host.querySelector('.lacu-tip');
        if (!tip || tip.style.display !== 'block') return;
        tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 240) + 'px';
        tip.style.top = Math.min(e.clientY + 14, window.innerHeight - 90) + 'px';
      });
      host.addEventListener('mouseout', e => {
        const v = e.target.closest && e.target.closest('[data-tip]');
        if (v) { const tip = host.querySelector('.lacu-tip'); if (tip) tip.style.display = 'none'; }
      });
    }
  }

  /* ================= 五、SVG 雷达图 ================= */
  function radarSVG(series, opts) {
    // series: [{name,color,scores:{key:0-100},dashed?}]
    opts = opts || {};
    const W = 320, H = 290, cx = 160, cy = 150, R = 92;
    const N = AXES.length;
    const pt = (keyIdx, ratio) => {
      const ang = -Math.PI / 2 + keyIdx * 2 * Math.PI / N;
      return [cx + R * ratio * Math.cos(ang), cy + R * ratio * Math.sin(ang)];
    };
    let g = '';
    // 网格环
    for (const ring of [0.25, 0.5, 0.75, 1]) {
      const pts = AXES.map((_, i) => pt(i, ring).map(x => x.toFixed(1)).join(',')).join(' ');
      g += `<polygon points="${pts}" fill="none" stroke="#2a3c5e" stroke-width="1"/>`;
    }
    // 轴线 + 标签
    AXES.forEach((a, i) => {
      const [x, y] = pt(i, 1);
      g += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#2a3c5e" stroke-width="1"/>`;
      const [lx, ly] = pt(i, 1.22);
      const anchor = Math.abs(lx - cx) < 12 ? 'middle' : (lx > cx ? 'start' : 'end');
      g += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" fill="#93a4bd" font-size="12" text-anchor="${anchor}">${a.name}</text>`;
    });
    // 数据多边形
    for (const s of series) {
      const pts = [], labels = [];
      AXES.forEach((a, i) => {
        const v = s.scores[a.key];
        if (v == null) {
          // 未披露/不适用轴：不进多边形，但画空心虚线圈占位，保证六边形框架完整可读
          if (!s.dashed) {
            const [mx, my] = pt(i, 0.05);
            g += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3.5" fill="none" stroke="#64748f" stroke-width="1.2" stroke-dasharray="2 2"/>`;
          }
          pts.push(null); return;
        }
        pts.push(pt(i, Math.max(0.04, v / 100)));
      });
      if (pts.every(p => !p)) continue;
      // 断点用移动分段
      let path = '';
      pts.forEach((p, i) => { if (p) path += (i === 0 || !pts[i - 1] ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' '; });
      g += `<path d="${path}" fill="${s.color}" fill-opacity="${s.dashed ? 0.05 : 0.16}" stroke="${s.color}" stroke-width="${s.dashed ? 1.2 : 2}" ${s.dashed ? 'stroke-dasharray="4 3"' : ''}/>`;
      pts.forEach((p, i) => { if (p) g += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${s.dashed ? 2 : 3}" fill="${s.color}"/>`; });
      if (opts.showScore) {
        AXES.forEach((a, i) => {
          const v = s.scores[a.key];
          if (v == null || s.dashed) return;
          const [sx, sy] = pt(i, Math.max(0.04, v / 100) + 0.13);
          g += `<text x="${sx.toFixed(1)}" y="${(sy + 3).toFixed(1)}" fill="${s.color}" font-size="9.5" text-anchor="middle">${v}</text>`;
        });
      }
    }
    let legend = '';
    if (series.length > 1) {
      legend = series.map((s, i) =>
        `<span class="radar-leg"><i style="background:${s.color}${s.dashed ? ';background:transparent;border:1px dashed ' + s.color : ''}"></i>${s.name}</span>`).join('');
    }
    return `<div class="radar-wrap"><svg viewBox="0 0 ${W} ${H}" class="radar-svg">${g}</svg>` +
           `<div style="font-size:11px;color:#64748f;margin-top:2px">空心虚线圈＝该轴未披露/不适用，不计分、不进座次；插混/增程/燃油车的续航能耗与补能两轴为"不适用"</div>` +
           (legend ? `<div class="radar-legend">${legend}</div>` : '') + `</div>`;
  }

  /* ================= 六、页面注入 ================= */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function findCarAnywhere(id) {
    if (typeof CARS !== 'undefined') { const c = CARS.find(x => x.id === id); if (c) return c; }
    if (typeof COMP_CARS !== 'undefined') { const c = COMP_CARS.find(x => x.id === id); if (c) return c; }
    // 历史月份切换后的兜底
    if (typeof byId === 'function') { const c = byId(id); if (c) return c; }
    return null;
  }

  // --- 单车面板（能力分主导；权重预设可切换重渲染） ---
  let panelPreset = 'equal';
  function unratedHTML(carId, segName) {
    return `
    <div class="ai-panel" data-car="${esc(carId)}">
      <div class="aip-head">
        <span class="aip-title">🧠 性能定位</span>
        <span class="aip-tag">能力分 · 基于已录入参数</span>
      </div>
      <div class="aip-miss">「${esc(segName)}」缺少规范级别标注且无车长/轴距参数，无法匹配评分标准卡。补全长宽轴距或规范级别（如"中型SUV"）后自动生成能力画像。</div>
      <div class="aip-actions">
        <button class="aip-btn aip-btn-cmp" data-act="togglecmp" data-id="${esc(carId)}">📊 加入多车对比</button>
        <button class="aip-btn aip-btn-ai" data-act="deep" data-id="${esc(carId)}">🤖 飞书 AI 深度解读</button>
      </div>
      <div class="aip-chat" data-chat></div>
    </div>`;
  }
  function presetBarHTML(active) {
    return `<div class="aip-presets"><span class="ap-label">评分权重：</span>` +
      Object.keys(PRESETS).map(k =>
        `<button class="ap-btn ${k === active ? 'on' : ''}" data-act="preset" data-preset="${k}">${esc(PRESETS[k].name)}</button>`).join('') +
      `</div>`;
  }
  function panelHTML(carId, r, preset) {
    const t = r.target;
    const v = buildVerdict(r, preset);
    const series = [];
    if (!r.thin) series.push({ name: r.peerBaseN > 0 ? '同级均值（含基准车）' : '同级均值', color: '#7d8ea8', scores: r.peerAvg, dashed: true });
    series.push({ name: t.name, color: '#2e7cf6', scores: objMap(r.axes, x => x.score), showScore: true });
    const rankTxt = c => c.sole ? '同级唯一披露'
      : c.rank == null ? '暂无同级座次'
      : `同级${c.tied ? '并列第' : '第'}${c.rank}/${c.total}`;
    const cardHTML = (c, bad) => `
      <div class="hl-card ${bad ? 'hl-bad' : 'hl-good'}">
        <div class="hl-h">
          <span class="hl-badge">${esc(c.name)}</span>
          <span class="hl-score-big">${c.score}<small>分</small></span>
          <span class="hl-rank">${rankTxt(c)}</span>
          <span class="hl-avg">${c.avg == null ? '' : '均值' + c.avg}</span>
        </div>
        ${c.facts.length ? `<div class="hl-facts">${c.facts.map(esc).join('；')}</div>` : ''}
        ${c.usp ? `<div class="hl-usp">官方卖点：${esc(c.usp)}</div>` : ''}
      </div>`;
    const ch = v.chassis;
    const ov = v.ov;
    const gk0 = gk(t.level, t.body);
    const srcTxt = LEVEL_SRC_TXT[r.levelSource] || '—';
    const calTxt = r.calibrated
      ? `V2锚点（${ANCHOR_V2.month}基准月，行业样本${ANCHOR_V2.calibratedGroups[gk0]}款）`
      : '试行锚点，分数仅供趋势参考';
    const lowConfTxt = ANCHOR_V2.lowConfNote[gk0] ? `｜<span class="aip-warn">${esc(ANCHOR_V2.lowConfNote[gk0])}</span>` : '';
    return `
    <div class="ai-panel" data-car="${esc(carId)}">
      <div class="aip-head">
        <span class="aip-title">🧠 性能定位</span>
        <span class="aip-tag">能力分 ${STD_VER} · 同级严格对比</span>
      </div>
      ${presetBarHTML(preset)}
      <div class="aip-concl ${esc(v.cls)}">${esc(v.line2)}</div>
      <div class="aip-grid">
        <div class="aip-radar-col">
          ${radarSVG(series, { showScore: true })}
          <div class="aip-score">
            <div class="aip-score-num ${esc(v.cls)}">${v.noOverall ? '—' : ov.score}<small>/100</small></div>
            <div class="aip-score-word">${v.noOverall ? '参数覆盖不足，无综合分'
              : (ov.rank == null ? '暂无同级座次'
                 : `同级${ov.tied ? '并列第' : '第'}${ov.rank}/${ov.total}` + (ov.avg == null ? '（唯一披露）' : ` · 均值${ov.avg}分`)) + (v.word ? ' · ' + v.word : '')}</div>
          </div>
        </div>
        <div class="aip-txt-col">
          <p class="aip-line aip-idline">${esc(v.line1)}</p>
          ${v.highlights.length ? `<div class="aip-sub aip-lead">▎能力强项（≥80分）</div><div class="hl-list">${v.highlights.map(c => cardHTML(c, false)).join('')}</div>` : ''}
          ${v.weak.length ? `<div class="aip-sub aip-weak">▎能力短板（≤50分）</div><div class="hl-list">${v.weak.map(c => cardHTML(c, true)).join('')}</div>` : ''}
          ${ch ? `<div class="aip-sub">▎底盘与四驱（标准卡之外·只陈列不打分）<span class="chassis-rate">同级${ch.advN}/${ch.total}款配备高阶可变悬架</span></div>
            <div class="aip-chassis">
              <div class="hl-facts">${ch.rows.map(esc).join('；')}</div>
              ${ch.usp ? `<div class="hl-usp">官方卖点：${esc(ch.usp)}</div>` : ''}
            </div>` : ''}
          ${v.missing.length ? `<div class="aip-miss">以下维度参数未披露，不参与评分：${v.missing.map(esc).join('、')}</div>` : ''}
          ${v.incomparable.length ? `<div class="aip-miss">${v.incomparable.map(esc).join('、')}仅在纯电车型间评分，本车（${esc(ENERGY_NAME[t.energy] || '非纯电')}）该轴不参评。</div>` : ''}
          <div class="aip-base">同级${esc(t.level)}${esc(BODY_NAME[t.body] || '')}：在库${r.peerInN}款＋行业基准${r.peerBaseN}款${r.peerBaseN > 0 ? '（基准车仅作背景板，不参与安全气囊/智驾座次）' : ''}｜级别来源：${esc(srcTxt)}${v.thin ? '｜<span class="aip-warn">同级不足4款，座次仅供参考</span>' : ''}｜${calTxt}${lowConfTxt}｜性能取全系最优、售价入门价；权重「${esc(PRESETS[preset].name)}」。</div>
          <div class="aip-actions">
            <button class="aip-btn aip-btn-cmp" data-act="togglecmp" data-id="${esc(carId)}">📊 加入多车对比</button>
            <button class="aip-btn aip-btn-ai" data-act="deep" data-id="${esc(carId)}">🤖 飞书 AI 深度解读</button>
          </div>
          <div class="aip-chat" data-chat></div>
        </div>
      </div>
      <div data-lacu></div>
    </div>`;
  }
  function mountPanel(carId) {
    const box = document.getElementById('modalBox');
    if (!box) return;
    const old = box.querySelector('.ai-panel');
    if (old) old.remove();
    const raw = findCarAnywhere(carId);
    if (!raw || !raw.specs) return;
    const body = box.querySelector('.body');
    if (!body) return;
    const pool = buildPool();
    const t = pool.find(d => d.id === carId);
    if (!t) return;
    const r = evaluate(t, pool);
    if (r.unrated) {
      body.insertAdjacentHTML('afterbegin', unratedHTML(carId, r.target.seg || '该车型'));
    } else {
      body.insertAdjacentHTML('afterbegin', panelHTML(carId, r, panelPreset));
      mountLacu(carId);
    }
    refreshCmpBtn(carId);
  }
  function rerenderPanel(carId, preset) {
    panelPreset = preset;
    const old = document.querySelector('#modalBox .ai-panel');
    if (!old) return;
    const pool = buildPool();
    const t = pool.find(d => d.id === carId);
    if (!t) return;
    const r = evaluate(t, pool);
    if (r.unrated) return;
    old.outerHTML = panelHTML(carId, r, preset);
    mountLacu(carId);
    refreshCmpBtn(carId);
  }
  function objMap(o, f) { const r2 = {}; for (const k in o) r2[k] = f(o[k]); return r2; }

  // --- 全局：对比选择（最多4台） ---
  const cmpSel = [];
  function toggleCmp(id) {
    const i = cmpSel.indexOf(id);
    if (i >= 0) cmpSel.splice(i, 1);
    else { if (cmpSel.length >= 4) { alertCmp('最多同时对比 4 款车型'); return; } cmpSel.push(id); }
    renderCmpBar();
    refreshCmpBtn(id);
    // 同步对比弹窗内勾选态
    document.querySelectorAll('[data-pickid]').forEach(el => {
      el.classList.toggle('checked', cmpSel.includes(el.getAttribute('data-pickid')));
    });
  }
  function alertCmp(msg) {
    const bar = document.getElementById('aiCmpBar');
    if (!bar) return;
    const tip = document.getElementById('aiCmpTip');
    tip.textContent = msg; tip.style.opacity = '1';
    setTimeout(() => { tip.style.opacity = '0'; }, 2200);
  }
  function refreshCmpBtn(id) {
    document.querySelectorAll(`.aip-btn-cmp[data-id="${CSS.escape(id)}"]`).forEach(b => {
      const on = cmpSel.includes(id);
      b.classList.toggle('on', on);
      b.textContent = on ? '✓ 已加入对比（点击移除）' : '📊 加入多车对比';
    });
  }

  function renderCmpBar() {
    const bar = document.getElementById('aiCmpBar');
    if (!bar || !cmpSel.length) { if (bar) bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const pool = buildPool();
    document.getElementById('aiCmpChips').innerHTML = cmpSel.map(id => {
      const d = pool.find(x => x.id === id);
      return `<span class="cmp-chip">${esc(d ? d.name : id)}<i data-act="remove" data-id="${esc(id)}">×</i></span>`;
    }).join('');
    document.getElementById('aiCmpGo').textContent = `开始 AI 对比（${cmpSel.length}/4）`;
  }

  // --- 对比大弹窗 ---
  function openCmpModal() {
    if (cmpSel.length < 2) { alertCmp('请至少选择 2 款车型'); return; }
    cmpPreset = 'equal';
    const mask = document.getElementById('aiCmpMask');
    renderCmpModalBody();
    mask.classList.remove('hidden');
  }
  function closeCmpModal() { document.getElementById('aiCmpMask').classList.add('hidden'); }

  function carOptions() {
    const pool = buildPool();
    const g1 = pool.filter(d => d.srcKind === 'month');
    const g2 = pool.filter(d => d.srcKind === 'library');
    const opt = d => `<div class="pick-item ${cmpSel.includes(d.id) ? 'checked' : ''}" data-pickid="${esc(d.id)}" data-act="pick">
      <span class="pick-check">${cmpSel.includes(d.id) ? '✓' : ''}</span>
      <span class="pick-name">${esc(d.name)}</span>
      <span class="pick-seg">${esc(d.level ? d.level + (BODY_NAME[d.body] || '') : (d.seg || '未分级'))} · ${ENERGY_NAME[d.energy] || ''}</span>
    </div>`;
    return `<div class="pick-group"><div class="pick-gname">当月新车（${g1.length}）</div>${g1.map(opt).join('')}</div>
            <div class="pick-group"><div class="pick-gname">竞品库（${g2.length}）</div>${g2.map(opt).join('')}</div>`;
  }

  let cmpPreset = 'equal';
  function renderCmpModalBody() {
    const pool = buildPool();
    const sel = cmpSel.map(id => pool.find(d => d.id === id)).filter(Boolean);
    const evals = sel.map(d => evaluate(d, pool));
    const vd = buildCompareVerdict(evals, cmpPreset);
    const colors = ['#2e7cf6', '#34c98e', '#f0a13a', '#a878f0'];
    const series = evals.map((e, i) => ({
      name: e.target.name.length > 12 ? e.target.name.slice(0, 12) + '…' : e.target.name,
      color: colors[i], scores: objMap(e.axes, x => x.score),
    }));
    const presetBtns = `<div class="aip-presets cmp-presets"><span class="ap-label">排名权重：</span>` +
      Object.keys(PRESETS).map(k =>
        `<button class="ap-btn ${k === cmpPreset ? 'on' : ''}" data-act="cmppreset" data-preset="${k}">${esc(PRESETS[k].name)}</button>`).join('') + `</div>`;
    const withBase = evals.some(e => !e.unrated && e.peerBaseN > 0);
    const baseNote = !vd.crossLevel && withBase
      ? `<div class="aicmp-warn" style="background:rgba(53,208,224,.10);border-color:#35d0e0;color:#9fd9e0">ℹ️ 座次分母含行业基准车（仅作背景，不显示车名）。</div>`
      : '';
    const radarBlock = vd.crossLevel
      ? `<div class="radar-off"><div class="radar-off-ico">⛔</div>跨级车型适用<b>不同的品类评分标准卡</b>，能力分雷达不可叠加比较。<br>请以下方「参数原值★表」与「本组占优」轴做跨级判断。</div>`
      : radarSVG(series, { showScore: false });

    // 参数表：每行选最优
    const rows = TABLE_METRICS.map(mk => {
      const vals = evals.map(e => e.target.M[mk].v);
      const meta = METRIC_META[mk];
      let bestIdx = -1;
      const valid = vals.map((v, i) => ({ v, i })).filter(x => x.v != null);
      if (valid.length >= 2) {
        valid.sort((a, b) => meta.dir * (b.v - a.v));
        if (valid[0].v !== valid[1].v) bestIdx = valid[0].i;
      }
      const cells = evals.map((e, i) => {
        const f = displayOf(e.target, mk);
        return `<td class="${f.v == null ? 'cm-empty' : ''} ${i === bestIdx ? 'cm-best' : ''}">${esc(f.text)}${i === bestIdx ? ' <b class="cm-crown">★</b>' : ''}</td>`;
      }).join('');
      return `<tr><th>${meta.name}</th>${cells}</tr>`;
    }).join('');

    const headCells = evals.map((e, i) => {
      const oo = e.unrated ? null : e.overalls[cmpPreset];
      const sc = oo && oo.score != null && oo.cov >= 0.6 ? oo.score : null;
      return `
      <th class="cm-head">
        <span class="cm-dot" style="background:${colors[i]}"></span>
        <span class="cm-hname">${esc(e.target.name)}</span>
        <span class="cm-hscore">${sc == null ? '—' : sc + '分'}</span>
      </th>`;
    }).join('');

    const winTxt = e => {
      const w = vd.wins[e.target.id] || [];
      return w.length ? '；本组占优：' + w.map(esc).join('、') : '';
    };
    let rankTxt;
    if (!vd.crossLevel) {
      // 同级：综合分达闸门的车按分总排名（括号附全组座次），闸门外车只陈列
      const lines = vd.rank.map((e, i) => {
        const o = e.overalls[cmpPreset];
        return `<li><b>${i + 1}. ${esc(e.target.name)}</b> 综合能力${o.score}分 · 同级${o.tied ? '并列第' : '第'}${o.rank}/${o.total}（均值${o.avg == null ? '—' : o.avg}分）${winTxt(e)}</li>`;
      });
      vd.rankSkipped.forEach(e => {
        const o = e.overalls[cmpPreset];
        lines.push(`<li><b>${esc(e.target.name)}</b> 已披露参数权重覆盖度${Math.round(o.cov * 100)}%＜60%，不计算综合分、不参与总排名，请按单项能力分与参数原值判读${winTxt(e)}</li>`);
      });
      rankTxt = lines.join('');
    } else {
      // 跨级：不排总名次，只逐车列占优轴，结论以参数★为准
      rankTxt = evals.map(e => {
        if (e.unrated) return `<li><b>${esc(e.target.name)}</b>（级别未判定，未匹配评分标准卡）${winTxt(e)}</li>`;
        const o = e.overalls[cmpPreset];
        const scoreTxt = o.score != null && o.cov >= 0.6 ? o.score + '分' : `无综合分（覆盖度${Math.round(o.cov * 100)}%）`;
        return `<li><b>${esc(e.target.name)}</b> 能力分按其「${e.target.level}${BODY_NAME[e.target.body] || ''}」品类标准卡评定（${scoreTxt}），不与他级总排${winTxt(e)}</li>`;
      }).join('');
    }

    const html = `
    <div class="aicmp-box">
      <div class="aicmp-head">
        <h2>📊 AI 多车型性能对比</h2>
        <button class="close" data-act="closecmp">✕</button>
      </div>
      <div class="aicmp-body">
        ${presetBtns}
        ${baseNote}
        ${vd.crossLevel ? '<div class="aicmp-warn">⚠ 所选车型非同一级别/车身形式：各车适用不同品类评分标准卡，不做综合总排名、不叠加雷达；跨级比较请以参数原值（★为本组最优）与"本组占优"轴为准。</div>' : ''}
        <div class="aicmp-cols">
          <div class="aicmp-main">
            <div class="aicmp-card">
              <div class="aicmp-c-title">六维能力雷达${vd.crossLevel ? '' : '（同一标准卡，可直接比较）'}</div>
              ${radarBlock}
            </div>
            <div class="aicmp-card">
              <div class="aicmp-c-title">关键参数对比（★为本组最优）</div>
              <div class="cm-table-wrap"><table class="cmp-table"><thead><tr><th>指标</th>${headCells}</tr></thead><tbody>${rows}</tbody></table></div>
            </div>
          </div>
          <div class="aicmp-side">
            <div class="aicmp-card aicmp-pick">
              <div class="aicmp-c-title">选择车型（2-4款）<span id="pickCount">${cmpSel.length}/4</span></div>
              <div class="pick-list">${carOptions()}</div>
            </div>
            <div class="aicmp-card">
              <div class="aicmp-c-title">AI 对比结论</div>
              <ul class="verdict-rank">${rankTxt}</ul>
              ${vd.advice.length ? `<div class="verdict-advice">${vd.advice.map(a => '<div>' + esc(a).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</div>').join('')}</div>` : ''}
              <button class="aip-btn aip-btn-ai aip-btn-block" data-act="deepcmp">🤖 飞书 AI 生成对比解读</button>
              <div class="aip-chat" data-chatcmp></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    const box = document.getElementById('aiCmpBox');
    box.innerHTML = html;
  }

  /* ================= 七、飞书智能伙伴适配层（可选增强） =================
   * 启用前提（企业飞书管理员一次性配置）：
   *  1) 飞书 aily 创建并发布"竞品分析智能伙伴"，开启 OpenAPI 渠道，记录 AgentID；
   *  2) 创建飞书自建应用，申请 aily 会话权限并通过管理员审批；
   *  3) 部署一个令牌代理（保密 app_secret 并换取 user_access_token），
   *     代理契约：POST {proxyUrl}  body: {agentId, content, sessionId?}
   *     返回 JSON {reply, sessionId}（或 SSE：data: {delta} / data: {done,sessionId}）。
   * 部署时在本文件前/控制台注入：
   *   window.AI_LARK_CONFIG = { agentId: 'agent_xxx', proxyUrl: 'https://your-proxy/aily/chat' };
   * ===================================================================== */
  const LarkAI = {
    cfg() { return window.AI_LARK_CONFIG || JSON.parse(localStorage.getItem('ai_lark_config') || 'null'); },
    enabled() { const c = this.cfg(); return !!(c && c.agentId && c.proxyUrl); },
    promptCar(d, r, preset) {
      const lines = [];
      lines.push(`车型：${d.name}（${d.brand}）｜级别：${d.seg}｜能源：${ENERGY_NAME[d.energy]}`);
      for (const mk of TABLE_METRICS) if (d.M[mk].v != null) lines.push(`${METRIC_META[mk].name}：${displayOf(d, mk).text}`);
      if (r.unrated) {
        lines.push('该车型级别/尺寸参数不足，未匹配评分标准卡，暂无能力分。');
      } else {
        const v = buildVerdict(r, preset || 'equal');
        const segTitle = r.target.level + (BODY_NAME[r.target.body] || '车');
        const calDesc = ANCHOR_V2.calibratedGroups[r.target.level + '|' + r.target.body]
          ? `V2混合锚点（100分=工程天花板，90-30分=AH ${ANCHOR_V2.month}市场分位P90-P30，样本${ANCHOR_V2.calibratedGroups[r.target.level + '|' + r.target.body]}款）`
          : '工程经验锚点（该品类未做市场分位校准）';
        lines.push(`评分口径：品类标准卡能力分（${STD_VER}，0-100绝对标尺；「${segTitle}」卡为${calDesc}，分段插值），括号附同级座次（分母=在库车+行业基准影子库）；权重预设：${PRESETS[v.preset].name}。`);
        lines.push('六维能力分：' + AXES.map(a => {
          const x = r.axes[a.key];
          if (!x || x.score == null) return `${a.name}=未参评`;
          const tail = x.rank == null ? '' : `(同级${x.tied ? '并列第' : '第'}${x.rank}/${x.total})`;
          return `${a.name}=${x.score}分${tail}`;
        }).join('，'));
        if (!v.noOverall) {
          const o = v.ov;
          lines.push(`综合能力：${o.score}/100（同级${o.rank == null ? '无座次' : `${o.tied ? '并列第' : '第'}${o.rank}/${o.total}`}，同级均值${o.avg == null ? '—' : o.avg}分）。${v.line2}`);
        } else lines.push(v.line2);
      }
      const usp = (d.raw.usp || []).concat((d.raw.uspGroups || []).flatMap(g => (g.items || []).map(i => `${i.t}：${i.d}`)));
      if (usp.length) lines.push('核心卖点：' + usp.slice(0, 8).join('；'));
      return '你是汽车整车性能集成专家。仅依据下列本站已核实的参数与能力分进行分析，不得编造未提供的数据，数字须与给定数据一致。' +
        '请输出：①一句话性能定位；②能力强项与同级对比优势（附参数依据）；③短板与风险；④对我方产品规划的参考建议（300字内）。\n\n' +
        lines.join('\n');
    },
    promptCompare(evals, preset) {
      preset = PRESETS[preset] ? preset : 'equal';
      const blocks = evals.map(e => this.promptCar(e.target, e, preset).replace(/^你是[\s\S]*?\n\n/, '')).join('\n---\n');
      const vd = buildCompareVerdict(evals, preset);
      const head = vd.crossLevel
        ? '注意：下列车型非同级别/同车身，适用不同品类评分标准卡，能力分不可跨级直接比较、不做总排名；请基于参数原值与各车同级座次对比。'
        : `下列车型互为同级、共用同一张标准卡，可按「${PRESETS[preset].name}」综合能力分总排名。`;
      return '你是汽车整车性能集成专家。下面是' + evals.length + '款竞品的本站已核实参数与品类标准卡能力分，仅依据这些数据对比，不得编造。' + head +
        '请输出：' + (vd.crossLevel ? '①逐车定位与参数优劣势（不做总排名）' : '①综合排序与一句话理由') + '；②各车差异化定位；③分场景选购/对标建议（家用、性能、智能、成本）；④对我方产品规划的启示（400字内）。\n\n' + blocks;
    },
    async chat(content, sessionId, onDelta) {
      const c = this.cfg();
      const resp = await fetch(c.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: c.agentId, content, sessionId: sessionId || null }),
      });
      if (!resp.ok) throw new Error('代理返回 ' + resp.status);
      const sidRef = { sessionId };
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('text/event-stream') && resp.body && resp.body.getReader) {
        const reader = resp.body.getReader();
        const dec = new TextDecoder('utf-8');
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n'); buf = parts.pop();
          for (const p of parts) {
            const line = p.split('\n').find(x => x.startsWith('data:'));
            if (!line) continue;
            try {
              const j = JSON.parse(line.slice(5).trim());
              if (j.delta) onDelta(j.delta);
              if (j.sessionId) sidRef.sessionId = j.sessionId;
            } catch (e2) { /* 忽略心跳/非JSON */ }
          }
        }
      } else {
        const j = await resp.json();
        if (j.reply) onDelta(j.reply);
        if (j.sessionId) sidRef.sessionId = j.sessionId;
      }
      return sidRef.sessionId;
    },
  };

  // 加载反馈助手：转圈+已等待秒数，首个数据到达后调用返回的 stop()
  function aiLoading(el, msg) {
    el.innerHTML = '<span class="ai-spin"></span>' + esc(msg) + '<span class="ai-elapsed">0s</span>';
    const t0 = Date.now();
    const sp = el.querySelector('.ai-elapsed');
    const tm = setInterval(() => {
      if (!sp.isConnected) { clearInterval(tm); return; }
      sp.textContent = Math.round((Date.now() - t0) / 1000) + 's';
    }, 500);
    return () => clearInterval(tm);
  }

  /* ================= 六B、板块级 AI 问答栏（总览/新车型/新技术） ================= */
  const AIAsk = (() => {
    const SECTION_META = {
      overview: { name: '总览', hint: '问本月竞品整体趋势 / 重点车型 / 技术动态…' },
      cars: { name: '新车型', hint: '问本月新车对比 / 参数 / 定位 / 值得关注的车型…' },
      tech: { name: '新技术', hint: '问本月零部件新技术 / 产业信号解读…' },
    };
    const hist = {}; // section -> [{q,a}]

    function month() { return (typeof REPORT_MONTH !== 'undefined') ? REPORT_MONTH : ''; }
    function carsCtx() {
      const cars = (typeof CARS !== 'undefined') ? (window._OC || CARS) : [];
      return cars.map(c =>
        `${c.name}（${c.brand}）｜${c.seg}｜${c.power}｜${c.price}｜${c.range || '续航未列'}｜智驾:${c.adas || '未列'}｜座舱:${c.cockpit || '未列'}` +
        (c.usp && c.usp.length ? '｜卖点:' + c.usp.slice(0, 3).join('；') : '')
      ).join('\n');
    }
    function techCtx() {
      const ts = (typeof TECHS !== 'undefined') ? (window._OT || TECHS) : [];
      return ts.map(t => `${t.date || ''} ${t.title || ''}：${(t.point || t.desc || '')}`).join('\n');
    }
    function signalsCtx() {
      const sg = (typeof SIGNALS !== 'undefined') ? (window._SG || SIGNALS) : [];
      return sg.map(s => `${s.date || ''} ${s.title || ''}：${(s.desc || s.point || '')}`).join('\n');
    }
    function buildPrompt(section, q) {
      let ctx = '';
      if (section === 'cars' || section === 'overview') ctx += `【${month()}本月新上市/预售车型清单】\n` + carsCtx() + '\n\n';
      if (section === 'tech' || section === 'overview') ctx += `【${month()}零部件新技术动态】\n` + techCtx() + '\n\n';
      if (section === 'overview') ctx += `【${month()}产业信号】\n` + signalsCtx() + '\n\n';
      let h = '';
      const hs = hist[section] || [];
      if (hs.length) {
        const last = hs[hs.length - 1];
        h = `【上一轮问答】问：${last.q}\n答（节选）：${last.a.slice(0, 800)}\n\n`;
      }
      return `你是汽车竞品情报分析助手，服务对象是整车性能集成工程师与其领导。以下为本站已核实的${month()}月报数据，仅依据这些数据回答；数据未覆盖的明确说明"本月报未覆盖"，不得编造。\n\n` +
        ctx + h + `【用户问题】${q}\n\n请结构化回答（600字内）：\n① 一句话结论；\n② 若用户找竞品参考：逐车给出「定位一句话＋与问题直接相关的参数/卖点依据＋一句点评（优势或风险）」，严禁只罗列参数不做解读；\n③ 末尾给出推荐优先级或一句话总结。`;
    }

    function html(section) {
      const m = SECTION_META[section];
      if (!m) return '';
      if (!LarkAI.enabled()) return ''; // 未配置代理时不显示，保持页面干净
      return `<div class="ai-ask" data-ask="${section}">
        <div class="ai-ask-row">
          <span class="ai-ask-ico">🤖</span>
          <input class="ai-ask-input" placeholder="问AI · ${esc(m.hint)}" data-askinput>
          <button class="ai-ask-btn" data-askbtn>提问</button>
          <button class="ai-ask-btn ai-ask-gap" data-askgap title="让AI对照公开信息排查本月报可能遗漏的新车/技术，结果需人工核实后入库">🔍查漏</button>
        </div>
        <div class="ai-ask-tip">基于本月报已核实数据（车型${(typeof CARS !== 'undefined' ? (window._OC || CARS).length : 0)}款/技术/信号）由豆包大模型解读 · 结果供参考，评分口径以本地引擎为准</div>
        <div class="ai-ask-resp"></div>
      </div>`;
    }

    // 检索过程可视化：从问题提取关键词（含"15w/15万"价位），在数据池中命中匹配
    function matchTrace(section, q) {
      const cars = (typeof CARS !== 'undefined') ? (window._OC || CARS) : [];
      const techs = (typeof TECHS !== 'undefined') ? (window._OT || TECHS) : [];
      const sgs = (typeof SIGNALS !== 'undefined') ? (window._SG || SIGNALS) : [];
      const tokens = (q.match(/[一-龥]{2,}|[A-Za-z][A-Za-z0-9]*/g) || [])
        .filter(w => !('本月|哪些|什么|怎么|怎么样|推荐|参考|对比|一下|解读|分析|值得|关注'.split('|')).includes(w));
      const priceM = q.match(/(\d+(?:\.\d+)?)\s*[wW万]/);
      const budget = priceM ? parseFloat(priceM[1]) : null;
      const hits = [];
      if (section !== 'tech') {
        cars.forEach(c => {
          let s = 0;
          const hay = c.name + c.brand + c.seg + c.power + (c.adas || '') + (c.cockpit || '') + (c.usp || []).join('');
          tokens.forEach(w => { if (hay.indexOf(w) >= 0) s += 2; });
          if (budget) {
            const pm = String(c.price || '').match(/(\d+(?:\.\d+)?)/);
            if (pm && Math.abs(parseFloat(pm[1]) - budget) <= budget * 0.3) s += 3;
          }
          if (s > 0) hits.push({ n: c.name, s });
        });
      }
      if (section !== 'cars') {
        techs.forEach(t => {
          let s = 0;
          const hay = (t.title || '') + (t.company || '') + (t.point || '');
          tokens.forEach(w => { if (hay.indexOf(w) >= 0) s += 2; });
          if (s > 0) hits.push({ n: t.title, s });
        });
      }
      hits.sort((a, b) => b.s - a.s);
      return {
        pool: `车型${cars.length}款 · 技术${techs.length}项 · 信号${sgs.length}条`,
        tokens, hits: hits.slice(0, 6).map(x => x.n),
      };
    }

    function mount(section) {
      const bar = document.querySelector(`.ai-ask[data-ask="${section}"]`);
      if (!bar) return;
      const input = bar.querySelector('[data-askinput]');
      const btn = bar.querySelector('[data-askbtn]');
      const gapBtn = bar.querySelector('[data-askgap]');
      const resp = bar.querySelector('.ai-ask-resp');
      const submit = async () => {
        const q = input.value.trim();
        if (!q) return;
        input.value = '';
        input.disabled = true; btn.disabled = true; if (gapBtn) gapBtn.disabled = true;
        // —— 检索过程可视化 ——
        const tr = matchTrace(section, q);
        const card = document.createElement('div');
        card.className = 'ai-ask-card';
        card.innerHTML = `<div class="ai-ask-q">问：${esc(q)}</div>
          <div class="ai-trace">
            <div>📥 <b>数据池</b>：本月报 ${esc(tr.pool)}</div>
            <div>🎯 <b>关键词</b>：${tr.tokens.length ? esc(tr.tokens.join('、')) : '（无明确关键词）'}${tr.hits.length ? ' → <b>命中</b>：' + esc(tr.hits.join('、')) : ' → 无直接命中，按全池分析'}</div>
            <div>📤 <b>提交生成</b>：上下文已组装，等待大模型响应<span data-trstep></span></div>
          </div>
          <div class="ai-ask-a"></div>`;
        resp.prepend(card);
        const body = card.querySelector('.ai-ask-a');
        const stopT = aiLoading(body, '正在生成本月报解读…');
        let acc = '', first = true;
        try {
          await LarkAI.chat(buildPrompt(section, q), null, d => {
            if (first) { first = false; stopT(); body.innerHTML = '<span class="ai-ask-cursor">▌</span>'; }
            acc += d;
            body.innerHTML = esc(acc) + '<span class="ai-ask-cursor">▌</span>';
          });
          stopT();
          body.innerHTML = esc(acc);
          (hist[section] = hist[section] || []).push({ q, a: acc });
          if (hist[section].length > 5) hist[section].shift();
        } catch (e) {
          stopT();
          body.classList.add('ai-err');
          body.textContent = '调用失败：' + e.message;
        }
        input.disabled = false; btn.disabled = false; if (gapBtn) gapBtn.disabled = false; input.focus();
      };
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      if (gapBtn) gapBtn.addEventListener('click', () => {
        input.value = `对照您掌握的公开信息，${month()}还有哪些已上市/预售新车或发布的零部件新技术可能不在上述清单中？请列出名称、信息来源线索，并逐条标注"待核实"（不纳入正式结论）。`;
        submit();
      });
    }
    return { html, mount };
  })();

  // 深度解读交互：按钮仅展开输入框，用户发送问题后才调用大模型
  async function startDeep(carId, hostEl) {
    if (!LarkAI.enabled()) {
      const off = hostEl.querySelector('[data-chat]') || hostEl;
      off.innerHTML = `<div class="lark-off">
        <div class="lark-off-t">🤖 AI 深度解读未启用</div>
        <div class="lark-off-d">本地引擎的定位评分与对比结论可直接使用。启用大模型在线解读：项目根目录放置 ai_config.json（api_key+model），用 <b>python serve.py</b> 启动本机服务（8765）即可，密钥不进入前端与git。</div>
      </div>`;
      return;
    }
    const pool = buildPool();
    const d = pool.find(x => x.id === carId);
    const r = evaluate(d, pool);
    const chat = hostEl.querySelector('[data-chat]') || hostEl;
    const basePrompt = LarkAI.promptCar(d, r, panelPreset);
    const sugs = ['这款车的核心优势和短板是什么？', '和同级竞品相比怎么选？', '用300字总结购买建议'];
    chat.innerHTML =
      '<div class="lark-chat">' +
      '<div class="lc-msg lc-bot">已就绪。输入问题后点击「发送」即调用豆包大模型解读；未发送前不会产生任何调用。</div>' +
      '<div class="lc-sugs">' + sugs.map(s => `<span class="lc-sug" data-q="${esc(s)}">${esc(s)}</span>`).join('') + '</div>' +
      '</div>' +
      '<div class="lc-input"><input placeholder="例如：这款车最大的短板是什么？" data-chatinput><button data-actsend>发送</button></div>';
    const input = chat.querySelector('[data-chatinput]');
    let acc = '';
    const ask = async (q) => {
      const box = chat.querySelector('.lark-chat');
      box.insertAdjacentHTML('beforeend', `<div class="lc-msg lc-user">${esc(q)}</div>`);
      const bot = document.createElement('div');
      bot.className = 'lc-msg lc-bot'; bot.textContent = '正在调用豆包大模型解读';
      box.appendChild(bot);
      const stopT = aiLoading(bot, '正在调用豆包大模型解读');
      // 代理无会话状态：首次以本地评分结论为背景+用户提问；追问回带上轮解读
      const ctx = acc
        ? '【背景·车型结论】\n' + basePrompt.slice(0, 1400) + '\n\n【你的上轮解读】\n' + acc.slice(0, 1800) + '\n\n【用户追问】\n' + q
        : basePrompt + '\n\n【用户提问】\n' + q;
      let firstDelta = true, a2 = '';
      try {
        await LarkAI.chat(ctx, null, dlt => {
          if (firstDelta) { firstDelta = false; stopT(); }
          a2 += dlt; bot.textContent = a2;
        });
        acc = a2;
      } catch (e) {
        stopT(); bot.textContent = '调用失败：' + e.message + '。本地引擎结论仍可正常使用。';
      }
    };
    const send = () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      ask(q);
    };
    chat.querySelector('[data-actsend]').addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    chat.querySelectorAll('.lc-sug').forEach(el => {
      el.addEventListener('click', () => { input.value = el.getAttribute('data-q'); input.focus(); });
    });
    input.focus();
  }
  function startDeepCmp(hostEl) {
    if (!LarkAI.enabled()) {
      const chat = hostEl.querySelector('[data-chatcmp]');
      chat.innerHTML = '<div class="lark-off"><div class="lark-off-t">🤖 AI 深度解读未启用</div><div class="lark-off-d">需用 serve.py 启动本机服务并配置 ai_config.json。本地雷达、参数对比与结论可直接使用。</div></div>';
      return;
    }
    const pool = buildPool();
    const evals = cmpSel.map(id => pool.find(d => d.id === id)).filter(Boolean).map(d => evaluate(d, pool));
    const basePrompt = LarkAI.promptCompare(evals, cmpPreset);
    const chat = hostEl.querySelector('[data-chatcmp]');
    const sugs = ['这几款车应该怎么选？', '对比各自的核心优势与短板', '按预算和用途给出推荐'];
    chat.innerHTML =
      '<div class="lark-chat">' +
      '<div class="lc-msg lc-bot">已就绪。输入问题后点击「发送」即调用豆包大模型生成对比解读；未发送前不会产生任何调用。</div>' +
      '<div class="lc-sugs">' + sugs.map(s => `<span class="lc-sug" data-q="${esc(s)}">${esc(s)}</span>`).join('') + '</div>' +
      '</div>' +
      '<div class="lc-input"><input placeholder="例如：这几款车怎么选？" data-chatinput><button data-actsend>发送</button></div>';
    const input = chat.querySelector('[data-chatinput]');
    let acc = '';
    const ask = async (q) => {
      const box = chat.querySelector('.lark-chat');
      box.insertAdjacentHTML('beforeend', `<div class="lc-msg lc-user">${esc(q)}</div>`);
      const bot = document.createElement('div');
      bot.className = 'lc-msg lc-bot'; bot.textContent = '正在调用豆包大模型生成对比解读';
      box.appendChild(bot);
      const stopT = aiLoading(bot, '正在调用豆包大模型生成对比解读');
      const ctx = acc
        ? '【背景·对比结论】\n' + basePrompt.slice(0, 1400) + '\n\n【你的上轮解读】\n' + acc.slice(0, 1800) + '\n\n【用户追问】\n' + q
        : basePrompt + '\n\n【用户提问】\n' + q;
      let firstD = true, a2 = '';
      try {
        await LarkAI.chat(ctx, null, d => {
          if (firstD) { firstD = false; stopT(); }
          a2 += d; bot.textContent = a2;
        });
        acc = a2;
      } catch (e) { stopT(); bot.textContent = '调用失败：' + e.message; }
    };
    const send = () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      ask(q);
    };
    chat.querySelector('[data-actsend]').addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    chat.querySelectorAll('.lc-sug').forEach(el => {
      el.addEventListener('click', () => { input.value = el.getAttribute('data-q'); input.focus(); });
    });
    input.focus();
  }

  // 技术条目详情：搜索栏式自由提问（与板块问答栏一致；预分析静态部分由 data.js aiNote 承担）
  function mountTechAI(id) {
    if (!LarkAI.enabled()) return;
    const techs = (typeof TECHS !== 'undefined') ? (window._OT || TECHS) : [];
    const t = techs.find(x => x.id === id);
    const body = document.querySelector('#modalBox .body');
    if (!t || !body || body.querySelector('[data-techai-block]')) return;
    const blk = document.createElement('div');
    blk.className = 'tech-block';
    blk.setAttribute('data-techai-block', '1');
    blk.innerHTML = '<div class="tech-block-title">🤖 就该技术自由提问（豆包大模型 · 参考层不回写）</div>' +
      '<div class="ai-ask" style="margin:0"><div class="ai-ask-row">' +
      '<input class="ai-ask-input" placeholder="如：这项技术量产风险在哪？我方要不要跟进？" data-techq>' +
      '<button class="ai-ask-btn" data-techq-btn>提问</button></div>' +
      '<div class="ai-ask-resp"></div></div>';
    body.appendChild(blk);
    const input = blk.querySelector('[data-techq]');
    const btn = blk.querySelector('[data-techq-btn]');
    const resp = blk.querySelector('.ai-ask-resp');
    let lastQA = null;
    const submit = async () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = ''; input.disabled = true; btn.disabled = true;
      const card = document.createElement('div');
      card.className = 'ai-ask-card';
      card.innerHTML = `<div class="ai-ask-q">问：${esc(q)}</div><div class="ai-ask-a"></div>`;
      resp.prepend(card);
      const el = card.querySelector('.ai-ask-a');
      const stopT = aiLoading(el, '正在生成回答…');
      const m = (typeof REPORT_MONTH !== 'undefined') ? REPORT_MONTH : '';
      let prompt = `你是汽车整车性能集成专家。围绕${m}竞品月报中这条已核实技术条目回答用户问题：\n\n` +
        `【标题】${t.title || ''}\n【企业/主体】${t.company || ''}\n【日期】${t.date || ''}\n` +
        `【技术概述】${t.point || ''}\n【影响评估】${t.impactNote || ''}\n【来源口径】${t.src || ''}\n` +
        (t.aiNote ? `【月报预分析】${t.aiNote}\n` : '') +
        (lastQA ? `\n【上一轮问答】问：${lastQA.q}\n答（节选）：${lastQA.a.slice(0, 600)}\n` : '') +
        `\n【用户问题】${q}\n\n仅依据给定条目内容回答，不得编造参数；条目未涉及的明确说明"该条目未覆盖"。400字内，结构化要点。`;
      let acc = '', first = true;
      try {
        await LarkAI.chat(prompt, null, d => {
          if (first) { first = false; stopT(); }
          acc += d; el.textContent = acc;
        });
        stopT(); el.textContent = acc;
        lastQA = { q, a: acc };
      } catch (e) {
        stopT(); el.textContent = '调用失败：' + e.message; el.classList.add('ai-err');
      }
      input.disabled = false; btn.disabled = false; input.focus();
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  /* ================= 八、外壳注入与事件委托 ================= */
  function injectShell() {
    const bar = document.createElement('div');
    bar.className = 'ai-cmp-bar hidden';
    bar.id = 'aiCmpBar';
    bar.innerHTML = `
      <div class="cmp-bar-l">
        <span class="cmp-bar-t">AI 对比篮</span>
        <div class="cmp-chips" id="aiCmpChips"></div>
      </div>
      <div class="cmp-bar-r">
        <span class="cmp-bar-tip" id="aiCmpTip"></span>
        <button class="aip-btn" data-act="opencmp" id="aiCmpGo">开始 AI 对比</button>
        <button class="aip-btn aip-btn-ghost" data-act="clearcmp">清空</button>
      </div>`;
    document.body.appendChild(bar);

    const mask = document.createElement('div');
    mask.className = 'modal-mask ai-cmp-mask hidden';
    mask.id = 'aiCmpMask';
    mask.innerHTML = '<div class="ai-cmp-modal" id="aiCmpBox"></div>';
    document.body.appendChild(mask);
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    const id = t.getAttribute('data-id');
    if (act === 'togglecmp') toggleCmp(id);
    else if (act === 'remove') { toggleCmp(id); renderCmpModalBody(); }
    else if (act === 'clearcmp') { cmpSel.length = 0; renderCmpBar(); renderCmpModalBody(); }
    else if (act === 'opencmp') openCmpModal();
    else if (act === 'closecmp') closeCmpModal();
    else if (act === 'pick') {
      const pid = t.getAttribute('data-pickid');
      if (!cmpSel.includes(pid) && cmpSel.length >= 4) { alertCmp('最多同时对比 4 款车型'); return; }
      toggleCmp(pid);
      renderCmpModalBody();
    } else if (act === 'preset') {
      const panel = t.closest('.ai-panel');
      const pid = panel && panel.getAttribute('data-car');
      const pk = t.getAttribute('data-preset');
      if (pid && PRESETS[pk]) rerenderPanel(pid, pk);
    } else if (act === 'cmppreset') {
      const pk = t.getAttribute('data-preset');
      if (PRESETS[pk]) { cmpPreset = pk; renderCmpModalBody(); }
    } else if (act === 'deep') {
      const panel = t.closest('.ai-panel');
      startDeep(id, panel);
    } else if (act === 'deepcmp') {
      startDeepCmp(document.getElementById('aiCmpBox'));
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const m = document.getElementById('aiCmpMask');
      if (m && !m.classList.contains('hidden')) closeCmpModal();
    }
  });
  // 挂载 AI 面板：包装卡片点击入口（内联 onclick 走 window 全局查找，包装可拦截）
  function hookEntries() {
    if (window.__AI_HOOKED__) return;
    ['onCardClick', 'editDetail'].forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function') return;
      window[fn] = function (e, kind, id) {
        const ret = orig.apply(this, arguments);
        if (id && !document.getElementById('modalMask').classList.contains('hidden')) {
          // 原处理器内同步完成弹窗渲染，返回后挂载：车型→能力分面板；技术→AI解读块（编辑模式不触发）
          try {
            const editing = (typeof state !== 'undefined' && state.editMode);
            if (kind === 'tech') { if (!editing) mountTechAI(id); }
            else mountPanel(id);
          } catch (err) { console.error('[AI面板]', err); }
        }
        return ret;
      };
    });
    window.__AI_HOOKED__ = true;
  }

  window.AIAnalysis = {
    evaluateById(id) { const d = buildPool().find(x => x.id === id); return d ? evaluate(d) : null; },
    openCmpModal, toggleCmp, AIAsk,
  };

  injectShell();
  // 点击遮罩关闭对比弹窗
  document.getElementById('aiCmpMask').addEventListener('click', e => { if (e.target.id === 'aiCmpMask') closeCmpModal(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookEntries);
  else hookEntries();
  // analysis.js 在 app.js 之后加载：首屏render时AIAsk尚不存在，补一次重渲染挂载问答栏
  if (LarkAI.enabled() && typeof render === 'function') {
    try { render(); } catch (e) { console.error('[AI问答栏重渲染]', e); }
  }
})();
