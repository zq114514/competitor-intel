/* ============================================================
 * cmp.js  竞品对比板块（A→C纵切：全池索引 / 项目设定 / 匹配推荐 / 人工改选）
 * 口径与规则见《特性维度标注准则》§5（竞品对比）
 * 依赖全局：MONTHLY_POOL / loadMonthDataset / COMP_CARS / SPEC_GROUPS /
 *           DOMAINS / DOMAIN_GROUPS / specVal / uspCardHTML / $app / bindCommon
 * ============================================================ */
(function () {
  'use strict';
  const LS_KEY = 'cmp_projects_v1';

  /* ---------- 维度关键词表（用于无 dims 车型的文本回退匹配，26维） ---------- */
  const DOMAIN_KW = {
    styling: ['造型', '设计', '外观', '风阻', '美学', '颜值'],
    perceived: ['质感', '用料', '豪华', '品质', '工艺', '高级感'],
    hmi: ['人机', '语音', '交互', '手势控制', '物理按键'],
    airquality: ['空气', 'pm2.5', '负离子', '香氛', '新风'],
    thermal: ['空调', '热泵', '热管理', '座椅通风', '座椅加热', '采暖', '制冷'],
    seat: ['零重力', '座椅', '按摩', '腿托', '腰托'],
    nvh: ['nvh', '静谧', '隔音', '噪声', '降噪', '风噪'],
    power: ['零百', '加速', '功率', '扭矩', '动力', '米勒循环', '发动机'],
    handling: ['操控', '底盘', '悬架', '悬挂', '云辇', '转向', '操稳', 'cdc', '侧向'],
    offroad: ['越野', '四驱', '差速锁', '锁', '涉水', '攀爬', '非承载', '坦克调头', '蠕行'],
    safeprevent: ['主动安全', 'aeb', '预警', '监控预防', '盲区', '车道保持'],
    crash: ['碰撞', '车身刚度', '热成型', 'mpa', '气囊', '安全架构', 'omdb'],
    antitheft: ['防盗', '防灾', '报警'],
    energy: ['续航', '能耗', '电耗', '油耗', 'cltc', '能量密度', '电池'],
    charging: ['快充', '超充', '充电', '5c', '800v', '补能', '放电', '闪充'],
    cost: ['用车成本', '保养', '质保', '保值', '养护'],
    interaction: ['座舱', '座舱芯片', '操作系统', 'vla', '大模型', 'hud', '车机'],
    infotainment: ['音响', '扬声器', '屏幕', '娱乐', '互联', '投屏', '全景声'],
    adas: ['智驾', '智能驾驶', '领航', 'noa', 'nca', '辅助驾驶', 'l2', '自动驾驶', '激光雷达'],
    durability: ['耐久', '寿命', '可靠性', '15年', '长效'],
    waterproof: ['防水', '防尘', '密封', 'ip6'],
    weathering: ['耐候', '高低温', '老化', '紫外线', '寒区'],
    corrosion: ['防腐', '锈蚀', '镀锌', '盐雾'],
    emc: ['电磁兼容', 'emc', '电磁辐射'],
    emissions: ['排放', '挥发', 'voc', '环保材料', '低碳'],
    recycle: ['回收', '再循环', '可回收', '再生材料']
  };

  /* ---------- 基础归一化 ---------- */
  const LEVEL_RANK = { '微型': 0, '小型': 1, '紧凑': 2, '中型': 3, '中大型': 4, '大型': 5 };
  // 顺序敏感：中大型必须先于中型
  const LEVEL_PATTERNS = ['中大型', '大型', '中型', '紧凑', '小型', '微型'];

  function normLevel(seg) {
    if (!seg) return null;
    if (/大六座|大四座/.test(seg)) return '大型';
    for (const lv of LEVEL_PATTERNS) if (seg.includes(lv)) return lv;
    return null;
  }
  function normBody(seg) {
    if (!seg) return null;
    if (/MPV/i.test(seg)) return 'mpv';
    if (/皮卡/.test(seg)) return 'pickup';
    if (/SUV/i.test(seg)) return 'suv';
    if (/轿跑|轿车|掀背|车/.test(seg)) return 'sedan';
    return null;
  }
  const BODY_NAME = { suv: 'SUV', sedan: '轿车', mpv: 'MPV', pickup: '皮卡' };

  // 能源标签：ev=纯电 erev=增程 phev=插混 icev=燃油
  function normEnergy(power, specText) {
    const s = (power || '') + ' ' + (specText || '');
    const tags = [];
    if (/纯电/.test(s)) tags.push('ev');
    if (/增程/.test(s)) tags.push('erev');
    if (/插混|插电|DM|混动/.test(s)) tags.push('phev');
    if (/燃油|汽油|柴油/.test(s) && !/新能源/.test(s)) tags.push('icev');
    return Array.from(new Set(tags));
  }
  const ENERGY_NAME = { ev: '纯电', erev: '增程', phev: '插混', icev: '燃油' };
  // 兼容组：增程↔插混可互比；纯电、燃油各自独立
  const ENERGY_GROUP = { ev: 'G_EV', erev: 'G_X', phev: 'G_X', icev: 'G_ICE' };

  // 价格解析：返回 {min,max,raw}，剔除 BaaS/限时价；单位万元
  function parsePrice(str) {
    if (str == null) return null;
    const s = String(str);
    // 按斜杠分段（BaaS / DM-i/EV / 限时价通常在斜杠另一侧）
    const segs = s.split(/[/／]/);
    const candidates = segs.filter(x => !/BaaS|电池租用/i.test(x));
    const pool = (candidates.length ? candidates.join(' ') : s);
    const re = /(\d+\.?\d*)\s*万/g;
    const nums = [];
    let m;
    while ((m = re.exec(pool)) !== null) {
      const around = pool.slice(Math.max(0, m.index - 6), m.index);
      if (/限时|权益/.test(around)) continue; // 限时/权益价不取
      nums.push(parseFloat(m[1]));
    }
    if (!nums.length) return null;
    return { min: Math.min(...nums), max: Math.max(...nums), raw: s.trim() };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  /* ---------- A：全池去重索引 ---------- */
  let _poolPromise = null;
  function buildPool() {
    if (_poolPromise) return _poolPromise;
    _poolPromise = (async () => {
      const months = (typeof MONTHLY_POOL !== 'undefined' ? MONTHLY_POOL : []);
      const map = new Map();
      for (const m of months) {
        let ds;
        try { ds = await loadMonthDataset(m.month); } catch (e) { continue; }
        for (const car of (ds.CARS || [])) {
          const exist = map.get(car.id);
          // 同id取最新月份（MONTHLY_POOL顺序即新→旧）
          if (!exist || monthOrder(m.month) > monthOrder(exist.__monthOrder)) {
            map.set(car.id, { ...car, __month: m.month, __monthLabel: m.label, __src: 'month', __monthOrder: monthOrder(m.month) });
          }
        }
      }
      // 并入老竞品库（curated，无 dims 走关键词回退）
      const comps = (typeof COMP_CARS !== 'undefined' ? COMP_CARS : []);
      for (const c of comps) {
        if (!map.has(c.id)) {
          map.set(c.id, {
            id: c.id, name: c.name, brand: c.brand, seg: c.seg || (c.specs && c.specs['级别']),
            power: (c.specs && c.specs['能源类型']) || '', launchDate: (c.specs && c.specs['上市时间']) || '',
            price: c.specs && c.specs['售价 万'] ? c.specs['售价 万'] + '万' : '',
            img: c.img, usp: [], dims: [], dimPoints: {}, specs: c.specs, uspGroups: c.uspGroups,
            caliber: c.caliber, __month: '竞品库', __monthLabel: 'DH7竞品库', __src: 'library'
          });
        }
      }
      // 统一归一化字段
      for (const c of map.values()) {
        c.__price = parsePrice(c.price);
        c.__body = normBody(c.seg);
        c.__level = normLevel(c.seg);
        c.__levelRank = c.__level ? LEVEL_RANK[c.__level] : null;
        c.__energy = normEnergy(c.power, c.specs && (c.specs['能源类型'] || c.specs['能源']));
        c.__dims = inferDims(c);
      }
      return Array.from(map.values());
    })();
    return _poolPromise;
  }
  function monthOrder(ym) {
    const [y, mo] = String(ym).split('-').map(Number);
    return y * 12 + mo;
  }

  // 车型维度集合：有官方dims用官方；老竞品库走文本关键词推断
  function inferDims(c) {
    if (Array.isArray(c.dims) && c.dims.length) return c.dims.slice();
    const text = carText(c).toLowerCase();
    const set = [];
    for (const [dim, kws] of Object.entries(DOMAIN_KW)) {
      if (kws.some(k => text.includes(k.toLowerCase()))) set.push(dim);
    }
    return set;
  }
  function carText(c) {
    const parts = [c.name, c.brand, c.seg];
    if (Array.isArray(c.usp)) parts.push(...c.usp);
    if (c.dimPoints) {
      for (const k of Object.keys(c.dimPoints)) {
        const dp = c.dimPoints[k];
        if (!dp) continue;
        parts.push(dp.s || '');
        if (Array.isArray(dp.d)) parts.push(...dp.d);
      }
    }
    if (Array.isArray(c.uspGroups)) {
      for (const g of c.uspGroups) { parts.push(g.group || ''); (g.items || []).forEach(i => parts.push(i.t || '', i.d || '')); }
    }
    return parts.filter(Boolean).join(' ');
  }

  /* ---------- 项目存储 ---------- */
  function loadProjects() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (Array.isArray(arr)) return arr;
    } catch (e) { /* 损坏则重新种子 */ }
    return seedProjects();
  }
  function saveProjects(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)); }
  // 首次使用：把硬编码DH7项目迁入本地（保持既有竞品名单；区间取自原segment描述，可编辑）
  function seedProjects() {
    const seeds = [];
    if (typeof PROJECTS !== 'undefined') {
      const meta = { p1: { body: 'sedan', level: '紧凑', min: 10, max: 22 }, p2: { body: 'sedan', level: '紧凑', min: 10, max: 15 } };
      for (const p of PROJECTS) {
        const mt = meta[p.id] || { body: 'sedan', level: '紧凑', min: null, max: null };
        seeds.push({
          id: p.id, code: p.code, name: p.name,
          body: mt.body, level: mt.level,
          energyTags: ['ev'], allowCrossEnergy: false,
          priceMin: mt.min, priceMax: mt.max,
          coreDims: [], coreText: '', normalDims: [], normalText: '',
          autoMatched: false,
          picks: (p.competitors || []).map(id => ({ id, tier: 'same', auto: false })),
          createdAt: Date.now()
        });
      }
      saveProjects(seeds);
    }
    return seeds;
  }

  /* ---------- C：硬过滤 + 打分 + 分组 ---------- */
  const W = { sell: 50, price: 25, level: 15, fresh: 10 };

  function energyOk(proj, c) {
    if (proj.allowCrossEnergy) return true;
    const pgs = new Set((proj.energyTags || []).map(t => ENERGY_GROUP[t]));
    return c.__energy.some(t => pgs.has(ENERGY_GROUP[t]));
  }

  function scoreSell(proj, c) {
    const core = proj.coreDims || [];
    const normal = proj.normalDims || [];
    const totalW = core.length * 2 + normal.length;
    if (!totalW) return { score: 0, hits: [] };
    const text = carText(c).toLowerCase();
    let got = 0;
    const hits = [];
    const testDim = (dim, weight, tier) => {
      let how = '';
      if (c.__dims.includes(dim)) how = c.__src === 'library' ? '关键词推断' : '官方维度标注';
      else {
        const kws = DOMAIN_KW[dim] || [];
        if (kws.some(k => text.includes(k.toLowerCase()))) how = '卖点文本命中';
      }
      if (how) { got += weight; hits.push({ dim, weight, tier, how }); }
    };
    core.forEach(d => testDim(d, 2, 'core'));
    normal.forEach(d => testDim(d, 1, 'normal'));
    return { score: Math.round(got / totalW * W.sell), hits };
  }

  function scorePrice(proj, c) {
    if (proj.priceMin == null || proj.priceMax == null || !c.__price) return { score: 0, gap: null, overlap: false };
    const p = { min: +proj.priceMin, max: +proj.priceMax };
    const q = c.__price;
    const lo = Math.max(p.min, q.min), hi = Math.min(p.max, q.max);
    if (lo <= hi) {
      const w = Math.min(p.max - p.min, q.max - q.min) || 1;
      const ratio = Math.min(1, (hi - lo) / w + 0.35); // 部分重叠也给基础分
      return { score: Math.round(W.price * Math.min(1, ratio + 0.25)), gap: 0, overlap: true };
    }
    const gap = q.min > p.max ? q.min - p.max : p.min - q.max;
    const ratio = Math.max(0, 1 - gap / 10); // 价差10万归零
    return { score: Math.round(W.price * ratio), gap, overlap: false };
  }

  function scoreLevel(proj, c) {
    const pr = LEVEL_RANK[proj.level];
    if (pr == null || c.__levelRank == null) return { score: 6, diff: null }; // 级别缺失给中位分，不硬罚
    const diff = Math.abs(c.__levelRank - pr);
    return { score: diff === 0 ? 15 : diff === 1 ? 8 : 0, diff };
  }

  function scoreFresh(c) {
    const ref = monthOrder('2026-09');
    let months = null;
    const m = /(20\d{2})[-./年](\d{1,2})/.exec(c.launchDate || '');
    if (m) months = ref - (+m[1] * 12 + +m[2]);
    if (months == null) return 5;
    if (months <= 3) return 10;
    if (months <= 6) return 8;
    if (months <= 12) return 6;
    if (months <= 18) return 4;
    return 2;
  }

  function scoreCar(proj, c) {
    const sell = scoreSell(proj, c);
    const price = scorePrice(proj, c);
    const level = scoreLevel(proj, c);
    const fresh = scoreFresh(c);
    return {
      total: sell.score + price.score + level.score + fresh,
      parts: { sell: sell.score, price: price.score, level: level.score, fresh },
      hits: sell.hits, priceGap: price.gap, priceOverlap: price.overlap, levelDiff: level.diff
    };
  }

  function recommend(proj, pool) {
    const filtered = [];
    for (const c of pool) {
      if (proj.body && c.__body && c.__body !== proj.body) continue;
      if (!energyOk(proj, c)) continue;
      filtered.push(c);
    }
    const ranked = filtered.map(c => ({ c, s: scoreCar(proj, c) }))
      .sort((a, b) => b.s.total - a.s.total);

    // 先选越级（符合条件中的最高分1款）
    const pr = LEVEL_RANK[proj.level];
    const upperCand = ranked.filter(item => {
      const { c, s } = item;
      if (!s.hits.some(h => h.tier === 'core')) return false;
      const levelUpper = pr != null && c.__levelRank === pr + 1;
      let priceUpper = false;
      if (proj.priceMax != null && c.__price) {
        priceUpper = c.__price.min >= +proj.priceMax * 1.2 && c.__price.min <= +proj.priceMax * 1.6;
      }
      return levelUpper || priceUpper;
    });
    const upper = upperCand.slice(0, 1);
    const upperIds = new Set(upper.map(i => i.c.id));

    // 同级：价格重叠/接近 且 级别差≤1；未抢到越级席位的车（如高一级但价格重叠）回归同级竞争
    const same = ranked.filter(item => {
      if (upperIds.has(item.c.id)) return false;
      const { c, s } = item;
      const priceClose = proj.priceMax == null || !c.__price ||
        s.priceOverlap || (s.priceGap != null && s.priceGap <= Math.max(2, +proj.priceMax * 0.1));
      const levelClose = s.levelDiff == null || s.levelDiff <= 1;
      return priceClose && levelClose;
    }).slice(0, 4);

    return { same, upper, allRanked: ranked.slice(0, 12) };
  }

  /* ---------- UI ---------- */
  const ui = { curProjectId: null, view: 'list', formIsNew: false, pool: [], rec: null, recLevel: null, busy: false };

  let delegationReady = false;
  async function render() {
    if (!delegationReady) { initDelegation(); delegationReady = true; }
    const projects = loadProjects();
    if (!ui.pool.length && !ui.busy) {
      ui.busy = true;
      ui.pool = await buildPool();
      ui.busy = false;
    } else if (ui.busy) {
      paintSkeleton(projects);
      return;
    }
    if (ui.view === 'edit' && ui.formIsNew) {
      paintForm(null, projects);
    } else {
      if (!ui.curProjectId || !projects.find(p => p.id === ui.curProjectId)) {
        ui.curProjectId = projects[0] ? projects[0].id : null;
      }
      if (!projects.length) { paintEmpty(); if (typeof bindCommon === 'function') bindCommon(); return; }
      const proj = projects.find(p => p.id === ui.curProjectId);
      if (ui.view === 'edit') paintForm(proj, projects);
      else paintProject(proj, projects);
    }
    if (typeof bindCommon === 'function') bindCommon();
  }

  function header(projects) {
    return `
    <h1 class="page-title">竞品对比 · 按项目</h1>
    <p class="page-sub">设定项目的核心卖点/一般卖点/售价/级别/能源后，系统从近4个月月报车型池（${ui.pool.length || '…'}款，已去重）按 卖点匹配50% → 价格25% → 级别15% → 新鲜度10% 推荐同级2-4款＋越级1款；可人工改选。入选车在出报告前需经现核（见准则§5）。</p>
    <div class="project-bar cmp-bar">
      <label>选择项目：</label>
      <select id="cmpProjectSelect">
        ${projects.map(p => `<option value="${esc(p.id)}"${p.id === ui.curProjectId ? ' selected' : ''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}
      </select>
      <span class="chip cmp-act" id="cmpNewBtn">＋ 新建项目</span>
      <span class="chip cmp-act" id="cmpEditBtn">✎ 编辑</span>
      <span class="chip cmp-act" id="cmpExportBtn">⇩ 导出JSON</span>
      <span class="chip cmp-act" id="cmpImportBtn">⇧ 导入JSON</span>
      <input type="file" id="cmpImportFile" accept="application/json" style="display:none">
      <span class="chip cmp-act danger" id="cmpDelBtn">删除项目</span>
    </div>`;
  }

  function paintSkeleton(projects) {
    $app.innerHTML = header(projects) + `<div class="cmp-loading">正在加载近4个月月报车型池…</div>`;
    setTimeout(render, 400);
    bindBar();
  }
  function paintEmpty() {
    $app.innerHTML = `
    <h1 class="page-title">竞品对比 · 按项目</h1>
    <div class="cmp-empty">
      <p>还没有项目。点击新建，录入项目名称、售价区间与核心卖点。</p>
      <span class="chip cmp-act big" id="cmpNewBtn">＋ 新建第一个项目</span>
    </div>`;
    bindBar();
  }

  function paintProject(proj, projects) {
    const picked = (proj.picks || []).map(k => ({ ...k, car: ui.pool.find(c => c.id === k.id) })).filter(k => k.car);
    const same = picked.filter(k => k.tier !== 'upper');
    const upper = picked.filter(k => k.tier === 'upper');

    $app.innerHTML = header(projects) + `
    <div class="cmp-proj-meta">
      <div><b>${esc(proj.name)}</b>（${esc(proj.code)}）</div>
      <div class="cmp-tags">
        ${tag(BODY_NAME[proj.body] || '—')}
        ${tag((proj.level || '') + '级')}
        ${(proj.energyTags || []).map(t => tag(ENERGY_NAME[t])).join('')}
        ${proj.priceMin != null ? tag(proj.priceMin + '–' + proj.priceMax + '万') : tag('售价待定')}
        ${proj.allowCrossEnergy ? tag('允许跨能源') : ''}
      </div>
      <div class="cmp-dims">
        <span class="cmp-dim-lab">核心卖点：</span>${dimChips(proj.coreDims, proj.coreText)}
      </div>
      <div class="cmp-dims">
        <span class="cmp-dim-lab">一般卖点：</span>${dimChips(proj.normalDims, proj.normalText)}
      </div>
      <div class="cmp-run">
        <span class="chip cmp-act primary" id="cmpRunBtn">⟳ 运行/重算匹配</span>
        ${proj.autoMatched ? '<span class="cmp-hint">已自动匹配，可在下方移除/换级/手动补选</span>' : '<span class="cmp-hint">尚未运行自动匹配（当前为手动名单）</span>'}
      </div>
    </div>

    <div class="section-title">推荐结果${ui.rec ? `（同级候选 ${ui.rec.same.length} · 越级候选 ${ui.rec.upper.length}，建议同级2-4款、越级1款）` : '（点击"运行/重算匹配"生成）'}</div>
    <div id="cmpResultSlot"></div>

    <div class="cmp-picked">
      <div class="section-title">已选竞品（${picked.length}款）</div>
      ${picked.length ? pickedListHTML(same, upper) : '<div class="cmp-hint">尚未选择竞品，点击"运行匹配"获取推荐。</div>'}
    </div>

    ${picked.length ? comparisonHTML(proj, picked) : ''}
    `;
    bindBar();
    bindProject(proj);
    if (ui.rec) paintRec(proj);
  }

  function tag(t, cls) { return t ? `<span class="chip ${cls || ''}">${esc(t)}</span>` : ''; }
  function dimChips(keys, text) {
    const chips = (keys || []).map(k => {
      const d = DOMAINS.find(x => x.key === k);
      return `<span class="chip cmp-dim-chip">${esc(d ? d.name : k)}</span>`;
    }).join('');
    return chips + (text ? `<span class="cmp-free-text">${esc(text)}</span>` : '<span class="cmp-hint">（未设定）</span>');
  }

  function pickedListHTML(same, upper) {
    const row = (k) => {
      const c = k.car;
      return `<tr>
        <td><span class="tier-badge ${k.tier}">${k.tier === 'upper' ? '越级' : '同级'}</span></td>
        <td>${esc(c.name)}<br><small>${esc(c.brand)} ｜ ${esc(c.__monthLabel)}</small></td>
        <td>${c.__price ? c.__price.min + (c.__price.max !== c.__price.min ? '–' + c.__price.max : '') + '万' : '—'}</td>
        <td>${esc([c.__level, BODY_NAME[c.__body]].filter(Boolean).join(' '))}</td>
        <td>${c.__energy.map(t => ENERGY_NAME[t]).join('/')}</td>
        <td class="cmp-row-acts">
          <span class="chip cmp-act" data-act="tier" data-id="${esc(c.id)}">${k.tier === 'upper' ? '降为同级' : '设为越级'}</span>
          <span class="chip cmp-act danger" data-act="drop" data-id="${esc(c.id)}">移除</span>
        </td>
      </tr>`;
    };
    return `<table class="cmp-pick-tbl"><thead><tr><th>层级</th><th>车型</th><th>指导价</th><th>级别</th><th>能源</th><th>操作</th></tr></thead>
      <tbody>${upper.map(row).join('')}${same.map(row).join('')}</tbody></table>`;
  }

  function comparisonHTML(proj, picked) {
    const comps = picked.map(k => k.car);
    const tierOf = Object.fromEntries(picked.map(k => [k.car.id, k.tier]));
    return `
    <div class="section-title">配置横向对比</div>
    <div class="cmp-table-wrap">
      <table class="cmp">
        <thead><tr>
          <th style="width:130px">对比维度</th>
          <th class="self-col">本司项目（${esc(proj.code)}）</th>
          ${comps.map(c => `<th><span class="tier-badge ${tierOf[c.id]}">${tierOf[c.id] === 'upper' ? '越级' : '同级'}</span> ${esc(c.name)}<br><small>${c.__price ? c.__price.min + (c.__price.max !== c.__price.min ? '-' + c.__price.max : '') + '万' : ''} ｜ ${esc(c.launchDate || '')}</small></th>`).join('')}
        </tr></thead>
        <tbody>
          ${SPEC_GROUPS.map((g, gi) => {
            const visRows = g.rows.filter(([, key, flag]) => !flag || comps.some(c => specVal(c, key)));
            return `
            <tr class="group-row">
              <td colspan="${comps.length + 2}">▾ ${g.name}<span class="g-count">（${visRows.length}项）</span></td>
            </tr>
            ${visRows.map(([label, key]) => `
              <tr class="g-row">
                <th>${esc(label)}</th>
                <td class="self-col">待定</td>
                ${comps.map(c => `<td>${esc(specVal(c, key) || '—')}</td>`).join('')}
              </tr>`).join('')}`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="page-sub" style="margin-top:10px">注：参数来自月报池归档数据（表头标注归档月份）；正式报告前入选车需走现核（官网/汽车之家现爬diff，准则§5.3）；"待定"为本司项目参数（E期接入项目表单）。</p>`;
  }

  function paintRec(proj) {
    const slot = document.getElementById('cmpResultSlot');
    if (!slot) return;
    const pickedIds = new Set((proj.picks || []).map(k => k.id));
    const card = (item, tier) => {
      const { c, s } = item;
      const hitDims = s.hits.map(h => {
        const d = DOMAINS.find(x => x.key === h.dim);
        return `<span class="chip hit-${h.tier}" title="${esc(h.how)}">${h.tier === 'core' ? '★' : '○'} ${esc(d ? d.name : h.dim)}</span>`;
      }).join('');
      return `<div class="cmp-rec-card">
        <div class="cmp-rec-top">
          <span class="tier-badge ${tier}">${tier === 'upper' ? '越级' : '同级'}</span>
          <b>${esc(c.name)}</b>
          <span class="cmp-score">${s.total}<small>/100</small></span>
          ${pickedIds.has(c.id) ? '<span class="chip">已选</span>' : `<span class="chip cmp-act primary" data-act="add" data-id="${esc(c.id)}" data-tier="${tier}">＋ 选入</span>`}
        </div>
        <div class="cmp-rec-sub">${esc(c.brand)} ｜ ${esc(c.__monthLabel)}归档 ｜ ${c.__price ? c.__price.min + (c.__price.max !== c.__price.min ? '–' + c.__price.max : '') + '万' : '价格待补'} ｜ ${esc(c.__level || '级别待补')} ${esc(BODY_NAME[c.__body] || '')} ｜ ${c.__energy.map(t => ENERGY_NAME[t]).join('/')}</div>
        <div class="cmp-bars">
          ${bar('卖点', s.parts.sell, 50)}${bar('价格', s.parts.price, 25)}${bar('级别', s.parts.level, 15)}${bar('新鲜度', s.parts.fresh, 10)}
        </div>
        <div class="cmp-hits">${hitDims || '<span class="cmp-hint">无卖点命中</span>'}</div>
        <div class="cmp-reason">${reasonText(item, tier)}</div>
      </div>`;
    };
    const { same, upper, allRanked } = ui.rec;
    const pickedSet = new Set((proj.picks || []).map(k => k.id));
    const rest = allRanked.filter(r => !pickedSet.has(r.c.id) &&
      !same.some(s => s.c.id === r.c.id) && !upper.some(u => u.c.id === r.c.id)).slice(0, 5);
    slot.innerHTML = `
      ${upper.length ? `<div class="cmp-tier-title">越级竞品（1款）</div><div class="cmp-rec-grid">${upper.map(i => card(i, 'upper')).join('')}</div>` : '<div class="cmp-hint">未找到符合条件的越级竞品（需高一个级别或起售价高20-60%，且命中核心卖点）。</div>'}
      <div class="cmp-tier-title">同级竞品（${same.length}款，建议2-4款）</div>
      <div class="cmp-rec-grid">${same.map(i => card(i, 'same')).join('') || '<div class="cmp-hint">同级候选不足。</div>'}</div>
      ${rest.length ? `<details class="cmp-more"><summary>其他候选（${rest.length}款，分数较低，可手动补选）</summary><div class="cmp-rec-grid">${rest.map(i => card(i, 'same')).join('')}</div></details>` : ''}
      ${same.length + upper.length < 3 ? '<div class="cmp-warn">⚠ 自动候选不足3款：可放宽级别/能源开关或手动补选，请勿硬凑。</div>' : ''}
    `;
  }

  function bar(label, v, max) {
    return `<div class="cmp-bar"><span>${label}</span><div class="cmp-bar-track"><i style="width:${Math.round(v / max * 100)}%"></i></div><em>${v}</em></div>`;
  }
  function reasonText(item, tier) {
    const { c, s } = item;
    const parts = [];
    const coreHits = s.hits.filter(h => h.tier === 'core');
    const normHits = s.hits.filter(h => h.tier === 'normal');
    if (coreHits.length) {
      parts.push('命中核心卖点：' + coreHits.map(h => {
        const d = DOMAINS.find(x => x.key === h.dim);
        return (d ? d.name : h.dim) + '（' + h.how + '）';
      }).join('、'));
    }
    if (normHits.length) {
      parts.push('命中一般卖点' + normHits.length + '项');
    }
    if (s.priceOverlap) parts.push('售价区间与项目重叠');
    else if (s.priceGap != null) parts.push('与项目售价相差约' + s.priceGap.toFixed(1) + '万');
    if (s.levelDiff === 0) parts.push('同级别');
    else if (s.levelDiff === 1) parts.push('级别相差1档');
    if (tier === 'upper') {
      const pr = LEVEL_RANK[ui.recLevel];
      parts.unshift(c.__levelRank != null && pr != null && c.__levelRank === pr + 1 ? '高一个级别' : '起售价高20%以上');
    }
    return parts.length ? '入选理由：' + parts.join('；') : '';
  }

  /* ---------- 表单 ---------- */
  function paintForm(proj, projects) {
    const isNew = !proj;
    const p = proj || { id: 'p' + Date.now(), code: '', name: '', body: 'suv', level: '中型', energyTags: ['ev'], allowCrossEnergy: false, priceMin: null, priceMax: null, coreDims: [], coreText: '', normalDims: [], normalText: '', picks: [] };
    const dimPicker = (selId, selected, max) => `
      <div class="cmp-dimpick" id="${selId}" data-max="${max}">
        ${DOMAIN_GROUPS.map(g => {
          const ds = DOMAINS.filter(d => d.group === g.key);
          return `<div class="cmp-dimpick-g"><span class="cmp-dimpick-gn" style="color:${g.color}">${g.name}</span>${ds.map(d =>
            `<span class="chip cmp-dim-opt${selected.includes(d.key) ? ' on' : ''}" data-dim="${d.key}">${d.name}</span>`).join('')}</div>`;
        }).join('')}
      </div>`;
    $app.innerHTML = header(projects) + `
    <div class="cmp-form">
      <div class="cmp-form-title">${isNew ? '新建项目' : '编辑项目：' + esc(p.name)}</div>
      <div class="cmp-form-grid">
        <label>项目代号<input id="fCode" value="${esc(p.code)}" placeholder="如 DH7"></label>
        <label>项目名称<input id="fName" value="${esc(p.name)}" placeholder="如 DH7 紧凑型纯电轿车"></label>
        <label>车身形式
          <select id="fBody">${Object.entries(BODY_NAME).map(([k, v]) => `<option value="${k}"${p.body === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <label>尺寸级别
          <select id="fLevel">${Object.keys(LEVEL_RANK).map(lv => `<option value="${lv}"${p.level === lv ? ' selected' : ''}>${lv}</option>`).join('')}</select>
        </label>
        <label>售价下限（万元）<input id="fPmin" type="number" step="0.01" value="${p.priceMin ?? ''}"></label>
        <label>售价上限（万元）<input id="fPmax" type="number" step="0.01" value="${p.priceMax ?? ''}"></label>
      </div>
      <div class="cmp-frow"><b>能源形式</b>
        ${Object.entries(ENERGY_NAME).map(([k, v]) => `<label class="cmp-check"><input type="checkbox" class="fEnergy" value="${k}"${p.energyTags.includes(k) ? ' checked' : ''}>${v}</label>`).join('')}
        <label class="cmp-check"><input type="checkbox" id="fCross" ${p.allowCrossEnergy ? 'checked' : ''}>允许跨能源对比（默认不混）</label>
      </div>
      <div class="cmp-frow"><b>核心卖点（点选2-3项，权重2倍）</b>${dimPicker('pickCore', p.coreDims, 3)}</div>
      <label class="cmp-full">核心卖点文字补充（自由文本，用于关键词回退）<input id="fCoreText" value="${esc(p.coreText)}" placeholder="如 800V 5C超充、城市NOA全系标配"></label>
      <div class="cmp-frow"><b>一般卖点（点选3-5项，权重1倍）</b>${dimPicker('pickNormal', p.normalDims, 5)}</div>
      <label class="cmp-full">一般卖点文字补充<input id="fNormalText" value="${esc(p.normalText)}"></label>
      <div class="cmp-form-acts">
        <span class="chip cmp-act primary big" id="fSave">${isNew ? '保存并运行匹配' : '保存'}</span>
        <span class="chip cmp-act big" id="fCancel">取消</span>
      </div>
    </div>`;
    bindBar();
    document.getElementById('cmpProjectSelect').value = ui.curProjectId || '';
    // 维度点选
    document.querySelectorAll('.cmp-dimpick').forEach(box => {
      box.addEventListener('click', e => {
        const t = e.target.closest('.cmp-dim-opt');
        if (!t) return;
        const max = +box.dataset.max;
        const dim = t.dataset.dim;
        const selected = () => Array.from(box.querySelectorAll('.cmp-dim-opt.on')).map(x => x.dataset.dim);
        let arr = selected();
        if (arr.includes(dim)) { t.classList.remove('on'); }
        else { if (arr.length >= max) { alert('最多选择' + max + '项'); return; } t.classList.add('on'); }
      });
    });
    document.getElementById('fCancel').onclick = () => { ui.formIsNew = false; ui.view = 'list'; render(); };
    document.getElementById('fSave').onclick = () => {
      const code = document.getElementById('fCode').value.trim();
      const name = document.getElementById('fName').value.trim();
      if (!code || !name) { alert('请填写项目代号与名称'); return; }
      const coreDims = Array.from(document.querySelectorAll('#pickCore .cmp-dim-opt.on')).map(x => x.dataset.dim);
      const normalDims = Array.from(document.querySelectorAll('#pickNormal .cmp-dim-opt.on')).map(x => x.dataset.dim);
      if (!coreDims.length) { alert('至少选择1项核心卖点'); return; }
      const pmin = document.getElementById('fPmin').value;
      const pmax = document.getElementById('fPmax').value;
      const saved = {
        ...p, code, name,
        body: document.getElementById('fBody').value,
        level: document.getElementById('fLevel').value,
        priceMin: pmin === '' ? null : +pmin,
        priceMax: pmax === '' ? null : +pmax,
        energyTags: Array.from(document.querySelectorAll('.fEnergy:checked')).map(x => x.value),
        allowCrossEnergy: document.getElementById('fCross').checked,
        coreDims, normalDims,
        coreText: document.getElementById('fCoreText').value.trim(),
        normalText: document.getElementById('fNormalText').value.trim()
      };
      if (saved.priceMin != null && saved.priceMax != null && saved.priceMin > saved.priceMax) { alert('售价下限不能大于上限'); return; }
      const arr = loadProjects();
      const i = arr.findIndex(x => x.id === saved.id);
      if (i >= 0) arr[i] = saved; else arr.push(saved);
      saveProjects(arr);
      ui.curProjectId = saved.id;
      ui.formIsNew = false;
      ui.view = 'list';
      if (isNew) runMatch(saved); else render();
    };
  }

  /* ---------- 动作绑定 ---------- */
  function bindBar() {
    const sel = document.getElementById('cmpProjectSelect');
    if (sel) sel.onchange = () => { ui.curProjectId = sel.value; ui.rec = null; render(); };
    const n = document.getElementById('cmpNewBtn');
    if (n) n.onclick = () => { ui.formIsNew = true; ui.rec = null; ui.view = 'edit'; render(); };
    const e = document.getElementById('cmpEditBtn');
    if (e) e.onclick = () => { ui.formIsNew = false; ui.view = 'edit'; render(); };
    const ex = document.getElementById('cmpExportBtn');
    if (ex) ex.onclick = exportJSON;
    const im = document.getElementById('cmpImportBtn');
    const file = document.getElementById('cmpImportFile');
    if (im && file) { im.onclick = () => file.click(); file.onchange = importJSON; }
    const d = document.getElementById('cmpDelBtn');
    if (d) d.onclick = deleteProject;
  }

  function bindProject(proj) {
    const run = document.getElementById('cmpRunBtn');
    if (run) run.onclick = () => runMatch(proj);
  }
  // 永久事件委托：$app 元素本身不被 innerHTML 替换，只挂一次
  function initDelegation() {
    $app.addEventListener('click', ev => {
      if (ui.view !== 'list') return;
      const t = ev.target.closest('[data-act]');
      if (!t) return;
      const proj = loadProjects().find(p => p.id === ui.curProjectId);
      if (!proj) return;
      const id = t.dataset.id, act = t.dataset.act;
      if (act === 'add') {
        if (!(proj.picks || []).some(k => k.id === id)) {
          proj.picks = [...(proj.picks || []), { id, tier: t.dataset.tier || 'same', auto: false }];
          saveProjects(loadProjects().map(x => x.id === proj.id ? proj : x));
          render();
        }
      } else if (act === 'drop') {
        proj.picks = (proj.picks || []).filter(k => k.id !== id);
        saveProjects(loadProjects().map(x => x.id === proj.id ? proj : x));
        render();
      } else if (act === 'tier') {
        proj.picks = (proj.picks || []).map(k => k.id === id ? { ...k, tier: k.tier === 'upper' ? 'same' : 'upper', auto: false } : k);
        saveProjects(loadProjects().map(x => x.id === proj.id ? proj : x));
        render();
      }
    });
  }

  async function runMatch(proj) {
    ui.pool = ui.pool.length ? ui.pool : await buildPool();
    ui.rec = recommend(proj, ui.pool);
    ui.recLevel = proj.level;
    // 自动写入推荐（仅当无人工名单或用户重算时覆盖 auto 项，保留手动项）
    const manual = (proj.picks || []).filter(k => !k.auto);
    const autoPicks = [
      ...ui.rec.upper.slice(0, 1).map(i => ({ id: i.c.id, tier: 'upper', auto: true })),
      ...ui.rec.same.slice(0, 4).map(i => ({ id: i.c.id, tier: 'same', auto: true }))
    ];
    proj.picks = [...manual, ...autoPicks];
    proj.autoMatched = true;
    saveProjects(loadProjects().map(x => x.id === proj.id ? proj : x));
    ui.view = 'list';
    render();
  }

  function exportJSON() {
    const proj = loadProjects().find(p => p.id === ui.curProjectId);
    if (!proj) return;
    const blob = new Blob([JSON.stringify({ type: 'cmp-project', version: 1, projects: [proj] }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '竞品项目_' + proj.code + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importJSON(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        const incoming = Array.isArray(data) ? data : data.projects;
        if (!Array.isArray(incoming)) throw new Error('格式不符');
        const arr = loadProjects();
        for (const p of incoming) {
          if (!p.id || !p.code || !p.name) throw new Error('缺少 id/code/name');
          p.id = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          p.picks = Array.isArray(p.picks) ? p.picks : [];
          arr.push(p);
        }
        saveProjects(arr);
        ui.curProjectId = arr[arr.length - 1].id;
        ui.formIsNew = false;
        ui.rec = null;
        render();
        alert('已导入 ' + incoming.length + ' 个项目');
      } catch (e) { alert('导入失败：' + e.message); }
    };
    r.readAsText(f);
    ev.target.value = '';
  }
  function deleteProject() {
    const proj = loadProjects().find(p => p.id === ui.curProjectId);
    if (!proj) return;
    if (!confirm('确认删除项目「' + proj.name + '」？其竞品名单一并删除（月报池数据不受影响）。')) return;
    saveProjects(loadProjects().filter(p => p.id !== proj.id));
    ui.curProjectId = null; ui.rec = null;
    render();
  }

  /* ---------- 挂接 ---------- */
  window.CmpPage = { render };
  // app.js 先于本文件执行首次 navigate()；若当前正停留在对比页，补一次渲染
  document.addEventListener('DOMContentLoaded', () => {
    if (location.hash.includes('/compare') && typeof navigate === 'function') navigate();
  });
  if (document.readyState !== 'loading' && location.hash.includes('/compare') && typeof navigate === 'function') {
    navigate();
  }
})();
