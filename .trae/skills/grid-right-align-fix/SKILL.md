---
name: "grid-right-align-fix"
description: "排查并修复 CSS Grid 布局中右侧元素错位/挤行问题。当用户反馈'右侧元素没贴右''太挤''错位''换行'或元素位置不符合预期时调用。"
---

# Grid 右侧对齐错位修复

## 适用场景

当 Grid 布局行中右侧元素（徽章/药丸/操作按钮等）出现以下症状时：
- 右侧元素紧跟左侧内容，没有贴到行右边缘
- 右侧元素被挤到下一行
- 右侧有多余空白列
- 调整列宽后仍不对齐

## 根因排查清单（按优先级）

### 1. 绝对定位元素不占 Grid 轨道（最常见）

**症状**：Grid 定义了 N 列，但实际在流子元素只有 N-1 个，因为某个子元素是 `position: absolute`（如编辑按钮、删除图标），不参与 Grid 轨道分配。

**诊断方法**：
```javascript
// 在浏览器控制台执行
const row = document.querySelector('.target-row');
const cols = getComputedStyle(row).gridTemplateColumns.split(' ').length;
const inFlow = Array.from(row.children).filter(c => getComputedStyle(c).position !== 'absolute').length;
console.log(`定义列数: ${cols}, 在流元素: ${inFlow}`);
// 如果 cols > inFlow，说明轨道数多于实际元素数
```

**修复**：减少 Grid 列定义，使列数 = 在流子元素数。绝对定位元素不需要自己的轨道。

### 2. `1fr` 轨道未加 `minmax(0,...)`

**症状**：左侧标题或长文本内容撑开 `1fr` 轨道，把右侧 `auto` 轨道推出容器或挤到下一行。

**修复**：`1fr` → `minmax(0, 1fr)`，允许该轨道收缩到 0 而非按内容撑开。

### 3. `auto` 轨道宽度不足

**症状**：右侧元素内容宽度超过 `auto` 轨道计算宽度，导致换行或溢出。

**诊断**：
```javascript
const cat = row.querySelector('.tb-cat');
console.log(`scrollWidth: ${cat.scrollWidth}, clientWidth: ${cat.clientWidth}`);
// scrollWidth > clientWidth 说明内容溢出
```

**修复方案**：
- 如果轨道是 `auto`：改为 `max-content` 或增大固定宽度
- 如果多列共享空间：给右侧轨道 `min-content` 或具体 `px`

### 4. 父容器 `flex-wrap` 或 `overflow` 干扰

**症状**：Grid 行本身正常，但外层 flex 容器 `flex-wrap: wrap` 导致整行被折断。

**修复**：确保外层容器 `flex-wrap: nowrap` 或改用 `display: block`。

## 稳定模板：左标题 + 右药丸/徽章

当需要"左侧标题占满剩余 + 右侧元素贴右且不换行"时，使用以下结构：

### HTML
```html
<div class="row">
  <span class="edit-btn" style="position:absolute; top:4px; right:4px;">✏</span>
  <span class="idx">1</span>
  <span class="date">9.2</span>
  <span class="title">标题文本</span>
  <span class="cat">维度标签</span>
</div>
```

### CSS
```css
.row {
  display: grid;
  /* 关键：列数 = 在流元素数（绝对定位元素不占轨道） */
  grid-template-columns: 32px 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  position: relative;          /* 为绝对定位按钮提供定位上下文 */
}
.title {
  /* minmax(0,1fr) 已允许收缩，但如需截断再加： */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat {
  /* 右侧元素：不换行、不收缩 */
  white-space: nowrap;
  flex-shrink: 0;
}
```

### 验证断言
```javascript
// 所有行的右侧元素右缘与行右内边距对齐
const rows = document.querySelectorAll('.row');
const gaps = Array.from(rows).map(r => {
  const cat = r.querySelector('.cat');
  const rr = r.getBoundingClientRect();
  const rc = cat.getBoundingClientRect();
  return Math.round(rr.right - rc.right - 14); // 14 = padding-right
});
const allAligned = gaps.every(g => g <= 2);   // 容差 2px
console.log(allAligned ? 'PASS' : 'FAIL', gaps);
```

## 反模式（禁止）

| 做法 | 问题 |
|------|------|
| 给绝对定位元素分配 Grid 轨道 | 轨道空置，后续元素错位 |
| 用 `1fr` 不加 `minmax(0,...)` | 长内容撑开轨道，右侧被挤 |
| 多次调 `width`/`margin` "推位置" | 补丁式迭代，不稳定 |
| 仅改 inline style 不改 grid-template | 治标不治本，换内容就回退 |

## 排查流程

1. **先数列数 vs 在流元素数**：不一致 → 减列（最常见根因）
2. **检查 `1fr` 是否有 `minmax(0,...)`**：没有 → 加上
3. **检查右侧元素 `scrollWidth > clientWidth`**：是 → 增大轨道或改 `max-content`
4. **检查外层容器 `flex-wrap`**：`wrap` → `nowrap`
5. **验证**：用 `getBoundingClientRect()` 断言所有行右缘对齐
