# Building Plan — Visual & Interaction Redesign

> 在不重写项目、不更换框架、不改动内容/路由的前提下，给现有网站套一层"高端编辑式作品集"风格的视觉与动效。

---

## 0. 工作原则

- **不重建项目**、**不替换框架**、**不删除/重写已有内容**（除非小的格式修正）
- **不改动**：核心信息、项目标题、路由、链接、页面结构、数据源
- 只重做：**视觉层**（颜色/排版/间距/布局节奏）+ **交互层**（动效/光标/页面过渡/hover 预览）
- 保持纯 HTML/CSS/JS 的零构建栈，避免引入打包器或框架
- 所有动效必须尊重 `prefers-reduced-motion` 与触屏环境

---

## 1. 现有代码盘点

### 技术栈
- **框架 / 样式方法**：纯 vanilla HTML + CSS + 内联 JS（无构建工具）
- **字体**：Cormorant Garamond + Noto Serif SC（Google Fonts）
- **入口**：单文件 `index.html`（约 1184 行），所有渲染函数都内联在 `<script>` 中
- **样式**：单文件 `style.css`（约 1402 行），现有为侘寂灰白渐变风

### 页面（全部 swap 进 `#content`，无真实路由）
| data-page | 中文名 | 内容 |
|---|---|---|
| `kazhi` | 咔滋 | 单条微博记忆，按访问规则随机抽取 |
| `say` | 咔言咔语 | 3×3 专栏 hub → 专栏视图 → 详情弹窗 |
| `cooking` | Deep Cooking | philosophy + 迷思（essays）+ 菜谱（按分类）+ wishlist |
| `listening` | Deep Listening | 4 个 tab：歌单 / 听歌画像 / 按年份 / 按艺人 |
| `quarters` | PhD Quarters | 通过专栏 hub 进入 |
| `#detailOverlay` | （共享）| 长文阅读弹窗，含 markdown 渲染 |

### 内容数据源（保持不动）
`data/columns.json`、`cooking.json`、`kazhi.json`、`quarters.json`、`weibo.json`、`weibo2.json`、`liked.json`、`liked-stats.json`、`listening.json` 等。
入口：`loadPageWithFetch(pageName)`。

### 必须保留（不改动）
- `data/`、`scripts/`、`CNAME`、`README.md`、`log.md`
- 所有 `render*()` 函数（`renderKazhi` / `renderSayGrid` / `renderCooking` / `renderListening` / `renderQuarters` / `renderColumnView` / `renderEssayEntry` 等）
- `loadPageWithFetch()`、`togglePlaylist()`、`toggleSection()`、`showEssayDetail()`、`renderMarkdown()`
- `#navbar` 的 4 个 `data-page` 项与点击逻辑
- `#detailOverlay` 弹窗 DOM 结构与生命周期
- 所有 JSON 数据形状

### 可改动（视觉重设计目标）
- `style.css`：**整文件重写**
- `index.html`：**最小化追加** —— 仅在底部加入：
  - 一个自定义光标 `<div>`
  - Lenis CDN 引入与初始化
  - 一段封装的增强脚本（reveal / cursor / preview / transition），不动现有渲染函数
- 唯一对现有 JS 的"打洞"：在 `loadPageWithFetch` 的 fade-out / fade-in 时机周围挂上 `.is-leaving` / `.is-entering` class，便于 CSS 控制过渡动画

---

## 2. 视觉系统（Visual System）

### 调色板
| 角色 | 值 | 说明 |
|---|---|---|
| 背景 | `#f5f0e6` | 暖奶油 / off-white |
| 主文字 | `#1a1a14` | 近黑（带极轻橄榄调） |
| 次要文字 | `#6b675e` | 中性灰，用于 metadata |
| 弱化文字 / 占位 | `#9b958a` | 更浅的灰 |
| 分割线 | `#e6dfd1` | 极细米色描边 |
| 强调色 | `#a85a3a` | 克制的赭橙 / Claude 橙的降饱和版本，仅用于 hover、active、关键标签 |
| 微高亮底色 | `rgba(168, 90, 58, 0.06)` | hover row 背景 |

### 排版层级
| 层级 | 字体 | 大小（响应式） | 用途 |
|---|---|---|---|
| Display / Hero | Cormorant Garamond 300 | `clamp(56px, 9vw, 132px)` | 页面入口大标题 |
| Section H2 | Cormorant Garamond 300 | `clamp(36px, 5vw, 64px)` | 专栏标题 / 大区段标题 |
| Project / Essay Title | Cormorant Garamond 400 | `clamp(22px, 2.4vw, 32px)` | 列表项标题，强视觉重量 |
| Body | Noto Serif SC 400 | 16-17px | 长文与摘要 |
| Metadata | Cormorant Garamond italic 或 monospace | 11-13px，uppercase + letter-spacing | 年份 / 分类 / 角色 / 标签 |
| Nav | Cormorant Garamond 400 | 14-15px | 导航文字（带数字编号 01/02/03） |

### 间距节奏
8 / 16 / 24 / 40 / 64 / 96 / 144。  
区段之间至少 96px，列表项之间 24-40px。Hero 与首屏内容之间至少 144px。

### 布局
- 12 列网格意识，但实际用 CSS Grid 与 max-width 控制
- 内容主区 `max-width: 1280px`，编辑容器 `max-width: 720-820px`
- 顶部细线导航：左侧 logo / 站点名，右侧 4 个页面项 + 序号编号（编辑感）
- 区段之间用 1px 米色细线分隔，避免颜色块或大色面

---

## 3. 动效系统（Motion System）

### 入场（页面打开时）
- **Hero 标题**：mask reveal —— 文字下方有一个 `overflow: hidden` 容器，文字 `translateY(100%)` → `translateY(0)`，分行/分字 stagger，每行 60ms
- **副信息**：opacity + translateY(20px) → 0，延迟 400ms
- **缓动**：`cubic-bezier(0.7, 0, 0.2, 1)`（编辑式的缓动，慢入慢出）

### 列表显现
- 使用 `IntersectionObserver` 给 `.card` / `.essay-entry` / `.song-item` / `.chart-row` 加 `.is-visible` class
- 默认状态 `opacity: 0; transform: translateY(24px)`
- 进入视口后过渡到 `opacity: 1; transform: translateY(0)`，过渡 800ms
- stagger：在父容器内按 `nth-child` 加 `transition-delay: calc(var(--i) * 60ms)`，最多到 600ms

### Hover
- 链接：从下而上的下划线扫描（`background-image: linear-gradient` + `background-size` 切换）
- 项目项：标题轻微 `translateX(8px)`，metadata 同步移动，整体行 hover 时露出右侧"→"图标
- 卡片：边框由透明 → 赭橙，阴影从 0 → 极轻

### 区段过渡
- 当 `loadPageWithFetch` 切页时：
  - 当前页 `#content` 加 `.is-leaving` → 内容向上 mask 出，opacity 同步降
  - 数据加载完成后注入新 HTML
  - 加 `.is-entering` → 新内容向上 mask 入
- 整个过程 ≈ 700ms，避免白闪

### 缓动函数池
```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-edit:     cubic-bezier(0.7, 0, 0.2, 1);
--ease-soft:     cubic-bezier(0.25, 0.1, 0.25, 1);
```

---

## 4. 平滑滚动（Lenis）

- 通过 CDN 引入：`https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js`
- 仅在 **非触屏 + 非 prefers-reduced-motion** 时启用
- `lerp: 0.1`、`smoothWheel: true`
- 与原有锚点、`#detailOverlay` 弹窗滚动隔离（弹窗内不接管）
- 移动端完全跳过，使用浏览器原生滚动

---

## 5. 自定义光标（Custom Cursor）

### DOM
```html
<div class="cursor" aria-hidden="true">
  <div class="cursor__dot"></div>
  <div class="cursor__ring"></div>
  <div class="cursor__label"></div>
</div>
```

### 状态
| 状态 | 触发 | 表现 |
|---|---|---|
| default | 默认 | 6px 实心圆点 + 32px 描边圆环 |
| link | hover `a`、`#navbar span`、`.read-full`、`.lt-tab` | 圆环放大到 56px，描边加粗 |
| project | hover `.card:not(.empty-card)`、`.essay-entry` | 圆环显示 "View" 文字 |
| drag | （目前无可拖拽区域，先预留 class） | 显示 "Drag" |

### 实现
- `mousemove` 记录目标坐标，每帧 `requestAnimationFrame` 用 `lerp(current, target, 0.18)` 逼近
- `pointer-events: none`，绝对不会拦截点击
- **触屏检测**：`('ontouchstart' in window) || matchMedia('(pointer: coarse)').matches` → 不挂载
- **prefers-reduced-motion** → 不挂载

---

## 6. 项目悬停预览（Project Hover Preview）

### 适用范围
- `.card:not(.empty-card)`（咔言咔语 9 宫格）
- `.essay-entry`（迷思 / 菜谱 / 专栏列表 / quarters）

### 行为
- 鼠标移入项目时，固定容器内显示一个 240×320 的预览块跟随光标
- 预览块内容：
  - 顶部：项目标题（大号）
  - 中部：占位视觉（**因为没有图**：根据 `data-id` hash 生成的抽象渐变 + 极细线条网格）
  - 底部：tag / 分类
- 跟随：`lerp(current, target, 0.12)`，偏离光标右下 24px
- 进出：`scale(0.96) → scale(1)` + `opacity 0 → 1`，180ms
- 移动端：完全不挂载（用 `matchMedia('(pointer: fine)')` 判断）

### 占位视觉系统
为每个项目从 ID 生成稳定的伪随机参数：
- 渐变角度 0-360°
- 主色：在赭橙 / 深橄榄 / 暖灰 三色族中选一个
- 叠加：3-5 条极细水平线（模拟编辑式 grain）

---

## 7. 页面过渡（Page Transitions）

### 现有机制
`loadPageWithFetch` 已有 `opacity` fade（300ms）。**保留这套调度**，只做增强。

### 新增
1. 在 `loadPageWithFetch` 开头，给 `#content` 加 `.is-leaving`：
   ```css
   #content.is-leaving > * {
     transform: translateY(-12px);
     opacity: 0;
     transition: 320ms var(--ease-edit);
   }
   ```
2. 数据加载 + DOM 替换后，给 `#content` 加 `.is-entering`：
   ```css
   #content.is-entering > * {
     animation: pageEnter 700ms var(--ease-edit) backwards;
   }
   ```
3. `pageEnter` keyframe：从 `translateY(20px) + opacity 0` 到 `0/1`，子元素带 stagger
4. **避免白闪**：背景色统一为 `#f5f0e6`，过渡过程中 `#content` 不消失，仅子元素动

### 不引入路由库
不会引入 React Router / Vue Router 等。继续用现有的 4-tab 切换。

---

## 8. 性能与可访问性

### 性能
- **不**改动渲染逻辑，因此性能基线不变
- Lenis 仅 ~6KB，CDN 引入
- 自定义光标和预览：用 `transform` + `will-change`，单帧 RAF
- IntersectionObserver 用于懒触发动画，避免初始一次性触发所有
- 网易云 iframe 仍然懒加载（保留现有 `data-src` 机制）

### 可访问性
- `prefers-reduced-motion: reduce` → 关闭 Lenis、关闭自定义光标、所有过渡降为 100ms 简单 opacity
- 自定义光标 `pointer-events: none`，永不阻挡点击
- 保留 `<button>`、`<nav>`、`<h2-h4>` 等语义标签
- 键盘 tab 焦点可见：所有可交互元素带 `:focus-visible` 描边
- 弹窗保持 ESC 关闭、点击遮罩关闭
- 颜色对比度：主文字 `#1a1a14` on `#f5f0e6` ≈ 14.8:1，远超 WCAG AAA

---

## 9. 代码组织

### 不强行模块化（保持单文件零构建）
但在 `index.html` 底部新加的 `<script>` 中按"小工具"分块：

```js
// === Reveal observer ===
function initReveal() { ... }

// === Custom cursor ===
function initCursor() { ... }

// === Hover preview ===
function initHoverPreview() { ... }

// === Page transition hooks ===
function wrapPageTransitions() { ... }

// === Lenis smooth scroll ===
function initSmoothScroll() { ... }

// === Bootstrap ===
document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initCursor();
  initReveal();
  initHoverPreview();
  wrapPageTransitions();
});
```

每块都内置 reduced-motion / touch 短路。

### CSS 组织
`style.css` 按段落注释分区：
1. Tokens / variables
2. Reset & base
3. Typography
4. Layout primitives
5. Navigation
6. Hero / kazhi
7. Grid hub (say)
8. Column / essay list
9. Cooking
10. Listening (tabs / charts / playlists)
11. Detail overlay
12. Cursor
13. Hover preview
14. Transitions
15. Responsive overrides
16. Reduced motion overrides

---

## 10. 文件改动清单

### 重写
- `style.css` — 完全重写为新视觉系统

### 最小化追加
- `index.html`
  - `<head>` 加 Lenis CDN `<script>`（defer）
  - `<body>` 末尾加 `<div class="cursor">` + `<div class="hover-preview">`
  - `<body>` 末尾追加一段封装的增强 `<script>`（不动任何现有渲染函数）
  - `loadPageWithFetch` 内部 2 处轻量挂 class（`.is-leaving` / `.is-entering`）

### 完全保留（不动）
- `data/*.json`
- `scripts/*`
- `CNAME`、`README.md`、`log.md`
- 所有 `render*()` / `loadPage*()` / `toggle*()` / `showEssayDetail` / `renderMarkdown` / `attachEssayHandlers` 等函数体
- 所有 HTML 结构（导航、`#content`、`#detailOverlay`）
- 所有 `data-page`、`data-column`、`data-id`、`data-source` 等数据属性

---

## 11. 取舍说明

| 决策 | 理由 |
|---|---|
| **不引入 GSAP / Framer Motion** | 项目零构建，引入 GSAP 需要打包；CSS transition + IntersectionObserver 足以实现编辑式动效；如需更强编排可后续追加 |
| **保留 Cormorant + Noto Serif SC 不换字体** | 已有的衬线字体本身适合编辑式风格，省去字体加载/版权问题 |
| **保留 #detailOverlay 弹窗形态** | 是核心阅读场景，重做会改变内容架构；只重做其内部排版 |
| **9 宫格保留但去掉 3D 翻转** | 3D 翻转偏 wabi-sabi 装饰风，与编辑式作品集冲突；改为 hover 时下划线 + 标题位移 + 预览块 |
| **强调色用降饱和的赭橙** | 沿用既有 Claude orange 基础但调暗，避免 SaaS 感；只在 hover、active、关键标签出现 |
| **Lenis 而非自写惯性滚动** | Lenis 体积极小（~6KB）、文档成熟、可一行禁用 |

---

## 12. 完成后的交付说明

### 进度 (2026-05-02)
- [x] **Stage 1 — `style.css` 完全重写**（编辑式作品集风格）
  - 全新 token 系统：`--bg #f5f0e6` / `--ink #1a1a14` / `--accent #a85a3a` / 排版 / 间距 / easing
  - 导航：sticky + 编辑感序号编号 + scaleX 下划线
  - Kazhi：mask-reveal 排版，左对齐 pull-quote
  - 9 宫格：去掉 3D 翻转，改为编辑式 hairline 网格 + 标题位移 + arrow tease
  - Essay/Cooking/Quarters 列表：统一 hairline 列表，hover 整行上 accent 微底色
  - Listening：tabs + 用 1px hairline bar 替代渐变填充，stagger 进场
  - Detail overlay：blur backdrop + paper card + 90° 关闭按钮旋转
  - 新增 hooks：`.cursor*`、`.hover-preview*`、`.reveal`、`#content.is-leaving`、`#content.is-entering`
  - Reduced motion + coarse pointer 媒体查询完整覆盖
  - Codex review + self review 后修正：`--ink-faint` 加深至 `#857f74` 修正小字对比度；`color-mix()` 加 rgba fallback；`.essay-body` max-height 800→1600px
- [x] **Stage 2 — `index.html` 增强层**
  - `<head>` 加 Lenis CDN（defer）
  - `<body>` 末尾追加自定义光标 DOM + hover-preview DOM
  - IIFE 增强脚本：`initSmoothScroll` / `applyRevealTo` / `initCursor` / `initHoverPreview` / `wrapPageTransitions` / `attachPlaylistOpenMirror`
  - 全部能力检测：`prefers-reduced-motion` / `(pointer: fine)` / `'ontouchstart' in window` 三重门控
  - **不动现有任何 render*() / loadPageWithFetch 函数体**，通过 monkey-patch 包装 `loadPageWithFetch`：调用前后挂 `.is-leaving` / `.is-entering`
  - MutationObserver 把 `.playlist-content.open` 镜像到父 `.playlist-section.is-open`（`:has()` 兼容性兜底）
  - CSS 给 `.playlist-section.is-open .playlist-title::after` 加同等旋转规则
  - Self-review 期间发现 + 修复初始化竞态：`wrapPageTransitions()` 移到 IIFE 顶层同步执行
- [x] **Stage 3 partial — 静态结构验证 + Codex review 收尾**
  - `node` 验证两个 inline `<script>` 块均能 parse；所有 `data/*.json` 均合法
  - `py -m http.server` 起本地服务，`curl` 验证 index.html / style.css / 所有 data 文件 200 OK
  - Codex review（这次成功 —— 上次因 `tail` pipe 吞输出 + stdin 阻塞，本次用 `< /dev/null` + 直接重定向到文件）catch 了 3 个新问题：
    1. **慢网络 race**：`setTimeout(320ms)` 假设 fetch 已返回，慢网下 `.is-entering` / reveal / playlist mirror 在空 DOM 上跑 → 已修复，`wrapPageTransitions` 改用 MutationObserver 监听 `#content` 子节点变化
    2. **Reduced-motion 漏 mirror**：原 `else` 分支只调 `applyRevealTo`（无运动时是 no-op），`attachPlaylistOpenMirror` 漏掉 → 已修复，挪到 motion gate 之外
    3. **快速连点 race**：旧 setTimeout 仍触发 → 已通过 #1 的 MutationObserver 部分缓解；快速连点期间仍可能闪烁，列入已知限制
- [ ] **Stage 3 final — 浏览器人工验证（用户）**

### 改动的文件
- `style.css` — 完全重写（1633 行）
- `index.html` — `<head>` 加 1 行 Lenis script；`<body>` 加 cursor + preview DOM 11 行；底部追加 ~250 行 IIFE 增强脚本

### 完全保留
- `data/*.json`、`scripts/*`、`CNAME`、`README.md`、`log.md`
- `index.html` 顶部所有 render*() / loadPageWithFetch / toggle*() 函数体
- 所有 HTML 结构 / 数据属性 / 路由逻辑

### 如何运行
```bash
cd "E:\OneDrive - University of California, Davis\PhD\Projects\website"
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

### 已知限制
- 自定义光标用 `cursor: none !important` 隐藏原生光标 —— 已通过 `prefers-reduced-motion` 与 `(pointer: coarse)` 退路覆盖；用 mouse 但需放大镜的低视力用户仍需自行启用 reduced motion
- `:has()` 兼容性已通过 `.playlist-section.is-open` 镜像兜底；但 `#content:has(.grid-container)` 这类布局选择器在旧浏览器仍会回退到默认 `max-width`（不影响功能）
- Reveal 动画在页面切换后 `style.opacity = '1'` 内联样式覆盖了 `.reveal { opacity: 0 }`，因此第一次进入新页面时仅有 translateY 上滑，无 opacity 渐显——可接受的视觉降级
- 列表展开 max-height 是固定值（essay 1600px / section 60000px / playlist 100000px），超长内容仍可能被裁切——长文请通过 essay-entry 的"阅读全文"在弹窗中读
- 快速连续切换 page 时，旧导航的清理 setTimeout(760ms) 仍会触发，可能在新页面进场期间错误地移除 `.is-entering`，造成短暂闪烁；非阻断性，未修

### 下一次会话建议（Stage 3 final — 浏览器人工验证）
本机的 `python` 是 Microsoft Store 占位符；用 `py -m http.server 8000` 启动。
1. `cd "E:\OneDrive - University of California, Davis\PhD\Projects\website" && py -m http.server 8000`
2. 浏览器打开 http://localhost:8000，依次点 4 个 nav 项，观察：
   - 首屏入场（kazhi 拉线 + pull-quote 上升）
   - 9 宫格 hover：标题位移 + 右下 → arrow + hover-preview 跟随光标
   - Essay 列表 hover：整行 accent 微底色 + 标题 translateX(8px)
   - Listening tabs 切换：图表 hairline bar 从左到右展开
   - 详情弹窗：blur 背景 + 关闭按钮旋转 90°
   - reveal-on-scroll：Cooking 长页向下滚动看 essay-entry 逐条上滑
3. DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`：所有动画退化为 ~120ms 简单 opacity / 无 transform
4. DevTools → Device toolbar 切到触屏：光标 / hover-preview 不挂载，原生指针正常
5. （可选）`codex exec -s read-only "..." < /dev/null > 文件名 2>&1` 复审 — 注意必须 `< /dev/null` 关闭 stdin，否则 codex 会一直等待输入

---

# Plan 3 — Homepage Revision: Forest Field Guide

> 这是对前一版"四个并列页面"首页设定的修订。以 [oftheoak.co.uk](https://oftheoak.co.uk/) 的**结构**为灵感（不抄视觉），把 `kazhi` 页改造成一个"森林田野图鉴"形式的入口页：超大 field-guide 风格 hero + 两个动作按钮（Timeline / Random）+ 下方的 S 曲线 PhD 时间线，时间线两侧悬浮独立的"记忆碎片"图像。

> 本计划是对前述视觉系统（Plan 1-12）的**叠加补丁**，不推翻任何已完成的样式 token 或组件，仅扩展首页的结构、动效与节奏。

---

## P3.0 设计意图

- 首页的隐喻：**走进一座数字森林档案 / 田野图鉴**
- 核心动作浓缩为两个：
  - **Timeline** —— 主线，PhD 学季时间线，编年记录"成为"
  - **Random** —— 支线，随机抽取一条往日微博记忆，作为感性闪回
- 两类内容在视觉上不混杂：
  - S 曲线节点 = **严格按时间排列的 PhD 学季关键节点**
  - S 曲线两侧的图像 = **独立浮动的记忆碎片**，与节点**无一一对应关系**
  - 用户滚动 + 鼠标移动时，附近的图像渐次浮现 / 解散

---

## P3.1 边界与约束

**不引入**：React / Next / Vite / 任何打包器 / Three.js / R3F / WebGL  
**保持**：纯 vanilla HTML/CSS/JS、现有 JSON 数据形状、现有详情弹窗、长文 markdown 渲染、其他三个页面（say / cooking / listening）  
**复用**（不重写）：  
- `getRandomWeiboFromDaily(data)` —— 随机抽微博
- `getDailyRandomIndices()` —— 当日伪随机种子
- `formatWeiboText()` / `formatDate()` —— 文本与日期格式化
- `parseWeiboDate()`
- `showEssayDetail(source, id)` —— 详情弹窗
- `renderMarkdown()`
- `attachEssayHandlers()`
- 现有 `loadPageWithFetch` 的 `.is-leaving` / `.is-entering` 过渡管线

**改动方式**：把 `renderKazhi(data)` 从"单条微博居中显示"改为 `renderFieldGuideHome(weiboData, quartersData)`；`loadPageWithFetch('kazhi')` 同时拉 `weibo.json` + `weibo2.json` + `quarters.json`。其余路由不动。

---

## P3.2 七阶段实施路线

### Phase 1 — Homepage restructure
- 新增 `renderFieldGuideHome(weiboMerged, quartersData)` 替换原 `renderKazhi` 在 `kazhi` 路由上的渲染
- `loadPageWithFetch('kazhi')` 升级为并行 fetch：`weibo.json` + `weibo2.json` + `quarters.json`
- 微博合并逻辑沿用既有方式（concat `data.weibo`）
- Hero DOM 结构：
  ```html
  <section class="field-guide-hero">
    <p class="fg-eyebrow">咔滋的森林</p>
    <h1 class="fg-title">A Field Guide to Becoming</h1>
    <p class="fg-intro">A personal archive of memory, research quarters, cooking notes, and repeated listening.</p>
    <div class="fg-actions">
      <button class="fg-btn" data-action="timeline">Timeline</button>
      <button class="fg-btn" data-action="random">Random</button>
    </div>
    <div class="random-memory-zone" aria-live="polite"></div>
  </section>
  <section id="timeline" class="timeline-world">
    <!-- S 曲线 + 节点 + 两侧记忆图像 -->
  </section>
  ```

### Phase 2 — Random button
- 点击 Random：在 `.random-memory-zone` 内插入一张 `.memory-slip` 卡片
- 复用 `getRandomWeiboFromDaily(weiboMerged)` + `formatWeiboText` + `formatDate`
- 卡片结构：
  ```html
  <article class="memory-slip">
    <header class="slip-meta">随机回忆 · 2024年X月X日</header>
    <p class="slip-text">{formatted weibo text}</p>
  </article>
  ```
- 动画：`scale(0.96) translateY(12px) opacity 0` → `scale(1) translateY(0) opacity 1`，280ms `--ease-edit`
- 行为模式（建议默认 stack 后 trim）：保留最近 3 张，超出的旧 slip 向上淡出移除；用户可在实现期间二选一（替换 vs 堆叠），先做 stack-with-trim
- **不**触发任何路由跳转

### Phase 3 — Timeline button
- 点击 Timeline：平滑滚动到 `#timeline`
- 优先用 `window.lenis?.scrollTo('#timeline', { duration: 1.6, easing: t => 1 - Math.pow(1-t, 4) })`
- 回退：`document.querySelector('#timeline').scrollIntoView({ behavior: 'smooth', block: 'start' })`
- 在按钮触发瞬间 `document.body.classList.add('is-entering-timeline')`，2s 后移除
- CSS 联动：
  - `.is-entering-timeline .field-guide-hero { transform: translateY(-24px) scale(0.985); opacity: 0.6; }`
  - 过渡 1.4s `--ease-edit`

### Phase 4 — S-curve PhD timeline
- 在 `#timeline` 内渲染一个 `<svg class="s-curve">`
  - 视图盒按 quarters 数量动态计算高度（每节点纵向间距 ~ 240-280px）
  - 路径用 cubic Bezier S 形：左 → 右 → 左 ... 左右摆动幅度 ~ 30% viewBox 宽度
- 节点循环 `quartersData.quarters`，每个节点：
  - 圆点（hairline 描边 + 内圈 fill 在 hover/visible 时变 accent）
  - 季标签（label，例如 "2025 Spring"）
  - keywords（≤ 3 个，逗号分隔）
  - summary（2-3 行）
  - "Read more →" 按钮 → 复用 `showEssayDetail('quarters', q.id)`
- S 曲线"绘制"动画：
  - SVG path `stroke-dasharray: <length>; stroke-dashoffset: <length>`
  - 进入视口（IntersectionObserver）后 `dashoffset → 0`，2.4s `--ease-out-expo`
- 滚动进度高亮：
  - 监听 `lenis.on('scroll', …)` 或原生 scroll
  - 计算 `#timeline` 元素 top 在 viewport 中的进度，设置 `--progress: <0..1>` CSS 变量
  - 用第二条 path（accent 色）`stroke-dashoffset: calc((1 - var(--progress)) * <length>)` 覆盖在灰色底 path 之上

### Phase 5 — Side memory images
- 在 `#timeline` 内并列布置左右两条 `.memory-rail.left` / `.memory-rail.right`
- 每条 rail 内 6-10 个 `.memory-shard`，绝对定位，纵向 `top: <%>` 散布
- **图像内容**：
  - 优先：若用户后续提供 `data/memory-images/*.jpg`，使用真实图
  - 当前阶段：**生成式占位卡** —— 抽象等高线 / 网格线 / 弱噪声叠加（纯 SVG inline）+ 简短 metadata 文字（"a kitchen on monday" / "fog over the bay" / 等可选诗意短句，亦可后期抽自 weibo）
- Reveal 行为（IntersectionObserver + `--progress`）：
  - 默认状态：`opacity: 0.15; filter: blur(8px); transform: translateY(40px) scale(0.94);`
  - 滚动到附近：`opacity: 0.95; filter: blur(0); transform: translateY(0) scale(1);`
  - 过渡 1.2s `--ease-soft`，stagger 80ms
- 鼠标交互（仅 `(pointer: fine)` 且非 reduced-motion）：
  - 每个 shard 监听 `mousemove`，用鼠标速度 + 距离驱动 `rotate(<deg>)` & `scale`
  - 速度衰减用 lerp，不直接绑定每帧 mousemove；在 RAF 中读取最新值
- 触屏 / reduced-motion：所有 shard 直接以最终 visible 状态渲染，无 blur / 无 rotate

### Phase 6 — Smoothness and motion
- 沿用 `--ease-edit` / `--ease-out-expo` / `--ease-soft`
- 不引入 spring / bounce
- 滚动期间避免一次性触发大量 reveal（IntersectionObserver `rootMargin: '-15% 0px'`）
- 禁用任何持续旋转 / 永久浮动循环（无意义抖动）
- 整体节奏：**进入像翻开一本图鉴**

### Phase 7 — CSS additions
在 `style.css` 末尾追加新分区（不删除任何现有规则）：
```
17. Field guide hero
18. Guide action buttons
19. Random memory slip
20. Timeline world
21. SVG S curve
22. Timeline nodes
23. Side memory photo fields
24. Timeline transition states (.is-entering-timeline)
25. Responsive fallbacks (≤ 768 mobile)
26. Reduced-motion fallbacks (覆盖 17-23 的所有动画)
```

---

## P3.3 文件改动清单

### 修改
- `index.html`
  - `loadPageWithFetch('kazhi')` 分支：从单文件 fetch 改为 `Promise.all([weibo, weibo2, quarters])`
  - 新增 `renderFieldGuideHome(weiboMerged, quartersData)`、`renderRandomSlip(zone, weibo)`、`renderTimelineSCurve(svg, quarters)`、`renderMemoryShards(rails, count)`、`bindFieldGuideActions(scope)` 等局部函数（首页内自包含，不污染其他页面）
  - 不删除原 `renderKazhi`（保留作为 fallback / 向后兼容）；首次实现时让其**只在 quartersData 缺失时**降级到原渲染

### 追加
- `style.css` 末尾新增 17-26 节
- `data/memory-shards.json`（可选）—— 存若干 shard 的 metadata（id / side / vTop% / palette / caption）；若不存在则 JS 生成

### 完全保留（不动）
- `data/columns.json` / `cooking.json` / `quarters.json` / `weibo.json` / `weibo2.json` / `liked*.json` / `listening*.json`
- 所有其他 `render*()` 函数（say / cooking / listening / quarters / column）
- `#detailOverlay` DOM 与 `showEssayDetail` / `renderMarkdown` / `attachEssayHandlers`
- 自定义光标 / hover-preview / Lenis / reveal observer 的现有实现

---

## P3.4 取舍说明

| 决策 | 理由 |
|---|---|
| **复用 kazhi 路由而非新增** | 不改导航结构、不改 URL；点击"咔滋"即抵达新首页 |
| **保留原 renderKazhi 作为降级** | 离线 / quarters fetch 失败时仍可显示一条微博 |
| **S 曲线用纯 SVG 而非 Canvas** | 矢量缩放无锯齿、可直接 CSS 控制 dash 动画、便于 a11y 加 `<title>` |
| **Memory shards 用生成式占位而非等图** | 项目暂无图片资产；占位系统需保证后续替换为真实图时 layout 不变 |
| **Random 默认 stack-with-trim 而非替换** | 让用户感受到"翻动多张签语"的物理感；超过 3 张即修剪 |
| **不接入 Three.js / WebGL** | 用户明确禁止；纯 SVG + CSS transform 完全胜任 |
| **不为 shards 引入 GSAP timeline** | 现有 IntersectionObserver + RAF 节流足以；保持零依赖 |

---

## P3.5 测试清单（Stage 4 实施后）

1. **加载首页**：直接访问 `/` → 自动加载 kazhi → 应显示 Field Guide hero（eyebrow / title / intro / 两按钮）
2. **Random 反复点击**：每次点击均在下方注入新 memory slip，3 张后开始修剪最旧
3. **Timeline 点击**：从 hero 平滑滚动到 `#timeline`，hero 同步轻微上移 + 透明
4. **S 曲线**：滚入视口时由灰色 path 描出；继续滚动时 accent 色覆盖描边按进度增长
5. **节点 Read more**：复用现有详情弹窗打开 quarter 长文
6. **侧边 memory shards**：滚动时由模糊变清晰；鼠标靠近时轻微旋转
7. **移动端**：所有 hover / mouse 驱动效果禁用，shards 直接以最终态显示，节点垂直排列（S 曲线降级为单列）
8. **reduced-motion**：S 曲线一次性显形、shards 一次性显形、按钮过渡 ≤ 120ms
9. **回到导航其他页**：确认 say / cooking / listening 完全未受影响
10. **fallback**：临时把 `data/quarters.json` 重命名 → 首页应降级到原"单条微博"渲染（不空白）

---

## P3.6 用户确认的细节决定（2026-05-02）

1. **Random 行为 = 替换模式**（覆盖前一版的 stack-with-trim 提议）
   - 每次点击 Random，`.random-memory-zone` 内仅保留一张 `.memory-slip`
   - 新 slip 进入前，旧 slip 先淡出（160ms）然后被移除，新 slip 再做进入动画（280ms）
   - 视觉上像翻签语 / 翻日历一页

2. **Memory shards = 占位先行，后期可无缝替换为真实图片**
   - 阶段 1（现在）：纯 SVG inline 生成的"等高线 + 网格 + 弱噪声"占位卡 + 短句 caption
   - 阶段 2（后期）：把 `.memory-shard` 内的 SVG 替换为 `<img loading="lazy" src="data/memory-images/...">`
   - **layout 必须前后一致**：固定宽高比 3:4、固定 max-width、固定 box-shadow、固定圆角；只换内容层
   - 每张 shard 的位置 / 大小 / 旋转角度从其稳定的 ID hash 派生（用 `data/memory-shards.json` 存元数据；现在生成式默认值，后期只需把 caption 换成图片路径）

3. **S 曲线 = 反编年（newest at top → oldest at bottom）+ 节点稀疏可扩展**
   - 顺序：`26-spring`（最新）在最顶，`23-fall`（最老）在最底
   - 每节点纵向间距 **≥ 360px**（不拥挤），整个 timeline 总高约 11 × 360 ≈ 4000px
   - **可扩展性**：节点渲染器接受统一的"timeline entry"数据形状（`{ type: 'quarter' | 'article' | 'interlude', ... }`），未来在两个 quarter 之间插入文章 / 间奏只需在数据上加项，不动 SVG 路径生成逻辑
   - SVG 路径根据节点数量与间距动态生成，未来加节点会自动重排，无需手算
   - 反编年的隐喻："从此刻往回走，回顾来时路"

### 衍生实施细节

- **数据形状（timeline-ready）**：`renderFieldGuideHome` 内部把 `quartersData.quarters` 反向后映射成
  ```js
  { type: 'quarter', id, label, year, season, keywords, summary, content, side: 'left'|'right' }
  ```
  side 由节点 index 的奇偶性决定（0=right, 1=left, 2=right, ...），保持 S 曲线左右交替的视觉
- **未来插入文章**：只需 push `{ type: 'article', id, label, summary, content, side, after: 'quarter-id' }`，timeline 会按数组顺序排布；不需要修改任何 CSS 或 SVG 代码
- **滚动方向语义**：Lenis / scroll 的进度计算保持自然方向（向下滚动 = 进度 0→1），但因为节点反向排列，进度增加 = 时间倒流。S 曲线 accent 描边按进度增长，视觉上是"走过的路"

### 移动端时间线降级

- ≤ 768px：S 曲线 SVG 完全隐藏（`display: none`），节点改为单列垂直堆叠（`grid-template-columns: 1fr`）
- 仍保留反编年顺序与 360px 间距（移动端可适当压缩到 240px）
- side rails / memory shards 在 ≤ 768px 隐藏（节点本身已经够阅读密度）

---

## P3.7 完成后交付（待写）

- [ ] 视觉方向描述
- [ ] 改动文件列表
- [ ] 保留逻辑清单
- [ ] 运行 / 测试步骤（`py -m http.server 8000`）
- [ ] 已知限制与下一步打磨建议
