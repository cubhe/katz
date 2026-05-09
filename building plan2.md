# Building Plan 2 — Interaction System Refinement

> 不重建项目、不换框架、不改数据形状。第一轮编辑式视觉重设计已落地（见 `building plan.md`）。
> 本计划只在已有基础上打磨与扩展交互系统。

---

## 0. 现状（不要重做）

第一轮已经完成的部分（详见 `building plan.md` § 12）：
- `style.css` 已经是编辑式作品集风格（cream / ink / ochre tokens, hairline grids, 编辑式列表）
- `index.html` 已经接入：Lenis 平滑滚动 / 自定义光标 / hover-preview / reveal-on-scroll / `loadPageWithFetch` 的 `.is-leaving` & `.is-entering` 过渡 hooks
- `style.css` 中已经预留了 `.cursor*` / `.hover-preview*` / `.reveal` / `#content.is-leaving` / `#content.is-entering` 等 hook
- 所有 `render*()` / `loadPageWithFetch()` / `toggle*()` 函数体保持原样

**Phase 2 要做的就是把现有底部 IIFE 抽出去 → `enhance.js`，而不是从头再写。**

---

## 1. 设计参考（必须吸收，但不抄）

### Shopify Editions Winter 2026
- 章节式（chapter）叙事节奏
- 电影感的 page / world 感
- 微妙的 scene layering（多层背景）
- 类似产品更新文档的结构化分区
- 高端编辑式 pacing（每屏只做一件事，留白充足）

### Lusion Projects
- 统一的 motion runtime（一个 RAF 循环驱动一切）
- 跟随光标的 hover preview
- 惯性指针运动
- 滚动速度 + 指针速度 → 视觉反应（缩放、扭曲、旋转）
- 背景中的 line / curve field

### Studio Tumulte
- 动力学排版（kinetic typography）
- 自定义光标的语义标签（"Read" / "Cook" / "Play" 等）
- AJAX 风格的页面切换
- 卡片 / 图像悬停预览，带轻微 distortion
- 黑 / 米色 极简编辑系统

---

## 2. 不可逾越的约束

- 仍然 **零构建**：vanilla HTML / CSS / JS
- **不引入 React / Next / Vite / 任何 bundler**
- **不引入 Three.js / R3F**
- **不引入 WebGL**（除非显式 fallback 隔离 — 默认不做）
- 允许：vanilla JS / CSS / SVG / Canvas 2D
- **不重写**任何现有 `render*()` 函数；优先通过 `enhance.js` + CSS hook 做增强
- 所有动效继续尊重 `prefers-reduced-motion` 与触屏环境
- `data/*.json` 数据形状不变

---

## 3. 阶段任务

### Phase 1 — Stability pass（先稳定）

1. 复读 `index.html` 与 `style.css`，盘点 Phase 1 后留下的所有 race / 限制
2. 用 navigation token 修掉快速连续切页的 race（旧 setTimeout 不能影响新 transition）
3. 确保页面过渡的 cleanup 永远只服务于"自己那次"导航
4. 修掉 reveal 在 `style.opacity = '1'` inline 样式覆盖下没有 opacity 渐显的问题（思路：清掉 inline opacity，让 class 接管；或把 `style.opacity` 替换为 class 切换）
5. 用 measured `scrollHeight` 过渡替换固定 max-height（essay 1600 / section 60000 / playlist 100000）—— 在能测量的地方
6. 验证 reduced-motion / touch 退路仍然成立

### Phase 2 — Extract enhancement script

1. 把 `index.html` 底部那段 IIFE 增强脚本整体迁出到 `enhance.js`
2. 在 `<head>` 用 `<script src="enhance.js" defer></script>` 引入
3. **不动**任何 `render*()` 函数
4. `index.html` 保持 clean —— 顶部 render 逻辑 + 底部只剩很短的 cursor / preview DOM
5. 迁完后浏览器手动验证全功能仍工作

### Phase 3 — Motion runtime

1. 在 `enhance.js` 顶层引入 `motionState` 全局对象：
   - `pointer.x / pointer.y / pointer.targetX / pointer.targetY / pointer.vx / pointer.vy`
   - `scroll.y / scroll.vy`
   - `currentPage`
   - `activeHoverTarget`
2. 用 **一个** `requestAnimationFrame` 循环驱动所有动画：Lenis / 自定义光标 / hover preview / 未来的 line field
3. 删除所有重复的 RAF 循环（当前 cursor 与 hover-preview 各自有 loop —— 合并）

### Phase 4 — Scene layer

1. 在 `<body>` 加一个不可交互的 `<div class="scene-layer">`，放在 `#content` 之下
2. 内容：
   - 极淡 grain（CSS pseudo / SVG noise）
   - vignette（radial-gradient）
   - 可选的 SVG / Canvas 2D line field
3. 切页时根据 `body[data-page="..."]` 让 scene layer 微妙变体：
   - `kazhi`：安静记忆感 / 极少线条
   - `say`：归档网格 / 结构感更强
   - `cooking`：暖色 / 有机流动
   - `listening`：波形 / 节奏感
4. 增强脚本切页时给 `<body>` 设置 `data-page` 属性

### Phase 5 — Kinetic typography

1. 给关键标题加可复用的 split-line reveal：
   - `.kazhi-text`
   - `.column-title`
   - `.section-heading`
2. 实现：把行包到 `overflow: hidden` mask 容器内，子行 `translateY(100%) → translateY(0)`，逐行 stagger
3. 仅在非 `prefers-reduced-motion` 下挂载

### Phase 6 — Cursor labels

1. 扩展光标标签：
   | 触发选择器 | 标签 |
   |---|---|
   | `#navbar span` | Go |
   | `.card:not(.empty-card)` | Open |
   | `.essay-entry`（cooking 之外的列表）| Read |
   | `.essay-entry`（recipe-list-v2 内）| Cook |
   | `.playlist-title` | Play |
   | `.close-btn` | Close |
2. 优先用元素自身的 `data-cursor-label` 属性；通过选择器 → 默认值兜底
3. 没匹配的元素继续用默认 `View`

### Phase 7 — Hover preview upgrade

1. 把 hover-preview 升级成"视觉样本卡"
2. 根据 `motionState.pointer.vx / vy` 给预览块加微微旋转（≤ 6°）和位移惯性
3. art 区生成更"有内容"的视觉：基于 `data-id` / title 生成的确定性 line-art / 抽象渐变
4. 数据里如果未来有 image 字段，用 image；没有就回退到生成的 line-art
5. 触屏 / coarse pointer 仍完全不挂载

### Phase 8 — Content polish

1. 不改 JSON shape，仅在渲染时通过 `enhance.js` 注入轻量 meta：
   - say 9 宫格：在卡片上加序号 / 归档感（"NO. 03 / 2026"）
   - cooking：让 recipe 看起来像实验笔记（编号 / 状态标签 / 时间戳样式）
   - listening：让图表 / 歌单像声学档案（轨道编号 / catalog 风格）
2. 实现方式：在 enhance.js 切页 hook 之后跑一次 DOM 增强，往现有节点上 `appendChild` 装饰 span / data-attribute；**不修改 `render*()` 源码**

---

## 4. 文件改动清单

### 新建
- `enhance.js` — 从 `index.html` 迁出的增强层 + Phase 3-8 全部代码
- 可选 `scene/` 子目录存放 SVG / canvas 资源

### 修改
- `index.html` — 删掉底部 IIFE，加 `<script src="enhance.js" defer>`；保留 cursor / preview DOM；可能加 `<div class="scene-layer">`
- `style.css` — 追加 scene-layer / kinetic-type / cursor 标签 / scroll-velocity 反应等 hook；不动现有规则

### 完全保留
- `data/*.json`、`scripts/*`、`CNAME`、`README.md`、`log.md`
- `index.html` 中所有 `render*()` / `loadPageWithFetch()` / `toggle*()` / `showEssayDetail` / `closeDetail` / `renderMarkdown` / `attachEssayHandlers` 函数体
- `index.html` 中所有 HTML 结构 / `data-*` 属性 / `#detailOverlay`

---

## 5. 验收清单（每个 phase 完成后过一次）

- [ ] 浏览器开发者工具 console 无报错
- [ ] 4 个页面 + Quarters 专栏均可正常进入，弹窗 / 折叠 / tab 切换都还工作
- [ ] DevTools → Rendering → `prefers-reduced-motion: reduce` 下：动效退化为简化版本
- [ ] DevTools → Device toolbar 模拟触屏：cursor / hover-preview 不挂载，原生指针正常
- [ ] 慢网络模拟（throttling: Slow 3G）下：页面切换的 entering 动画在数据真到达时才触发，不会在空 DOM 上跑
- [ ] 快速连续点击导航：不会出现 stale class 闪烁

---

## 6. 设计取舍记录（执行中追加）

| 决策 | 理由 |
|---|---|
| 不引入 Three.js / WebGL | 零构建约束 + 项目当前不需要复杂 3D；line field 用 Canvas 2D 或 SVG 足够 |
| Phase 2 抽 `enhance.js` 优先 | 后续每个 phase 都要往里加东西；不抽出来会让 `index.html` 越来越乱 |
| Phase 3 单一 RAF | 多个 RAF 互不感知，性能 + 同步都吃亏；Lusion-style runtime 必须先有它 |
| Scene layer 用 SVG / Canvas 2D 而非 WebGL | 视觉效果上 line field / grain / vignette 用 2D 已足，且零构建 |
| Phase 8 用 DOM 增强而非改 render | 不动现有 render 函数体的硬约束；用 `appendChild` 注入装饰元素是最低侵入方式 |

---

## 7. 完成后的交付说明（每完成一个 phase 在此更新）

### 进度
- [x] **Phase 1 — Stability pass** (2026-05-02)
  - **1.2 + 1.3 — 导航 token + cleanup guard**：`wrapPageTransitions` 引入 monotonic `navId` + `pendingNavId`；760ms 清理 `.is-entering` 前先比对 `myNavId === navId`，旧导航的 cleanup 不会影响新导航
  - **1.4 — Reveal opacity**：审视后判定为上一轮的**误诊**。`style.opacity` 是设在 `#content` 父节点上的，`.reveal { opacity: 0 }` 是设在子孙上的，子节点 opacity 与父 inline opacity 独立计算（不相乘到 0），所以 reveal 的 opacity 渐显本来就在工作。已从已知限制里清掉。
  - **1.5 — Measured scrollHeight**：新增 `attachAccordionMeasure(scope)`，用 MutationObserver 监听 `.essay-entry` / `.playlist-content` 的 `class` 属性变化，`.open` 时 `body.style.maxHeight = body.scrollHeight + 'px'`。固定 max-height（essay 1600 / playlist 100000）只作 fallback。`.section-body` 仍保留 60000px hack（嵌套 accordion 重测过于复杂）。
  - **1.6 — Reduced motion + touch 复核**：所有 gate（`enableMotion` / `enableCursor` / `isTouch`）走查通过；`attachPlaylistOpenMirror` 与 `attachAccordionMeasure` 不受运动 gate 限制（属于功能性而非动画）。
  - **Codex review 收尾，3 处发现：**
    - C1（防御性 #content 重绑）：已修，`ensureObserver` 现在比对 `observedContent`，不一样就 `disconnect()` 重建。
    - C2（switchListeningTab 漏挂 accordion）：已修。把 page observer 改成 `subtree:true`，回调里区分顶层 mutation（驱动 nav transition）vs 子树 mutation（仅给新 added node 跑 idempotent attacher）。同时解决 C3。
    - C3（renderColumnView 漏挂）：被 C2 的 fix 一并解决。
- [x] **Phase 2 — Extract enhance.js** (2026-05-02)
  - 新建 `enhance.js`（~370 行）：把 index.html 底部的 IIFE 完整迁出，de-indent 为顶层模块；保留 IIFE 包装以隔离作用域和 `'use strict'`
  - `index.html` 在 `<head>` 加 `<script src="enhance.js" defer>`，紧跟 Lenis CDN 脚本之后
  - 删除 index.html 底部 ~380 行内联 IIFE 块；`</body>` 之前现在干净
  - `<script>` 数量保持 3：Lenis CDN + enhance.js + 原始 inline render 脚本
  - **不动**任何 render*() / loadPageWithFetch / toggle*() 函数体
  - **Self + codex review** 时序四问全部确认无回归：
    1. enhance.js 的 `wrapPageTransitions()` 在顶层同步运行（仍在原始 DOMContentLoaded 触发之前）→ 首次 `loadPageWithFetch('kazhi')` 仍走 wrapped 版本 ✓
    2. Lenis defer 在 enhance.js defer 之前下载/执行（document order）→ `window.Lenis` 已定义 ✓
    3. DOMContentLoaded listener FIFO 顺序：原始 first，enhance second（与之前 inline 版本一致）✓
    4. 唯一新差异：enhance.js 变成单独 network fetch，慢/失败时增强会延迟或丢失；原始 render 函数仍 inline，所以页面降级仍可用（可接受）
- [x] **Phase 3 — Motion runtime** (2026-05-02)
  - 顶层引入 `motionState`：`pointer.{targetX/Y, x/y, dx/dy, vx/vy}`、`scroll.{y, vy}`、`currentPage`、`activeHoverTarget`
  - 单一 `motionFrame` RAF：每帧依次 update 速度/平滑 pointer → Lenis raf → 采样 scroll → 跑所有 ticker；`addMotionTicker(fn)` 注册回调
  - Top-level `mousemove` 唯一负责更新 `pointer.target`（cursor / preview / 未来 scene 全读这一处）
  - **删除原有 3 个 RAF 循环**（initSmoothScroll、initCursor、initHoverPreview 各自的 loop）
  - `initCursor` / `initHoverPreview` 改为只 mount DOM listener + `addMotionTicker(...)`
  - `wrapPageTransitions` 在 nav 触发时 `motionState.currentPage = pageName`
  - cursor 的 mouseover delegate 同时维护 `motionState.activeHoverTarget`
  - **Self + codex review 各跑一次：**
    - Codex 唯一新发现：scroll 采样跑在 `lenisInstance.raf(t)` **之前**，导致 ticker 看到上一帧的 scroll 值。**已修**：把 lenis raf 调用移到 scroll 采样之前。
    - 其它 6 个检查项（TDZ / cursor 可见性 / hover preview 数学等价 / activeHoverTarget 契约 / Lenis 调度 / RAF 唯一性）codex 确认无回归。
- [x] **Phase 4 — Scene layer** (2026-05-02)
  - `index.html` 在 `<body>` 之首加 `<div class="scene-layer">`，含 `.scene-canvas` + `.scene-grain` + `.scene-vignette`
  - `style.css` 新增 § 4.5 Scene layer：固定全屏 z-index:0、SVG fractal noise grain（multiply blend）、radial vignette、`body[data-page="X"] .scene-canvas` 控制每页 opacity；`#content` 加 `position:relative; z-index:1`；reduced-motion + coarse-pointer 媒体查询都把 `.scene-canvas` `display:none`
  - `enhance.js` 新增 `initSceneLayer()`：canvas resize + DPR 处理、4 个 PAINTERS（kazhi 静默横线 / say 归档网格 / cooking 暖色有机曲线 / listening 节奏正弦波），通过 `addMotionTicker` 注册；painters 读 motionState.pointer + scroll.vy
  - `wrapPageTransitions` 维护 `motionState.currentPage` + `body.dataset.page`
  - **Self + codex review，codex 抓到 2 个我漏掉的问题：**
    - **High**：Scene 切页过早 —— wrapPageTransitions 在 `original.apply` 之前就 commit 新 page，但实际 DOM 替换是异步 fetch 之后。导致旧内容还在淡出时新场景已经出现；fetch 失败时场景仍 commit。**已修**：把 `motionState.currentPage` + `body.dataset.page` 移到 `onPageRendered`，只在 `pendingNavId` 匹配 + DOM 真正落地后才 commit。新增 `pendingPageName` 跟踪本次 nav 的目标页。
    - **Low**：`e.clientX/Y` 离开视口时可能为负或超过 innerWidth/Height，painter 中的 `pointer.x/y` 归一化后可能超出 [-0.5, 0.5]，使线条偏移过大。**已修**：在顶层 `mousemove` 监听里 clamp 到视口范围。
- [x] **Phase 5 — Kinetic typography** (2026-05-02)
  - `style.css` § 15.5 新增 `.kt-mask` / `.kt-inner` / `.is-typed` / `.kt-run`：每字符 inline-block + overflow:hidden mask，子 inner 从 translateY(110%) 滑入 0；`transition-delay: calc(var(--kt-i,0) * 28ms)` 做 stagger；reduced-motion 强制 `transform:none`
  - `enhance.js` 新增：`kineticObserver`（独立 IntersectionObserver）+ `splitElementText` + `initKineticType`；只处理 `.kazhi-text / .column-title / .section-heading`；通过 `__ktDone` 防重入；从 `attachToAddedNodes` / `onPageRendered` / bootstrap 初始 pass 三处入口都调用
  - `splitElementText` 只切 text node，**保留** element children（cooking 的 `<span class="toggle-icon">+</span>` 不会被拆掉）
  - **Self + codex review，codex 抓到 1 个 high 漏诊：**
    - Cooking 的 `.section-heading.toggle-section` 是 `display:flex; justify-content:space-between` 行；如果直接把每个字符变成顶层 .kt-mask span，每个字都会成为独立 flex item，space-between 把它们摊开整行。**已修**：把连续 text-derived spans 包到一个 `.kt-run` 容器里，flex 父级仍只看到 [text-run, toggle-icon] 两个项。
  - 其它检查项（点击事件穿透到 `<h3>`、`__ktDone` 防双初始化、detail overlay 不在 KINETIC_TARGETS、字符空格保留以维持换行）codex 都确认无回归。
- [x] **Phase 6 — Cursor labels** (2026-05-02)
  - **CSS**：generalize 标签可见性到 `.cursor.has-label`；新增 `.cursor.is-link.has-label .cursor__label` 让 link-mode chip 更小更轻
  - **JS resolver**：`CURSOR_LABEL_RULES` 选择器表 + `resolveCursorTarget()`；优先 `closest('[data-cursor-label]')`，再走规则表（最具体的 `.read-full` / `.breadcrumb` / `.close-btn` / `.lt-tab` / `.playlist-title` / `#navbar span` 走 link mode；`.recipes-section .essay-entry` / `.essay-entry[data-source="recipe"]` → `Cook`、`.essay-entry` → `Read`、`.card` → `Open` 都走 project mode）
  - **HTML**：navbar 4 个 span 加 `data-cursor-label="Go"`，close-btn 加 `data-cursor-label="Close"`（render 函数文件全部不动）
  - **Ticker**：每帧读 `cursor.classList.contains('is-project')` 决定 label 居中 vs 偏移 -40px
  - **Self + codex review，codex 提了 2 个 low：**
    1. project ↔ link 切换时 label 立即从 center 跳到 -40，而 ring 是 320ms CSS transition → 视觉 snap。**已修**：`labelOffsetY` lerp 0.18，与 ring 形变同步过渡。
    2. `data-cursor-label` 永远胜过 selector match（即使 ancestor 远于 selector 命中的元素）—— **暂不修**：当前 DOM 没有这种结构；spec 也定 "data 属性是主信号"。
  - 其它（resolver order 在 cooking/recipes 的优先级正确、breadcrumb 不被 essay rule 遮蔽、activeHoverTarget 仍只在 project mode 写入、hover-preview 不依赖 activeHoverTarget）codex 已确认。
- [x] **Phase 7 — Hover preview upgrade** (2026-05-02)
  - **CSS**：去掉 `.hover-preview` 的 `transform` transition（JS 每帧写入 transform，CSS transition 会反向干扰）；`.is-active` 不再设 transform，由 JS 完全接管
  - **JS deterministic art**：用 `mulberry32(hashStr(id))` PRNG 替换原 PALETTE/gradientFor，新增 4 种 SVG generator（concentric arcs / diagonal cross-hatch / sine-wave field / hairline stack），STROKE 三色低 alpha；viewBox `0 0 100 100`，`preserveAspectRatio="xMidYMid slice"`
  - **JS image hook**：`target.getAttribute('data-image')` 优先；当前 JSON 无此字段，全部 fallback 到 generated SVG。预留接口给将来加 image
  - **JS velocity-driven rotation**：每帧 `target = clamp(±8, vx * 0.15)` / `-vy * 0.15`，rotX/rotY lerp 0.18；transform 包 `perspective(900px)`
  - **Self + codex review，codex 抓到 3 个 self review 漏诊：**
    1. **viewBox 100×130 + slice** 在 ~240×220 art 区域裁掉了上下各 ~46px。**已修**：viewBox 改为 100×100，generators 全部更新到 100×100 坐标
    2. **mouseover 冒泡**：从子节点（如 .card 内的 kt-mask span）触发会反复 re-run `show()`，每次重新生成 SVG 写 innerHTML。**已修**：`currentTarget` 缓存，目标不变时只更新 active 状态、不重建 SVG
    3. **ROT_GAIN 0.45 在 ~18 px/frame 处饱和**，正常桌面移动就被 pin 在 ±8°。**已修**：降到 0.15，让旋转保持"微妙"
  - 其它（mulberry32 在 seed=0 时无 degenerate / data-image hook / grain overlay / 首次显示无 flash）codex 已确认无新回归
- [x] **Phase 8 — Content polish** (2026-05-02)
  - **JS**：新增 `applyContentPolish()`，从 `document` 全局扫描 3 类目标，幂等（`__cpArch / __cpNote / __cpVol`）：
    - say 9 宫格非空 card → top-right `/ NN` chip（与现有 `::before` 计数 "01" 在 top-left 配对成 "01 / 09"）
    - cooking `.recipes-section .essay-entry` → `.essay-header` 第一项加 `NOTE NNN` mono 徽章
    - 所有 `.playlist-section`（含 by-year / by-artist tab）→ `.playlist-title` 第一项加 `VOL. NN` mono 前缀
  - **CSS**：新增 § 15.6 Content polish — `.cp-archive`（绝对定位 top-right）、`.cp-note`、`.cp-vol`（mono / 10-11px / `--ink-faint`，`flex: 0 0 auto`）
  - **Self + codex review，codex 抓到 3 个：**
    1. **Medium**：原本在 `attachToAddedNodes` 和 `onPageRendered` 都调了 `applyContentPolish()`，加上自身 `appendChild` 触发的 observer 回弹，每次 nav 实际跑了 2-N 次冗余 pass。**已修**：`applyContentPolish()` 移到观察器回调最外层，整批只跑 1 次；non-MO fallback 的 setTimeout 里也单独调一次。
    2. **Low**：`.essay-title` 是 `flex: 1` 但没 `min-width: 0`，加上 `NOTE NNN` 前缀后长配方标题会挤压尾部 tag/toggle。**已修**：`.essay-title` 加 `min-width: 0`。
    3. **Low**：`.playlist-title` 同样的问题，by-artist 长艺人名 + VOL 前缀 + count + `+` 可能挤爆窄屏。**已修**：加 `flex-wrap: wrap` 让它换行。
  - 其它（switchListeningTab 重置编号、`.cp-archive` 与 `::before` 计数器不冲突、cursor-label 资源解析未受影响）codex 已确认。

### 改动的文件
- **Phase 1**：`index.html` 底部 IIFE：`wrapPageTransitions` 重写（subtree observer + navId + 防御性 rebind）；新增 `attachAccordionMeasure`；bootstrap 的初始 pass 也加上 accordion measurement
- **Phase 2**：新建 `enhance.js`（370 行 IIFE）；`index.html` 删除底部 IIFE，`<head>` 加 `<script src="enhance.js" defer>`
- **Phase 3**：`enhance.js` 顶部新增 motionState + motionFrame + addMotionTicker（约 +100 行，删 ~30 行旧 RAF 代码，净 +70）；3 个模块 RAF 合一；`wrapPageTransitions` + cursor mouseover 都开始写 motionState
- **Phase 4**：`index.html` 加 scene-layer DOM；`style.css` 新增 § 4.5 Scene layer + reduced-motion / coarse-pointer 下 `.scene-canvas { display:none }`；`enhance.js` 新增 `initSceneLayer` + 4 个 PAINTERS（约 +120 行）；page-commit 时机修正
- **Phase 5**：`style.css` § 15.5 Kinetic typography（约 +30 行）；`enhance.js` 新增 `initKineticType` + `splitElementText` + `kineticObserver`（约 +90 行）；text-run 用 `.kt-run` 包裹以保 flex 行为
- **Phase 6**：`style.css` cursor 段加 `.has-label` + `.is-link.has-label` rule（约 +15 行）；`enhance.js` initCursor 替换 mouseover delegate 为 `CURSOR_LABEL_RULES` + `resolveCursorTarget()` + label 偏移 lerp（约 +50 行）；`index.html` 静态 navbar / close-btn 加 `data-cursor-label`
- **Phase 7**：`style.css` `.hover-preview` 去掉 transform transition；`enhance.js` initHoverPreview 替换为 mulberry32 + 4 个 SVG generator + 速度驱动 perspective rotation（约 +120 行）
- **Phase 8**：`style.css` § 15.6 Content polish + `.essay-title { min-width: 0 }` + `.playlist-title { flex-wrap: wrap }`（约 +30 行）；`enhance.js` 新增 `applyContentPolish()`（约 +60 行），重构 observer 回调把 polish 调用从 per-mutation 收敛到 per-batch
- 没动任何 `render*()` / `loadPageWithFetch` 函数体

### 完全保留
- `data/*.json`、`scripts/*`、`CNAME`、`README.md`、`log.md`
- `index.html` 顶部所有 render*() / loadPageWithFetch / toggle*() / showEssayDetail / closeDetail / renderMarkdown / attachEssayHandlers 函数体
- 所有 HTML 结构 / data-* 属性 / `#detailOverlay`

### 如何运行 / 测试
本机的 `python` 是 Microsoft Store 占位符，必须用 `py`：
```bash
cd "E:\OneDrive - University of California, Davis\PhD\Projects\website"
py -m http.server 8000
# 浏览器开 http://localhost:8000
```

每完成一个 phase 跑一次 § 5 的验收清单。

### 已知限制（执行中追加）
- WebGL：**未实现**，且本计划不打算实现。Scene layer 一律走 SVG / Canvas 2D。
- Phase 1 的 `attachAccordionMeasure`：在每次页面切换时给新的 `.essay-entry` / `.playlist-content` 加 MutationObserver，旧的不显式 disconnect（会随节点 GC 被清理）。同 Phase 1 之前的 `attachPlaylistOpenMirror`，对会话级使用够用。
- Phase 1 没动 `.section-body` 的 60000px CSS hack —— 嵌套 accordion 切换时再做 measured scrollHeight 会引发回弹问题，留给 Phase 7 / 8 真有需要时再处理。
- Phase 4 Scene canvas 在 'quarters' 页（通过 say 列 hub 进入，不走 loadPageWithFetch）会保留上一次 `body.dataset.page = 'say'` 的网格效果；视觉上仍连贯（quarters 是 say 子专栏），但严格意义上 quarters 没有自己的 painter。后续如果想要专栏视图独立场景，可在 `loadColumn` 周围加 hook。
- Phase 4 fetch 失败时 catch 分支仍会写 `content.innerHTML = '<p class="error">页面加载失败</p>'`，触发 MutationObserver → 场景仍 commit 到目标页。这是有意为之：用户已经触发了导航，新场景背景比"卡在旧页"更直观；错误信息显示在内容区。
- Phase 5 拉丁文 / 短英文标题（如未来可能加的 "Wishlist"、其它英文 section heading）按字符切分会丢失字间距 / kerning，视觉上每个字母独立。中文目标（kazhi-text、column-title 主体）不受影响。如果以后要给纯英文标题做 word-level split，可以扩展 `splitElementText` 加判断分支。
- Phase 8 `applyContentPolish()` 在 quarters 子专栏（不走 loadPageWithFetch，是 column-view 的 `.essay-list`）会被 attachToAddedNodes 触发的 observer 拉一次 polish；但 quarters entries 不在 `.recipes-section` 内，所以不会被错配 "NOTE NNN"。如果以后想给 quarter entries 加自己的 "TERM NN" 装饰，扩展 `applyContentPolish` 加一条规则即可。

---

## 13. 全部交付（2026-05-02）

8 个 phase 全部完成。整个 building plan2 在不重建项目、不引入 bundler / Three.js / WebGL、不改任何 `render*()` 函数体、不改 JSON 形状的前提下落地。

**新增 / 修改的文件：**
- `enhance.js`（新增，~870 行）：所有交互增强
- `index.html`：仅 `<head>` 加 2 行 defer script、`<body>` 头加 scene-layer DOM、navbar 4 个 span 加 `data-cursor-label`、close-btn 加 `data-cursor-label`
- `style.css`（追加 ~210 行）：§ 4.5 Scene layer、§ 15.5 Kinetic typography、§ 15.6 Content polish、cursor 段加 has-label rule、min-width 与 flex-wrap 修复

**保留：** `data/*.json`、`scripts/*`、`CNAME`、`README.md`、`log.md`、`index.html` 顶部所有 render*() / loadPageWithFetch / toggle*() / showEssayDetail / closeDetail / renderMarkdown / attachEssayHandlers 函数体。

**8 phase × 2 reviewer × N 修复：** Codex review 跑了 8 次，每次都至少抓到 1 个 self-review 漏掉的真实问题，全部已在对应 phase 里 inline 修复。最重要的几个：
- Phase 4 scene 切页过早（page commit 时机）
- Phase 5 cooking flex-heading 字符摊开（`.kt-run` 包裹）
- Phase 7 viewBox 100×130 在宽 art 区裁掉 ~46px（改 100×100）+ mouseover 冒泡重生 SVG（currentTarget 缓存）
- Phase 8 polish 调用冗余多倍（合并到 observer 回调最外层）

### Reflection 流程
和上一轮一致：写完代码 → self-review → `codex exec -s read-only "..." < /dev/null > 文件名 2>&1`（必须 `< /dev/null`，不要用 `| tail`）→ 合并两份分析。
