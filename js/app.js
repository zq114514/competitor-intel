/* ============================================================
 * 竞品技术情报站 · 应用逻辑
 * 纯原生JS，无依赖；hash路由；数据来自 data.js
 * CARS=月度新车型；COMP_CARS=竞品库（Excel）；TECHS=新技术
 * ============================================================ */

const $app = document.getElementById('app');
// reportMonth = 月报池键(YYYY-MM)，用于缓存/localStorage命名空间；页面显示用全局 REPORT_MONTH（中文标签）
const CURRENT_MONTH_KEY = (typeof MONTHLY_POOL !== 'undefined' && MONTHLY_POOL.find(m => m.isCurrent))
  ? MONTHLY_POOL.find(m => m.isCurrent).month : '2026-09';
const state = {
  route: 'overview', powerFilter: '全部', segFilter: '全部', dimGroupFilter: 'all', dimFilter: '全部',
  techGroupFilter: 'all', techFilter: 'all', projectId: PROJECTS[0].id, cmpOpen: {},
  editMode: false, reportMonth: CURRENT_MONTH_KEY
};

// ---------- 自动高亮：已关闭（用户改由编辑模式手动标记） ----------
// 保留剥离历史自动生成的 hl-* 标签，不再注入新高亮；用户手动加的 <b class="hl-xxx"> 格式保留渲染
function highlightNumbers(text) {
  if (!text || typeof text !== 'string') return text || '';
  // 剥离自动生成的高亮标签，保留用户手动添加的格式（手动标签不经过 highlightNumbers 生成，此处一并剥离也没关系，用户可在编辑模式重新加）
  let r = text.replace(/<b class="hl-(num|up|down|pct)"[^>]*>([\s\S]*?)<\/b>/g, '$1');
  return r;
}

// ---------- 编辑模式：localStorage override（按月隔离，避免跨月 id 冲突） ----------
const LS_PREFIX = 'edit_';
function lsKey(id, field) { return LS_PREFIX + state.reportMonth + '__' + id + '.' + field; }
function getOverride(id, field) { return localStorage.getItem(lsKey(id, field)); }
function setOverride(id, field, val) { localStorage.setItem(lsKey(id, field), val); }
function clearAllOverrides() {
  const pre = LS_PREFIX + state.reportMonth + '__';
  Object.keys(localStorage).filter(k => k.startsWith(pre)).forEach(k => localStorage.removeItem(k));
}
// 一次性迁移：旧版本 key 不带月份前缀（edit_xxx），归入 2026-09
(function migrateLegacyOverrides() {
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith(LS_PREFIX) && !k.startsWith(LS_PREFIX + '20')) {
      localStorage.setItem(LS_PREFIX + '2026-09__' + k.slice(LS_PREFIX.length), localStorage.getItem(k));
      localStorage.removeItem(k);
    }
  });
})();

// 深拷贝 + 应用 localStorage 覆盖
// 字段路径编码：层级以下划线连接，数组下标作为数字段（如 uspGroups_0_items_1_d、specs_厂商、metrics_0_value）
function applyOverrides(obj, rootId = null, path = '') {
  if (Array.isArray(obj)) {
    return obj.map((v, i) => applyOverrides(v, rootId, path ? `${path}_${i}` : path));
  }
  if (obj && typeof obj === 'object') {
    const rid = rootId || obj.id || null;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}_${k}` : k;
      if (typeof v === 'string' || typeof v === 'number') {
        const ov = rid !== null ? getOverride(rid, p) : null;
        if (ov !== null) out[k] = typeof v === 'number' ? (parseFloat(ov) || v) : ov;
        else out[k] = v;
      } else {
        out[k] = applyOverrides(v, rid, p);
      }
    }
    return out;
  }
  return obj;
}

// 生成带编辑属性的 HTML 片段
// - 非编辑态：自动高亮量化数据后渲染为纯展示 HTML
// - 编辑态：渲染为 contenteditable，blur 时存 innerHTML（支持手动格式：下划线/颜色）
function editable(text, id, field, multiline = false) {
  if (text === undefined || text === null) return '';
  const id_ = id || '';
  const ov = id_ ? getOverride(id_, field) : null;
  // 非编辑模式
  if (!state.editMode) {
    const html = ov !== null ? ov : highlightNumbers(String(text));
    return html; // 存的是带格式标签的 HTML，直接输出；原始纯文本也自动高亮
  }
  // 编辑模式：显示存好的 HTML（有格式），否则从纯文本 + 自动高亮生成初始内容
  const initialHTML = ov !== null ? ov : highlightNumbers(String(text));
  return `<span data-edit="${id_}.${field}" data-multi="${multiline ? 1 : 0}" contenteditable="true" spellcheck="false"${multiline ? ' style="white-space:pre-wrap;display:block"' : ''}>${initialHTML}</span>`;
}

// 规格块：值为 '—' / '' / null 时整块不渲染；带 field 时支持编辑
function specBlock(label, value, id, field) {
  if (value === undefined || value === null || value === '' || value === '—') return '';
  const v = field ? editable(value, id, field) : highlightNumbers(String(value));
  return `<div class="spec"><div class="k">${label}</div><div class="v">${v}</div></div>`;
}

// 单行编辑框回车结束编辑（多行用 Shift+Enter 或直接换行）
document.addEventListener('keydown', e => {
  const el = e.target.closest && e.target.closest('[data-edit]');
  if (!el) return;
  if (e.key === 'Enter' && el.dataset.multi !== '1' && !e.shiftKey) {
    e.preventDefault();
    el.blur();
  }
  // 快捷键：Ctrl/Cmd + B 加粗 / U 下划线
  if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault(); document.execCommand('bold', false, null);
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
    e.preventDefault(); document.execCommand('underline', false, null);
  }
});

// 格式工具栏：编辑模式下选中文本时悬浮显示
const fmtBar = document.createElement('div');
fmtBar.className = 'fmt-bar';
fmtBar.innerHTML = `
  <button class="fmt-btn" data-cmd="bold" title="加粗 (Ctrl+B)"><b>B</b></button>
  <button class="fmt-btn" data-cmd="underline" title="下划线 (Ctrl+U)"><u>U</u></button>
  <button class="fmt-btn fmt-red" title="标红" style="color:#ff3a3a;font-weight:800">红</button>
  <button class="fmt-btn fmt-black" title="标黑/默认" style="color:#e0e8f5">黑</button>
  <label class="fmt-btn color-btn" title="自定义颜色">
    A<input type="color" id="fmtColor" style="display:none">
  </label>
  <button class="fmt-btn" data-cmd="hiliteColor" title="黄色高亮"><span style="background:#ffeb3b;color:#111;padding:0 2px;border-radius:2px">Hi</span></button>
  <button class="fmt-btn" data-cmd="removeFormat" title="清除格式">✕</button>
`;
document.body.appendChild(fmtBar);

// 点击工具栏按钮（事件委托）
fmtBar.addEventListener('click', e => {
  const btn = e.target.closest('.fmt-btn');
  if (!btn) return;
  e.preventDefault();
  if (btn.classList.contains('fmt-red')) { document.execCommand('foreColor', false, '#ff3a3a'); }
  else if (btn.classList.contains('fmt-black')) { document.execCommand('foreColor', false, '#e0e8f5'); }
  else if (btn.dataset.cmd === 'hiliteColor') { document.execCommand('hiliteColor', false, '#ffeb3b'); }
  else if (btn.dataset.cmd) { document.execCommand(btn.dataset.cmd, false, null); }
  // 触发保存
  document.activeElement?.dispatchEvent(new Event('blur', { bubbles: true }));
});
// 颜色选择器
document.addEventListener('input', e => {
  if (e.target.id === 'fmtColor') {
    document.execCommand('foreColor', false, e.target.value);
    document.activeElement?.dispatchEvent(new Event('blur', { bubbles: true }));
  }
});
// 让工具栏上的点击不抢走 selection 所在元素的焦点
fmtBar.addEventListener('mousedown', e => e.preventDefault());

// 光标在可编辑区域内时显示/更新工具栏位置
document.addEventListener('selectionchange', () => {
  if (!state.editMode) { fmtBar.style.display = 'none'; return; }
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) { fmtBar.style.display = 'none'; return; }
  const anchor = sel.anchorNode;
  if (!anchor) return;
  const editEl = (anchor.nodeType === 1 ? anchor : anchor.parentElement)?.closest('[data-edit]');
  if (!editEl) { fmtBar.style.display = 'none'; return; }
  // 计算工具栏位置
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  fmtBar.style.display = 'flex';
  const top = Math.max(rect.top + window.scrollY - 44, 72);
  const left = Math.min(rect.left + window.scrollX, window.innerWidth - 260);
  fmtBar.style.top = top + 'px';
  fmtBar.style.left = left + 'px';
});

// 编辑模式下拦截卡片跳转；非编辑模式正常打开详情
window.onCardClick = function(e, kind, id) {
  if (state.editMode) { e.stopPropagation(); return; }
  if (kind === 'tech') openTech(id); else openCar(id);
};
// 编辑模式下显式打开详情弹窗（供"编辑详情"按钮使用）
window.editDetail = function(e, kind, id) {
  e.stopPropagation();
  if (kind === 'tech') openTech(id); else openCar(id);
};
// 编辑模式下小按钮
function editDetailBtn(kind, id) {
  return state.editMode ? `<button class="edit-detail-btn" onclick="editDetail(event,'${kind}','${id}')" title="打开详情页编辑全部字段">📝 编辑详情</button>` : '';
}

// blur 时保存编辑（存 innerHTML 以保留手动格式：<b>/<u>/<span style=...>）
document.addEventListener('blur', e => {
  const el = e.target.closest('[data-edit]');
  if (!el) return;
  const key = el.dataset.edit;
  const idx = key.indexOf('.');
  const id = key.slice(0, idx);
  const field = key.slice(idx + 1);
  // 存 innerHTML（含格式标签），但先清理一下浏览器 execCommand 产生的冗余标签
  let html = el.innerHTML;
  // 去掉空标签和 span 的默认 style（如 <span style="font-weight: normal">）
  html = html.replace(/<span style="font-weight:\s*normal">/g, '').replace(/<\/span>/g, '');
  setOverride(id, field, html);
}, true);

// 全局：切换编辑模式
window.toggleEdit = function() {
  state.editMode = !state.editMode;
  document.body.classList.toggle('edit-mode', state.editMode);
  const btn = document.getElementById('editToggle');
  const exportBtn = document.getElementById('exportBtn');
  if (state.editMode) {
    btn.textContent = '✓ 完成编辑';
    btn.classList.add('active');
    exportBtn.style.display = '';
    if (!document.querySelector('.edit-mode-bar')) {
      const bar = document.createElement('div');
      bar.className = 'edit-mode-bar';
      bar.id = 'editModeBar';
      bar.innerHTML = '✏️ 编辑模式已开启 — 点击任意虚线框内文字直接修改，修改自动保存到本地。完成后点「完成编辑」再「导出 data.js」替换源文件。';
      document.body.appendChild(bar);
    }
  } else {
    btn.textContent = '✏️ 编辑模式';
    btn.classList.remove('active');
    exportBtn.style.display = 'none';
    document.getElementById('editModeBar')?.remove();
  }
  render();
};

// 全局：导出 data 文件（拉取当前月份原始文件 + 末尾追加自动应用补丁，得到可直接替换的完整文件）
window.exportDataJS = async function() {
  // 收集当前月份的 override，按条目 id 分组
  const monthPre = LS_PREFIX + state.reportMonth + '__';
  const overrides = {};
  Object.keys(localStorage).filter(k => k.startsWith(monthPre)).forEach(k => {
    const rest = k.slice(monthPre.length);
    const dotIdx = rest.indexOf('.');
    const id = rest.slice(0, dotIdx);
    const field = rest.slice(dotIdx + 1);
    if (!overrides[id]) overrides[id] = {};
    overrides[id][field] = localStorage.getItem(k);
  });
  if (!Object.keys(overrides).length) {
    alert('当前月份（' + state.reportMonth + '）没有任何修改。先在页面上编辑内容再导出。');
    return;
  }
  const editCount = Object.values(overrides).reduce((n, f) => n + Object.keys(f).length, 0);

  // 修改清单（用于结果弹窗）
  const allItems = [...CARS, ...TECHS, ...(typeof COMP_CARS !== 'undefined' ? COMP_CARS : [])];
  const report = Object.entries(overrides).map(([id, fields]) => {
    const item = allItems.find(x => x.id === id);
    let name = id;
    if (item) name = item.name || item.title || id;
    else if (id.startsWith('trend_')) name = '技术趋势' + id.slice(6);
    return `【${name}】（${id}）\n` + Object.entries(fields).map(([f, v]) => `  ${f} → "${v.length > 60 ? v.slice(0, 60) + '…' : v}"`).join('\n');
  }).join('\n\n');

  // 拉取当前月份的原始数据文件
  const poolItem = (typeof MONTHLY_POOL !== 'undefined' ? MONTHLY_POOL : []).find(m => m.month === state.reportMonth);
  const fileUrl = poolItem ? poolItem.file : 'js/data.js';
  let src = '';
  try {
    const res = await fetch(fileUrl + '?export=' + Date.now());
    src = await res.text();
  } catch (err) {
    alert('导出失败：无法读取原始 ' + fileUrl + '（' + err.message + '）。请通过 http 服务访问页面后重试。');
    return;
  }

  // 追加补丁 IIFE：加载时按 id 匹配条目并按编码路径写值
  const patch = '\n\n// ============================================================\n' +
    '// 编辑模式手动修改（' + new Date().toLocaleString('zh-CN') + ' 导出，共 ' + editCount + ' 处）\n' +
    '// ============================================================\n' +
    '(function(){\n' +
    'var PATCH = ' + JSON.stringify(overrides, null, 2) + ';\n' +
    'function setPath(o, path, val){ var s = path.split("_"), cur = o;\n' +
    '  for (var i=0;i<s.length-1;i++){ cur = /^\\d+$/.test(s[i]) ? cur[+s[i]] : cur[s[i]]; if(cur==null) return; }\n' +
    '  var last = s[s.length-1]; cur[/^\\d+$/.test(last) ? +last : last] = val; }\n' +
    'function applyPatch(arr){ if(!arr) return; arr.forEach(function(it){ var p = it && PATCH[it.id]; if(!p) return;\n' +
    '  Object.keys(p).forEach(function(path){ setPath(it, path, p[path]); }); }); }\n' +
    'applyPatch(CARS); applyPatch(TECHS); if (typeof COMP_CARS!=="undefined") applyPatch(COMP_CARS);\n' +
    'if (typeof TRENDS !== "undefined") TRENDS.forEach(function(t,i){ var p = PATCH["trend_"+i]; if(p) Object.keys(p).forEach(function(k){ t[k]=p[k]; }); });\n' +
    '})();\n';

  const blob = new Blob([src + patch], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = poolItem && !poolItem.isCurrent ? poolItem.file.split('/').pop() : 'data.js';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  // 结果弹窗
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.style.display = 'flex';
  mask.innerHTML = `
    <div class="modal" style="max-width:720px">
      <div class="mhead" style="background:linear-gradient(135deg,#153252,#0c1c30)">
        <button class="close" onclick="this.closest('.modal-mask').remove()">✕</button>
        <h2>📦 导出完成</h2>
        <div class="sub">共 ${Object.keys(overrides).length} 个条目 / ${editCount} 处修改，已生成完整 data.js 并下载</div>
      </div>
      <div class="body">
        <div style="font-size:13px;color:#b8c7de;line-height:1.8;background:var(--bg-soft);padding:14px;border-radius:8px;font-family:Consolas,monospace;white-space:pre-wrap;max-height:320px;overflow-y:auto">${report}</div>
        <p style="margin-top:14px;font-size:12.5px;color:var(--text-dim);line-height:1.7">
          📁 用下载的 <code>data.js</code> 替换 <code>webapp/js/data.js</code> 原文件，刷新即永久生效（其他同事打开也是修改后的内容）。<br>
          💡 替换完成后建议在浏览器控制台执行 <code>clearAllOverrides()</code> 清掉本地暂存，避免重复。
        </p>
      </div>
    </div>`;
  mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
  document.body.appendChild(mask);
};

// ---------- 工具 ----------
const byId = id => (_OC || CARS).find(c => c.id === id) || (_OCM || COMP_CARS).find(c => c.id === id);
const byTechId = id => (_OT || TECHS).find(t => t.id === id);
const isComp = c => (_OCM || COMP_CARS).includes(c);
const domainName = key => (DOMAINS.find(d => d.key === key) || {}).name || key;
const domainColor = key => { const d = DOMAINS.find(dm => dm.key === key); if (!d) return '#35d0e0'; const g = DOMAIN_GROUPS.find(g => g.key === d.group); return g ? g.color : '#35d0e0'; };
const domainBadgeStyle = key => { const c = domainColor(key); return `color:${c};background:${c}1a;border:1px solid ${c}59`; };

// ---------- TECHS 维度关联：唯一入口（准则第七章） ----------
// 新结构 domains:[{key,rel:'strong'|'weak'}]；往期 data 文件只有 domain 单值 → 归一化为单强关联
const techDomains = t => {
  if (Array.isArray(t.domains) && t.domains.length) return t.domains;
  return t.domain ? [{ key: t.domain, rel: 'strong' }] : [];
};
const techMainDim = t => techDomains(t)[0] || null;
const techHasDim = (t, key) => techDomains(t).some(d => d.key === key);
// 色点组：强关联实色、弱关联半透明描边
const techDotsHTML = t => techDomains(t).map(d => {
  const c = domainColor(d.key);
  const name = domainName(d.key) + (d.rel === 'weak' ? '（弱关联）' : '（强关联）');
  return d.rel === 'weak'
    ? `<span class="td-dot weak" title="${name}" style="border-color:${c};background:${c}22"></span>`
    : `<span class="td-dot" title="${name}" style="background:${c}"></span>`;
}).join('');
// 徽章组：强关联实色底、弱关联虚框
const techBadgesHTML = t => techDomains(t).map(d => {
  const c = domainColor(d.key);
  const weak = d.rel === 'weak';
  const style = weak
    ? `color:${c};background:transparent;border:1px dashed ${c}99`
    : `color:${c};background:${c}1a;border:1px solid ${c}59`;
  return `<span class="badge${weak ? ' weak-badge' : ''}" style="${style}" title="${weak ? '弱关联' : '强关联'}">${domainName(d.key)}${weak ? '·弱' : ''}</span>`;
}).join('');
// 总览速览行：逐维度「色点+名称」，强关联实色、弱关联半透明带"弱"标
const techBriefCatsHTML = t => techDomains(t).map(d => {
  const c = domainColor(d.key);
  const weak = d.rel === 'weak';
  const dot = weak
    ? `<span class="td-dot weak" style="border-color:${c};background:${c}22"></span>`
    : `<span class="td-dot" style="background:${c}"></span>`;
  return `<span class="tb-cat-item${weak ? ' weak' : ''}" style="color:${c}" title="${domainName(d.key)}（${weak ? '弱关联' : '强关联'}）">${dot}${domainName(d.key)}${weak ? '<i>弱</i>' : ''}</span>`;
}).join('');
// 详情页维度文字（强/弱标注）
const techDimNames = t => techDomains(t).map(d => domainName(d.key) + (d.rel === 'weak' ? '（弱）' : '')).join('、');
// SIGNALS 类型标签
const SIG_TYPE_LABEL = { milestone: '里程碑', report: '报告披露', policy: '政策' };
const caliberBadge = c => { const b = CALIBER[c.caliber] || CALIBER.excel; return `<span class="badge ${b.cls}">${b.label}</span>`; };
const impactBadge = i => `<span class="badge b-impact-${i}">影响·${i === 'high' ? '高' : i === 'medium' ? '中' : '低'}</span>`;
const compPrice = c => c.specs['售价 万'] ? c.specs['售价 万'] + ' 万' : '—';
const compDate = c => c.specs['上市时间'] || '—';

// 轮播/弹窗渐变色板
const PALETTES = [
  ['#153252', '#0c1c30'], ['#3a2a14', '#241a0c'], ['#123a33', '#0a241f'],
  ['#2b1b3d', '#180f26'], ['#3d1f1f', '#260f0f'], ['#1c2b4a', '#101a2e']
];
const pal = i => PALETTES[i % PALETTES.length];

// HTML 属性转义：防止数据中的 " ' < > & 打破属性引号结构
function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// 渲染来源链接：srcUrl 可以是单个字符串或数组，数组则渲染多个链接
function renderSrcUrls(urls, label) {
  if (!urls) return label;
  if (Array.isArray(urls)) {
    return urls.map(function(u) {
      return '<a href="' + escAttr(u) + '" target="_blank" rel="noopener">' + label + ' ↗</a>';
    }).join(' ｜ ');
  }
  return '<a href="' + escAttr(urls) + '" target="_blank" rel="noopener">' + label + ' ↗</a>';
}
// 图片渲染：纯字符串拼接（不用模板字符串）+ HTML转义，杜绝引号嵌套解析错误
// 错误降级：通过 document 级别的 error 事件委托处理，不写内联 onerror
function imgOrPh(c, alt) {
  if (c && c.img) {
    // 纯字符串拼接 + escAttr 双重保险，确保属性值里有 " ' < > & 都不会打破标签
    return '<img src="' + escAttr(c.img) + '" alt="' + escAttr(alt || c.name) + '" loading="lazy" onerror="IMG_ERROR_PH(this)">';
  }
  return '<div class="img-ph">暂无图片</div>';
}
// 图片错误降级（全局具名函数，onerror 直接引用无嵌套）
window.IMG_ERROR_PH = function(el) {
  try { el.outerHTML = '<div class="img-ph">暂无图片</div>'; } catch(e) { /* 已销毁就静默 */ }
};
// 价格清洗：去掉"限时先享"、括号内补贴价、权益说明等冗余前缀后缀
function cleanPrice(p) {
  if (!p) return '—';
  let s = p;
  // 去掉圆括号/方括号/中文括号及其内容（贪婪，匹配最近的闭合括号）
  s = s.replace(/[（(][^）)]*[）)]/g, '');
  // 去掉冗余前缀词
  s = s.replace(/限时先享\s*/g, '').replace(/指导价\s*/g, '').replace(/预售\s*/g, '');
  s = s.replace(/上市补贴价\s*/g, '').replace(/权益价\s*/g, '');
  // 去掉"权益截至……"这类末尾权益说明（只截到 "权益截至" 为止，保留前面的数字）
  s = s.replace(/\s*权益截至[^，。]*$/, '').replace(/\s*权益.*起/, '起').replace(/\s*权益.*$/, '');
  // 去掉开头的"权益"但保留后续价格
  s = s.replace(/^权益\s*/, '');
  // 去掉多余空白
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// ---------- 路由 ----------
function navigate() {
  const hash = (location.hash || '#/overview').replace('#/', '');
  state.route = ['overview', 'cars', 'tech', 'compare'].includes(hash) ? hash : 'overview';
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.route === state.route));
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);

// ---------- 渲染入口 ----------
function render() {
  stopCarousel();
  // 每次渲染都应用 localStorage 覆盖（编辑模式下实时生效）
  window._OC = applyOverrides(CARS);
  window._OT = applyOverrides(TECHS);
  window._OCM = applyOverrides(COMP_CARS);
  window._SG = (typeof SIGNALS !== 'undefined') ? applyOverrides(SIGNALS) : [];
  window._TR = TRENDS.map((t, i) => applyOverrides(Object.assign({ id: 'trend_' + i }, t)));
  if (state.route === 'overview') renderOverview();
  else if (state.route === 'cars') renderCars();
  else if (state.route === 'tech') renderTech();
  else renderCompare();
  bindCommon();
}

// ========== ① 总览页 ==========
function renderOverview() {
  const OC = _OC || CARS; const OT = _OT || TECHS;
  // 重点车型：数据驱动——featured===true（全新车型 或 热销车系改款）
  let featured = OC.filter(c => c.featured === true);
  if (!featured.length) featured = OC.slice(0, 6);
  // 按日期升序排序（09-01 → 09-16）
  const sortedTech = [...OT].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  $app.innerHTML = `
    <h1 class="page-title">${editable(REPORT_MONTH + ' 竞品技术情报总览', 'overview', 'title')}</h1>
    <p class="page-sub">${editable('本月新上市车型 / 零部件新技术 / 重点竞品一览 —— 数据口径详见页脚声明', 'overview', 'subtitle')}</p>

    <div class="stats">
      <div class="stat"><div class="num">${OC.length}</div><div class="lbl">${editable('本月新上市/预售车型', 'overview', 'stat1_lbl')}</div></div>
      <div class="stat"><div class="num">${OT.length}</div><div class="lbl">${editable('零部件新技术动态', 'overview', 'stat2_lbl')}</div></div>
    </div>

    <div class="section-title">当月新竞品</div>
    <div class="newcar-grid">
      ${OC.map(c => `
        <div class="newcar-cell" onclick="onCardClick(event,'car','${c.id}')">
          ${editDetailBtn('car', c.id)}
          <span class="nc-name">${editable(c.name, c.id, 'name')}</span>
          <span class="nc-meta">${cleanPrice(editable(c.price, c.id, 'price'))} · ${editable(c.power, c.id, 'power')}</span>
        </div>`).join('')}
    </div>

    <div class="section-title">当月重点车型 · 流动展示</div>
    <div class="carousel" id="carousel">
      <div class="slides" id="slides">
        ${featured.map((c, i) => {
          const p = pal(i);
          const bg = c.img
            ? `linear-gradient(135deg, rgba(6,10,20,.55), rgba(6,10,20,.15) 45%, rgba(6,10,20,.7)), url('${c.img}') center/cover`
            : `linear-gradient(135deg, ${p[0]}, ${p[1]})`;
          return `
          <div class="slide" style="background:${bg}"${state.editMode ? '' : ` onclick="onCardClick(event,'car','${c.id}')"`}>
            ${editDetailBtn('car', c.id)}
            <div class="slide-num">0${i + 1}</div>
            <div class="slide-info">
              <span class="tag">${editable(c.seg, c.id, 'seg')} ｜ ${editable(c.power, c.id, 'power')}</span>
              <h3>${editable(c.name, c.id, 'name')} <span style="color:var(--orange)">${editable(c.price, c.id, 'price')}</span></h3>
              <p>${c.usp.map((u, ui) => editable(u, c.id, 'usp_' + ui)).join(' ｜ ')}</p>
            </div>
          </div>`;
        }).join('')}
      </div>
      <button class="car-arrow prev" onclick="slideMove(-1)">‹</button>
      <button class="car-arrow next" onclick="slideMove(1)">›</button>
      <div class="dots" id="dots">${featured.map((_, i) => `<span class="dot${i === 0 ? ' on' : ''}" onclick="slideTo(${i})"></span>`).join('')}</div>
    </div>

    <div class="section-title">最新技术动态</div>
    <div class="tech-brief">
      ${sortedTech.map((t, i) => {
        const mm = parseInt(t.date.split('-')[0], 10);
        const dd = parseInt(t.date.split('-')[1], 10);
        const d = mm + '.' + dd;
        const rowClick = state.editMode ? '' : `onclick="onCardClick(event,'tech','${t.id}')"`;
        return `
        <div class="tech-brief-row" ${rowClick}>
          ${editDetailBtn('tech', t.id)}
          <span class="tb-idx">${i + 1}</span>
          <span class="tb-date">${editable(d, t.id, 'date')}</span>
          <span class="tb-title">${editable(t.title, t.id, 'title')}</span>
          <span class="tb-cat">${techBriefCatsHTML(t)}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="section-title">本月技术趋势</div>
    <div class="trends">
      ${(_TR || TRENDS).map((t, i) => `<div class="trend${i === 0 ? ' wide' : ''}"><h4>${editable(t.t, 'trend_' + i, 't')}</h4><p>${editable(t.d, 'trend_' + i, 'd', true)}</p></div>`).join('')}
    </div>
    ${(_SG || []).length ? `
    <details class="signals-fold">
      <summary>📡 本月产业信号（${_SG.length}）—— 里程碑/报告类事件，非新技术，仅供趋势复核</summary>
      <ul class="signals-list">
        ${[..._SG].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(s => `
          <li>
            <span class="sig-date">${(s.date || '').replace('-', '.')}</span>
            <span class="sig-type sig-${s.type}">${SIG_TYPE_LABEL[s.type] || s.type}</span>
            <div class="sig-body">
              <div class="sig-main"><b>${editable(s.company, s.id, 'company')}</b> · ${editable(s.event, s.id, 'event')}</div>
              <div class="sig-detail">${editable(s.detail, s.id, 'detail', true)}</div>
              <a class="sig-src" href="${s.srcUrl}" target="_blank" rel="noopener">${s.src || '来源 ↗'}</a>
            </div>
          </li>`).join('')}
      </ul>
    </details>` : ''}
  `;
  startCarousel(featured.length);
}

// ========== ② 新车型页 ==========
// 从 seg 字段推断车型大类（汽车之家风格：轿车/SUV/MPV/微面/皮卡）
function segType(seg) {
  if (!seg) return '轿车';
  if (/MPV/i.test(seg)) return 'MPV';
  if (/微面/.test(seg)) return '微面';
  if (/皮卡/.test(seg)) return '皮卡';
  if (/SUV|越野|轿跑SUV|跨界SUV/.test(seg)) return 'SUV';
  return '轿车';
}
function renderCars() {
  const OC = _OC || CARS;
  const powers = ['全部', '纯电', '插混', '增程', '增程+纯电'];
  const segs = ['全部', ...new Set(OC.map(c => segType(c.seg)))];
  // 拆分为两级中间结果，保证 chip 的「（无）」标记永远基于「动力架构 ∩ 车型」的真实交集
  const filteredBase = OC
    .filter(c => state.powerFilter === '全部' || c.power === state.powerFilter || (state.powerFilter === '增程' && c.power.includes('增程')))
    .filter(c => state.segFilter === '全部' || segType(c.seg) === state.segFilter);
  const list = filteredBase
    .filter(c => {
      if (state.dimFilter !== '全部') return c.dims && c.dims.includes(state.dimFilter);
      if (state.dimGroupFilter !== 'all') {
        return c.dims && c.dims.some(k => {
          const d = DOMAINS.find(dm => dm.key === k);
          return d && d.group === state.dimGroupFilter;
        });
      }
      return true;
    });

  // 空状态提示：按哪个 filter 先清零给出不同引导
  let emptyHint = '';
  if (!list.length) {
    if (!filteredBase.length) {
      emptyHint = `当前「${state.powerFilter} ∩ ${state.segFilter}」组合下本月无车型，试试调整动力架构或车型`;
    } else if (state.dimGroupFilter !== 'all' && state.dimFilter === '全部') {
      emptyHint = `「${state.powerFilter} ∩ ${state.segFilter}」下无车型覆盖「${DOMAIN_GROUPS.find(g => g.key === state.dimGroupFilter)?.name || ''}」特性维度组`;
    } else if (state.dimFilter !== '全部') {
      emptyHint = `「${state.powerFilter} ∩ ${state.segFilter}」下无车型覆盖「${DOMAINS.find(d => d.key === state.dimFilter)?.name || ''}」维度`;
    } else {
      emptyHint = '本月新车型列表为空';
    }
  }

  // 特性维度大组 hasAny：基于 filteredBase（power∩seg 交集）统计
  const allGroups = DOMAIN_GROUPS;
  const allDims = state.dimGroupFilter !== 'all'
    ? DOMAINS.filter(d => d.group === state.dimGroupFilter)
    : [];

  $app.innerHTML = `
    <h1 class="page-title">本月新车型</h1>
    <p class="page-sub">${REPORT_MONTH}上市/预售新车 · 点击卡片查看完整配置与卖点 · 价格/参数以来源口径标注</p>
    <div class="filters">
      <div class="filter-row">
        <span class="filter-label">动力架构</span>
        ${powers.map(p => `<span class="chip${state.powerFilter === p ? ' on' : ''}" onclick="setPowerFilter('${p}')">${p}</span>`).join('')}
      </div>
      <div class="filter-row">
        <span class="filter-label">车型</span>
        ${segs.map(s => `<span class="chip${state.segFilter === s ? ' on' : ''}" onclick="setSegFilter('${s}')">${s}</span>`).join('')}
      </div>
      <div class="filter-row">
        <span class="filter-label">特性维度</span>
        <span class="chip${state.dimGroupFilter === 'all' ? ' on' : ''}" onclick="setDimGroupFilter('all')">全部</span>
        ${allGroups.map(g => {
          const hasAny = filteredBase.some(c => c.dims && c.dims.some(k => DOMAINS.find(dm => dm.key === k)?.group === g.key));
          const label = `${g.name}${hasAny ? '' : '（无）'}`;
          const disabled = !hasAny ? ' style="opacity:.55;pointer-events:none;cursor:not-allowed"' : '';
          const styleOn = state.dimGroupFilter === g.key ? ` style="background:${g.color};border-color:transparent;color:#fff;font-weight:600${disabled ? '' : ''}"` : '';
          const clickable = !hasAny ? '' : ` onclick="setDimGroupFilter('${g.key}')"`;
          const styleFinal = disabled || styleOn;
          return `<span class="chip${state.dimGroupFilter === g.key ? ' on' : ''}"${styleFinal}${clickable}>${label}</span>`;
        }).join('')}
      </div>
      ${allDims.length ? `
      <div class="filter-row">
        <span class="filter-label">维度</span>
        <span class="chip${state.dimFilter === '全部' ? ' on' : ''}" onclick="setDimFilter('全部')">该组全部</span>
        ${allDims.map(d => {
          const hasAny = filteredBase.some(c => c.dims && c.dims.includes(d.key));
          const style = hasAny ? '' : ' style="opacity:.55;pointer-events:none;cursor:not-allowed"';
          const clickable = hasAny ? ` onclick="setDimFilter('${d.key}')"` : '';
          return `<span class="chip${state.dimFilter === d.key ? ' on' : ''}"${style}${clickable}>${d.name}${hasAny ? '' : '（无）'}</span>`;
        }).join('')}
      </div>` : ''}
    </div>
    <div class="grid">
      ${list.map(c => `
        <div class="car-card" onclick="onCardClick(event,'car','${c.id}')">
          ${editDetailBtn('car', c.id)}
          <div class="thumb">${imgOrPh(c)}<span class="date">${editable(c.launchDate, c.id, 'launchDate')}</span></div>
          <div class="body">
            <h3>${editable(c.name, c.id, 'name')}</h3>
            <div class="price">${cleanPrice(editable(c.price, c.id, 'price'))}</div>
            <div class="meta"><span>${editable(c.seg, c.id, 'seg')}</span><span>${editable(c.power, c.id, 'power')}</span>${c.range !== '—' ? `<span>${editable(c.range, c.id, 'range')}</span>` : ''}</div>
            <div class="usp1">★ ${editable(c.usp[0], c.id, 'usp_0')}</div>
          </div>
        </div>`).join('')}
      ${!list.length ? `<p style="color:var(--text-dim);padding:30px;text-align:center">${emptyHint}</p>` : ''}
    </div>
  `;
}
function setPowerFilter(v) { state.powerFilter = v; render(); }
function setSegFilter(v) { state.segFilter = v; render(); }
function setDimGroupFilter(v) { state.dimGroupFilter = v; state.dimFilter = '全部'; render(); }
function setDimFilter(v) { state.dimFilter = v; render(); }

// ---------- 技术工具 ----------
// 取最醒目的量化指标（优先 direction + 值含%）
function topMetric(t) {
  if (!t.metrics || !t.metrics.length) return null;
  return t.metrics.find(m => m.value.includes('%') || m.value.includes('倍')) || t.metrics[0];
}

// ========== ③ 新技术页 ==========
function techItemHTML(t) {
  const mm = parseInt(t.date.split('-')[0], 10);
  const dd = parseInt(t.date.split('-')[1], 10);
  const dateStr = mm + '.' + dd;
  return `
    <div class="tech-item" onclick="onCardClick(event,'tech','${t.id}')">
      ${editDetailBtn('tech', t.id)}
      <div class="date-col"><div class="d">${dateStr}</div></div>
      <div class="t-main">
        <h4>${editable(t.title, t.id, 'title')}</h4>
        <div class="point">${editable(t.point, t.id, 'point', true)}</div>
        <div class="foot">
          <span class="tech-badges">${techBadgesHTML(t)}</span>
          ${caliberBadge(t.caliber)}${impactBadge(t.impact)}
          <span class="more-hint">${state.editMode ? '点击文字直接编辑，或点右上角「编辑详情」' : '点击查看详情 ↗'}</span>
        </div>
      </div>
    </div>`;
}
function renderTech() {
  const OT = _OT || TECHS;
  // 按日期升序排序（与总览页"最新技术动态"一致）
  const list = OT.filter(t => {
    if (state.techFilter !== 'all') return techHasDim(t, state.techFilter);
    if (state.techGroupFilter !== 'all') {
      return techDomains(t).some(d => {
        const dm = DOMAINS.find(x => x.key === d.key);
        return dm && dm.group === state.techGroupFilter;
      });
    }
    return true;
  }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  // 特性维度chip：7大组全部显示；选中后下所有26个维度也全部显示
  const allGroups = DOMAIN_GROUPS;
  const allDims = state.techGroupFilter !== 'all'
    ? DOMAINS.filter(d => d.group === state.techGroupFilter)
    : [];
  $app.innerHTML = `
    <h1 class="page-title">零部件新技术动态</h1>
    <p class="page-sub">${REPORT_MONTH} · 按26个功/性能维度归档（7大特性维度组）· 无标志性发布的维度未列示</p>
    <div class="filters">
      <div class="filter-row">
        <span class="filter-label">特性维度</span>
        <span class="chip${state.techGroupFilter === 'all' ? ' on' : ''}" onclick="setTechGroupFilter('all')">全部</span>
        ${allGroups.map(g => `<span class="chip${state.techGroupFilter === g.key ? ' on' : ''}"${state.techGroupFilter === g.key ? ` style="background:${g.color};border-color:transparent;color:#fff;font-weight:600"` : ''} onclick="setTechGroupFilter('${g.key}')">${g.name}</span>`).join('')}
      </div>
      ${allDims.length ? `
      <div class="filter-row">
        <span class="filter-label">维度</span>
        <span class="chip${state.techFilter === 'all' ? ' on' : ''}" onclick="setTechFilter('all')">该组全部</span>
        ${allDims.map(d => {
          const hasAny = OT.some(t => techHasDim(t, d.key));
          return `<span class="chip${state.techFilter === d.key ? ' on' : ''}"${hasAny ? '' : ' style="opacity:.55"'}" onclick="setTechFilter('${d.key}')">${d.name}${hasAny ? '' : '（无）'}</span>`;
        }).join('')}
      </div>` : ''}
    </div>
    ${list.length ? list.map(techItemHTML).join('') : '<p style="color:var(--text-dim);padding:30px;text-align:center">该领域本月无标志性官方发布</p>'}
  `;
}
function setTechFilter(v) { state.techFilter = v; render(); }
function setTechGroupFilter(v) { state.techGroupFilter = v; state.techFilter = 'all'; render(); }

// ========== ④ 竞品对比页（分组可收起/展开，结构对齐Excel） ==========
function uspCardHTML(c) {
  // 展开为 {gi, g, ii, it} 列表，保证卡片与弹窗使用同一组编辑 key
  const flat = [];
  c.uspGroups.forEach((g, gi) => g.items.forEach((it, ii) => flat.push({ gi, g, ii, it })));
  return `
    <div class="comp-card" onclick="onCardClick(event,'car','${c.id}')">
      ${editDetailBtn('car', c.id)}
      <div class="top">
        <div class="thumb-s">${imgOrPh(c)}</div>
        <div class="info">
          <h3>${editable(c.name, c.id, 'name')}</h3>
          <div class="price">${compPrice(c)}</div>
          <div>${caliberBadge(c)}</div>
        </div>
      </div>
      <div class="bottom">
        <div class="usp-title">USP 卖点（${c.uspGroups.length}组 / ${flat.length}项）</div>
        <ul class="usp-list">
          ${flat.slice(0, 6).map(({ gi, ii, it }) => `<li><b>${editable(it.t, c.id, 'uspGroups_' + gi + '_items_' + ii + '_t')}</b>：${editable(it.d, c.id, 'uspGroups_' + gi + '_items_' + ii + '_d', true)}</li>`).join('')}
          ${flat.length > 6 ? `<li class="usp-more">…共${flat.length}项，点击卡片查看全部与用户口碑</li>` : ''}
        </ul>
        <div class="review-line">
          <span class="r-good">👍 ${(c.reviews.good || []).slice(0, 2).map((g,i) => editable(g, c.id, 'reviews_good_' + i)).join('；')}</span>
          <span class="r-bad">👎 ${(c.reviews.bad || []).slice(0, 2).map((b,i) => editable(b, c.id, 'reviews_bad_' + i)).join('；')}</span>
        </div>
      </div>
    </div>`;
}

function renderCompare() {
  const p = PROJECTS.find(x => x.id === state.projectId) || PROJECTS[0];
  const comps = p.competitors.map(byId).filter(Boolean);
  state.cmpOpen = {}; // 切换项目后默认全部展开

  $app.innerHTML = `
    <h1 class="page-title">竞品对比 · 按项目</h1>
    <p class="page-sub">操作流程：先选择项目 → 展示该项目竞品的 USP 卖点与配置横向对比。竞品池 = 项目竞品 + 近3-6个月同级新车（新车/换代，6款左右），由 AI 从官网/汽车之家/懂车帝等渠道搜集梳理，月度更新</p>

    <div class="project-bar">
      <label>选择项目：</label>
      <select id="projectSelect" onchange="setProject(this.value)">
        ${PROJECTS.map(x => `<option value="${x.id}"${x.id === p.id ? ' selected' : ''}>${x.code} · ${x.name}（${x.segment}）</option>`).join('')}
      </select>
      <span class="project-desc">${p.desc}</span>
    </div>

    <div class="section-title">竞品 USP 卖点与口碑</div>
    <div class="comp-cards">
      ${comps.map((c, i) => uspCardHTML(c)).join('')}
    </div>

    <div class="section-title" style="justify-content:space-between">
      <span>配置横向对比</span>
      <span class="cmp-tools">
        <span class="chip" onclick="allGroups(true)">全部展开</span>
        <span class="chip" onclick="allGroups(false)">全部收起</span>
      </span>
    </div>
    <div class="cmp-table-wrap">
      <table class="cmp">
        <thead><tr>
          <th style="width:130px">对比维度</th>
          <th class="self-col">本司项目（${p.code}）</th>
          ${comps.map(c => `<th>${c.name}<br><small>${compPrice(c)} ｜ ${compDate(c)}</small></th>`).join('')}
        </tr></thead>
        <tbody>
          ${COMP_GROUPS.map((g, gi) => {
            state.cmpOpen[gi] = true;
            return `
            <tr class="group-row" onclick="toggleGroup(${gi})">
              <td colspan="${comps.length + 2}"><span class="chev" id="chev-${gi}">▾</span> ${g.name}<span class="g-count">（${g.rows.length}项）</span></td>
            </tr>
            ${g.rows.map(([label, carFn]) => `
              <tr class="g-row g-${gi}">
                <th>${label}</th>
                <td class="self-col">待定</td>
                ${comps.map(c => `<td>${carFn(c) || '—'}</td>`).join('')}
              </tr>`).join('')}`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="page-sub" style="margin-top:10px">注：竞品参数由 AI 自官网/汽车之家/懂车帝等渠道搜集梳理并核对（来源：${typeof COMP_SOURCE !== 'undefined' ? COMP_SOURCE : '汽车之家'}）；"待定"为本司项目待填参数；表头含售价与上市时间便于快速定位。</p>
  `;
}
function setProject(v) { state.projectId = v; render(); }

// 分组收起/展开
function toggleGroup(gi) {
  const open = state.cmpOpen[gi] = !state.cmpOpen[gi];
  document.querySelectorAll(`.g-row.g-${gi}`).forEach(r => r.classList.toggle('hidden-row', !open));
  const chev = document.getElementById('chev-' + gi);
  if (chev) { chev.textContent = open ? '▾' : '▸'; chev.closest('.group-row').classList.toggle('closed', !open); }
}
function allGroups(open) {
  if (open) { state.cmpOpen = {}; renderCompare(); bindCommon(); }
  else { Object.keys(state.cmpOpen).forEach((k, i) => { const el = document.getElementById('chev-' + i); if (el && state.cmpOpen[i]) toggleGroup(i); }); }
}

// ---------- 详情弹窗 ----------
function openCar(id) {
  const c = byId(id);
  if (!c) return;
  const allCars = (_OC || CARS).concat(_OCM || COMP_CARS);
  const p = pal(allCars.indexOf(c) % PALETTES.length);
  const box = document.getElementById('modalBox');
  box.classList.remove('modal-wide');
  let head, body;

  if (isComp(c)) {
    head = `
      <div class="mhead" style="background:linear-gradient(135deg, ${p[0]}, ${p[1]})">
        <button class="close" onclick="closeModal()">✕</button>
        <h2>${editable(c.name, c.id, 'name')}</h2>
        <div class="sub">${editable(c.specs['厂商'], c.id, 'specs_厂商')} ｜ ${editable(c.specs['级别'], c.id, 'specs_级别')} ｜ ${editable(c.specs['能源类型'], c.id, 'specs_能源类型')} ｜ ${compDate(c)} ｜ ${caliberBadge(c)}</div>
      </div>`;
    body = `
      <div class="body">
        <div class="spec-grid">
          <div class="spec"><div class="k">售价</div><div class="v">${editable(compPrice(c), c.id, 'specs_售价 万')}</div></div>
          <div class="spec"><div class="k">纯电续航</div><div class="v">${editable(c.specs['纯电续航 km'], c.id, 'specs_纯电续航 km')}</div></div>
          <div class="spec"><div class="k">零百加速</div><div class="v">${editable(c.specs['零百加速 s'], c.id, 'specs_零百加速 s')} s</div></div>
          <div class="spec"><div class="k">电池</div><div class="v">${editable(c.specs['电池能量 kWh'], c.id, 'specs_电池能量 kWh')}kWh ${editable(c.specs['电池类型'], c.id, 'specs_电池类型')}</div></div>
        </div>

        <div class="usp-title">USP 卖点</div>
        ${c.uspGroups.map((g, gi) => `
          <div class="usp-group">
            <div class="usp-group-name">${editable(g.group, c.id, 'uspGroups_' + gi + '_group')}</div>
            <ul class="usp-list">${g.items.map((it, ii) => `<li><b>${editable(it.t, c.id, 'uspGroups_' + gi + '_items_' + ii + '_t')}</b>：${editable(it.d, c.id, 'uspGroups_' + gi + '_items_' + ii + '_d', true)}</li>`).join('')}</ul>
          </div>`).join('')}

        <div class="usp-title" style="margin-top:18px">用户口碑</div>
        <div class="review-block">
          <div class="r-good">👍 好评：${(c.reviews.good || []).map((g,i) => editable(g, c.id, 'reviews_good_' + i)).join('；')}</div>
          <div class="r-bad">👎 差评：${(c.reviews.bad || []).map((b,i) => editable(b, c.id, 'reviews_bad_' + i)).join('；')}</div>
        </div>

        <div class="src-line">信息来源：${editable(c.src || COMP_SOURCE, c.id, 'src')}（AI搜集梳理，建议关键参数按认证口径复核）</div>
      </div>`;
  } else {
    head = `
      <div class="mhead" style="background:linear-gradient(135deg, ${p[0]}, ${p[1]})">
        <button class="close" onclick="closeModal()">✕</button>
        <h2>${editable(c.name, c.id, 'name')}</h2>
        <div class="sub">${editable(c.brand, c.id, 'brand')} ｜ ${editable(c.seg, c.id, 'seg')} ｜ ${editable(c.power, c.id, 'power')} ｜ ${editable(c.launchDate, c.id, 'launchDate')} ｜ ${caliberBadge(c)}</div>
      </div>`;
    body = c.dimPoints ? renderCarDimBody(c) : `
      <div class="body">
        <div class="spec-grid">
          ${specBlock('指导价', c.price, c.id, 'price')}
          ${specBlock('续航/补能', c.range, c.id, 'range')}
          ${c.specs ? specBlock('快充时间', c.specs.fastCharge) : ''}
          ${specBlock('智驾方案', c.adas, c.id, 'adas')}
          ${specBlock('座舱亮点', c.cockpit, c.id, 'cockpit')}
          ${c.specs ? specBlock('车身尺寸', c.specs.size) : ''}
          ${c.specs ? specBlock('动力总成', c.specs.power) : ''}
          ${c.specs ? specBlock('性能表现', (c.specs.accel || '') + (c.specs.topSpeed && c.specs.topSpeed !== '—' ? ' ｜ 最高' + c.specs.topSpeed : '')) : ''}
          ${c.specs ? specBlock('整备/满载质量', c.specs.weight) : ''}
          ${c.specs ? specBlock('悬架形式', c.specs.suspension) : ''}
          ${c.specs ? specBlock('安全', c.specs.safety) : ''}
        </div>
        <p class="desc">${editable(c.desc, c.id, 'desc', true)}</p>
        <div class="usp-title">USP 卖点</div>
        <ul class="usp-list">${c.usp.map((u, i) => `<li>${editable(u, c.id, 'usp_' + i)}</li>`).join('')}</ul>
        <div class="src-line">USP/描述来源：${renderSrcUrls(c.srcUrl, editable(c.src || '—', c.id, 'src'))}</div>
        ${c.specsUrl ? `<div class="src-line">性能参数来源：<a href="${c.specsUrl}" target="_blank" rel="noopener">${c.specsSrc || '汽车之家参数配置页'} ↗</a></div>` : ''}
        <div class="src-line src-caliber">口径标注：${CALIBER[c.caliber].label}</div>
      </div>`;
  }
  box.innerHTML = head + body;
  if (!isComp(c) && c.dimPoints) box.classList.add('modal-wide');
  document.getElementById('modalMask').classList.remove('hidden');
}

// 新车型详情：维度摘要卡片式布局（有 dimPoints 的车型使用）
// 从某维度筛选进入时，该维度卡片置顶、高亮、默认展开
function renderCarDimBody(c) {
  const focusDim = (state.dimFilter && state.dimFilter !== '全部' && c.dims.includes(state.dimFilter)) ? state.dimFilter : null;
  // 维度排序：聚焦维度第一，其余按 dims 原顺序
  const ordered = focusDim ? [focusDim].concat(c.dims.filter(k => k !== focusDim)) : c.dims.slice();
  const dimMeta = key => DOMAINS.find(d => d.key === key);

  const cards = ordered.map(key => {
    const meta = dimMeta(key);
    const dp = c.dimPoints[key];
    const color = domainColor(key);
    const isFocus = key === focusDim;
    // 有 dimPoints 文案走摘要卡片；暂缺文案的维度显示占位（数据未补的车型不会进此函数，这里仅防御）
    if (!dp) {
      return `<div class="dim-card dim-card-empty${isFocus ? ' hot' : ''}" style="--dimc:${color}">
        <div class="dc-head" onclick="toggleDimCard(this)">
          <span class="dc-name">${meta ? meta.name : key}</span>
          <span class="dc-s dc-s-empty">该维度卖点摘要待补录</span>
          <span class="dc-toggle">▸</span>
        </div>
      </div>`;
    }
    return `<div class="dim-card${isFocus ? ' hot' : ''}" style="--dimc:${color}">
      <div class="dc-head" onclick="toggleDimCard(this)">
        <span class="dc-name">${meta ? meta.name : key}${isFocus ? ' <span class="dc-focus-tag">当前筛选维度</span>' : ''}</span>
        <span class="dc-s">${dp.s}</span>
        <span class="dc-toggle">${isFocus ? '▾' : '▸'}</span>
      </div>
      <ul class="dc-details"${isFocus ? '' : ' style="display:none"'}>${(dp.d || []).map(t => `<li>${t}</li>`).join('')}</ul>
    </div>`;
  }).join('');

  const ks = (label, val) => val ? `<div class="ks"><div class="k">${label}</div><div class="v">${val}</div></div>` : '';

  return `
  <div class="body dim-body">
    <div class="key-specs">
      ${ks('指导价', c.price)}
      ${ks('续航/补能', c.range)}
      ${ks('快充', c.specs ? c.specs.fastCharge : '')}
      ${ks('智驾方案', c.adas)}
    </div>

    ${focusDim ? `<div class="dim-focus-tip" style="--dimc:${domainColor(focusDim)}">
      🎯 当前按「${dimMeta(focusDim).name}」筛选 —— 首张卡片为该车在此维度的官方卖点
    </div>` : ''}

    <div class="dim-section-title">官方核心卖点 <span class="dim-count">${c.usp.length} 条 USP</span></div>
    <ul class="usp-list usp-core">${c.usp.map((u, i) => `<li>${editable(u, c.id, 'usp_' + i)}</li>`).join('')}</ul>

    <div class="dim-section-title">分维度卖点 <span class="dim-count">${c.dims.length} 个维度</span></div>
    <div class="dim-grid">${cards}</div>

    <details class="dim-fold">
      <summary>车型概述</summary>
      <p class="desc">${c.desc || '—'}</p>
    </details>
    <details class="dim-fold">
      <summary>完整参数</summary>
      <div class="spec-grid">
        ${specBlock('指导价', c.price, c.id, 'price')}
        ${specBlock('续航/补能', c.range, c.id, 'range')}
        ${c.specs ? specBlock('快充时间', c.specs.fastCharge) : ''}
        ${specBlock('智驾方案', c.adas, c.id, 'adas')}
        ${specBlock('座舱亮点', c.cockpit, c.id, 'cockpit')}
        ${c.specs ? specBlock('车身尺寸', c.specs.size) : ''}
        ${c.specs ? specBlock('动力总成', c.specs.power) : ''}
        ${c.specs ? specBlock('性能表现', (c.specs.accel || '') + (c.specs.topSpeed && c.specs.topSpeed !== '—' ? ' ｜ 最高' + c.specs.topSpeed : '')) : ''}
        ${c.specs ? specBlock('整备/满载质量', c.specs.weight) : ''}
        ${c.specs ? specBlock('悬架形式', c.specs.suspension) : ''}
        ${c.specs ? specBlock('安全', c.specs.safety) : ''}
      </div>
    </details>

    <div class="src-line">USP/描述来源：${renderSrcUrls(c.srcUrl, c.src || '—')}</div>
    ${c.specsUrl ? `<div class="src-line">性能参数来源：<a href="${c.specsUrl}" target="_blank" rel="noopener">${c.specsSrc || '汽车之家参数配置页'} ↗</a></div>` : ''}
    <div class="src-line src-caliber">口径标注：${CALIBER[c.caliber].label}</div>
  </div>`;
}
window.toggleDimCard = function(headEl) {
  const card = headEl.closest('.dim-card');
  const details = card.querySelector('.dc-details');
  const toggle = card.querySelector('.dc-toggle');
  const open = details.style.display !== 'none';
  if (open) { details.style.display = 'none'; toggle.textContent = '▸'; card.classList.remove('expanded'); }
  else { details.style.display = ''; toggle.textContent = '▾'; card.classList.add('expanded'); }
};
function closeModal() { document.getElementById('modalMask').classList.add('hidden'); }
document.getElementById('modalMask').addEventListener('click', e => { if (e.target.id === 'modalMask') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ---------- 技术详情弹窗 ----------
function openTech(id) {
  const t = byTechId(id);
  if (!t) return;
  const box = document.getElementById('modalBox');
  const OT = _OT || TECHS;
  const p = pal(OT.indexOf(t) % PALETTES.length);

  const mm = parseInt(t.date.split('-')[0], 10);
  const dd = parseInt(t.date.split('-')[1], 10);
  const dateStr = mm + '.' + dd;

  box.innerHTML = `
    <div class="mhead" style="background:linear-gradient(135deg, ${p[0]}, ${p[1]})">
      <button class="close" onclick="closeModal()">✕</button>
      <h2>${editable(t.title, t.id, 'title')}</h2>
      <div class="sub">${editable(t.company, t.id, 'company')} ｜ ${techDimNames(t)} ｜ ${dateStr} ｜ ${caliberBadge(t.caliber)} ${impactBadge(t.impact)}</div>
    </div>
    <div class="body">
      <div class="tech-block">
        <div class="tech-block-title">技术概述</div>
        <p>${editable(t.point, t.id, 'point', true)}</p>
      </div>

      <div class="tech-block">
        <div class="tech-block-title">影响评估</div>
        <p class="impact-note-full">${editable(t.impactNote, t.id, 'impactNote', true)}</p>
      </div>

      <div class="src-line">信息来源：<a href="${t.srcUrl}" target="_blank" rel="noopener">${editable(t.src, t.id, 'src')} ↗</a> ｜ ${CALIBER[t.caliber].label}</div>
    </div>`;
  document.getElementById('modalMask').classList.remove('hidden');
}

// ---------- 轮播控制 ----------
let carTimer = null, carIdx = 0, carTotal = 0;
function startCarousel(total) {
  carTotal = total; carIdx = 0;
  const el = document.getElementById('carousel');
  if (!el) return;
  el.onmouseenter = null; el.onmouseleave = null;
  if (state.editMode) return; // 编辑模式下不自动轮播，便于就地修改
  el.addEventListener('mouseenter', stopCarousel);
  el.addEventListener('mouseleave', () => { stopCarousel(); carTimer = setInterval(() => slideMove(1), 4500); });
  carTimer = setInterval(() => slideMove(1), 4500);
}
function stopCarousel() { if (carTimer) { clearInterval(carTimer); carTimer = null; } }
function slideTo(i) {
  carIdx = (i + carTotal) % carTotal;
  const slides = document.getElementById('slides');
  const dots = document.getElementById('dots');
  if (!slides) return;
  slides.style.transform = `translateX(-${carIdx * 100}%)`;
  if (dots) [...dots.children].forEach((d, k) => d.classList.toggle('on', k === carIdx));
}
function slideMove(step) { slideTo(carIdx + step); }

// ---------- 通用绑定 ----------
function bindCommon() {
  const badge = document.getElementById('monthBadge');
  if (badge) badge.textContent = `数据月份 · ${REPORT_MONTH}`;
}

// ========== 月报池切换 ==========
function toggleMonthPanel(e) {
  e.stopPropagation();
  const panel = document.getElementById('mpPanel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}
// 点击面板外关闭
document.addEventListener('click', e => {
  const p = document.getElementById('monthPicker');
  if (p && !p.contains(e.target)) {
    const panel = document.getElementById('mpPanel');
    if (panel) panel.style.display = 'none';
  }
});
function initMonthPicker() {
  const list = document.getElementById('mpList');
  if (!list || typeof MONTHLY_POOL === 'undefined') return;
  list.innerHTML = MONTHLY_POOL.map(m => `
    <div class="mp-item${m.month === state.reportMonth ? ' on' : ''}" data-month="${m.month}" onclick="switchMonth('${m.month}')">
      <span>${m.label}</span>
      <span class="mp-state">${m.month === state.reportMonth ? '当前' : (MONTH_CACHE[m.month] ? '已加载' : '')}</span>
    </div>`).join('');
  document.getElementById('mpLabel').textContent =
    (MONTHLY_POOL.find(m => m.month === state.reportMonth) || {}).label || state.reportMonth;
}

// ---------- 方案A：月报池动态加载 ----------
// 每个月报一个独立 js 文件（var 声明），用 new Function 在函数作用域求值，
// 取出 {REPORT_MONTH,CARS,TECHS,TRENDS} 后替换全局可变绑定（var 挂在 window 上）
const MONTH_CACHE = {};
// 启动时缓存 9 月（当前 data.js）数据
MONTH_CACHE[REPORT_MONTH_FILE()] = {
  REPORT_MONTH, CARS, TECHS, TRENDS, SIGNALS: (typeof SIGNALS !== 'undefined' ? SIGNALS : [])
};
function REPORT_MONTH_FILE() {
  const cur = MONTHLY_POOL.find(m => m.isCurrent);
  return cur ? cur.month : state.reportMonth;
}
async function loadMonthDataset(month) {
  if (MONTH_CACHE[month]) return MONTH_CACHE[month];
  const target = MONTHLY_POOL.find(m => m.month === month);
  if (!target) throw new Error('月报池中未登记 ' + month);
  const res = await fetch(target.file + '?v=' + Date.now());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const src = await res.text();
  // 函数作用域内求值：文件里的 var 不会污染/冲突全局
  const ds = new Function(src + '\n;return {REPORT_MONTH: (typeof REPORT_MONTH!=="undefined"?REPORT_MONTH:""), ' +
    'CARS: (typeof CARS!=="undefined"?CARS:[]), TECHS: (typeof TECHS!=="undefined"?TECHS:[]), ' +
    'TRENDS: (typeof TRENDS!=="undefined"?TRENDS:[]), SIGNALS: (typeof SIGNALS!=="undefined"?SIGNALS:[])};')();
  if (!ds.CARS.length && !ds.TECHS.length) throw new Error('文件中没有 CARS/TECHS 数据');
  MONTH_CACHE[month] = ds;
  return ds;
}
window.switchMonth = async function(month) {
  const panel = document.getElementById('mpPanel');
  if (month === state.reportMonth) { panel.style.display = 'none'; return; }
  const listEl = document.getElementById('mpList');
  if (listEl) listEl.style.opacity = '.55';
  try {
    const ds = await loadMonthDataset(month);
    // 替换全局数据（var 声明 = window 属性，可重新赋值；app.js 内裸引用随之切换）
    window.REPORT_MONTH = ds.REPORT_MONTH;
    window.CARS = ds.CARS;
    window.TECHS = ds.TECHS;
    window.TRENDS = ds.TRENDS;
    window.SIGNALS = ds.SIGNALS || [];
    state.reportMonth = month;
    // 重置筛选与编辑态，回到总览
    state.powerFilter = '全部'; state.segFilter = '全部'; state.dimGroupFilter = 'all'; state.dimFilter = '全部'; state.techGroupFilter = 'all'; state.techFilter = 'all';
    if (state.editMode) toggleEdit();
    if (state.route !== 'overview') location.hash = '#/overview';
    panel.style.display = 'none';
    initMonthPicker();
    render();
  } catch (err) {
    alert('月报「' + month + '」加载失败：' + err.message + '\n请确认通过 http 服务访问，且 ' + month + ' 数据文件已存在。');
  } finally {
    if (listEl) listEl.style.opacity = '';
  }
};

// 启动
document.getElementById('monthBadge').textContent = `数据月份 · ${REPORT_MONTH}`;
initMonthPicker();
navigate();

// ============================================================
// 悬浮反馈侧栏
// ============================================================
// 飞书公开表单 + 公开仪表盘（免登录、匿名访问）
var FB_FORM_URL    = 'https://acndoaymjsa1.feishu.cn/share/base/shrcnhQ9DGD4ZSd0aKD7o2Z2q07?embed=1';
var FB_DASH_URL    = 'https://acndoaymjsa1.feishu.cn/share/base/dashboard/shrcnjg954UqVxZuMB45CR3Zmqf?embed=1';
var fbFrameLoaded  = false;

function fbSwitchTab(tab) {
  var frame = document.getElementById('fbFrame');
  var tabForm = document.getElementById('fbTabForm');
  var tabDash = document.getElementById('fbTabDash');
  if (tab === 'form') {
    tabForm.classList.add('active');
    tabDash.classList.remove('active');
    frame.src = FB_FORM_URL;
  } else {
    tabDash.classList.add('active');
    tabForm.classList.remove('active');
    frame.src = FB_DASH_URL;
  }
  fbFrameLoaded = true;
}

// 展开面板（首次展开时默认显示填写反馈）
function fbOpen() {
  document.getElementById('fbToggle').style.display = 'none';
  document.getElementById('fbPanel').classList.remove('hidden');
  if (!fbFrameLoaded) { fbSwitchTab('form'); }
}
// 收起面板
function fbClose() {
  document.getElementById('fbPanel').classList.add('hidden');
  document.getElementById('fbToggle').style.display = '';
}

// 拖拽：竖排标签 + 面板头部均可上下拖动；点击=展开，拖动=移位
// 全局单一拖拽状态 + window 级监听（Pointer Events 统一鼠标/触摸）
function fbInitDrag() {
  var panel = document.getElementById('fbPanel');
  var toggle = document.getElementById('fbToggle');
  var head = document.getElementById('fbHead');
  if (!head || !panel || !toggle) return;

  var drag = null;          // { startY, startVh, moved }
  var lastDragMovedAt = 0;  // 最近真拖拽结束时间，用于吞掉尾随 click

  function setTopVh(v) {
    v = Math.max(5, Math.min(95, v));
    panel.style.top = v + 'vh';
    toggle.style.top = v + 'vh';
  }
  function onDown(e) {
    if (e.target.classList.contains('fb-close')) return;
    drag = {
      startY: e.clientY,
      startVh: parseFloat(panel.style.top) || 50,
      moved: false
    };
    panel.classList.add('dragging');
    toggle.classList.add('dragging');
  }
  function onMove(e) {
    if (!drag) return;
    var dy = e.clientY - drag.startY;
    if (Math.abs(dy) > 4) drag.moved = true;
    var vh = window.innerHeight || 1;
    setTopVh(drag.startVh + (dy / vh) * 100);
    if (drag.moved) e.preventDefault();
  }
  function onUp() {
    if (!drag) return;
    if (drag.moved) lastDragMovedAt = Date.now();
    drag = null;
    panel.classList.remove('dragging');
    toggle.classList.remove('dragging');
  }

  head.addEventListener('pointerdown', onDown);
  toggle.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // 收起态标签：原生 click 展开；若刚发生拖拽则吞掉这次 click
  toggle.addEventListener('click', function(e) {
    if (Date.now() - lastDragMovedAt < 300) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    fbOpen();
  });
}
fbInitDrag();
