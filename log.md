# 咔滋的森林 - 项目开发日志

## 项目概述
个人网站项目，采用侘寂风格设计，包含咔滋、咔言咔语、Deep Cooking、Deep Listening四个主要板块。

---

## 开发时间线

### 2024年8月18日
#### 🏗️ 网站框架搭建
- **完成时间**: 全天
- **主要工作**:
  - 建立完整的网站架构
  - 实现四个主要页面的基础框架
  - 设置导航系统和页面路由
  - 建立侘寂风格的CSS样式系统
  - 配置字体和基础视觉设计

#### 🎲 咔滋界面随机功能 & 数据获取
- **完成时间**: 晚上
- **主要工作**:
  - 实现咔滋页面的随机微博显示功能
  - 开发基于日期的微博选择算法
    - 首次访问显示去年今日的微博
    - 后续访问显示每日固定的随机微博
  - 下载并整理所有微博数据
  - 建立微博数据的JSON格式存储
  - 实现微博文本的格式化和展示

### 2026年7月6日
#### 🔧 全站质量修复（三 agent 评审 → 53 项问题 → 集中修复）
- **架构**: 内联脚本(~65KB)提取为 `app.js`；Lenis 改为自托管 `lenis.min.js`（jsdelivr 在国内不稳，defer 会阻塞首屏渲染）
- **正确性**:
  - 切页竞态修复：`navToken` 令牌，慢的旧 fetch 不再覆盖新页面（`switchListeningTab` 同理）
  - 统一 `fetchJSON()`：检查 `response.ok`；`loadColumn` 补 `.catch`，失败不再永久空白
  - XSS 防护：全部渲染函数经 `escapeHtml()` 转义 JSON 内容
  - `_fgInitMotion` 的 window 监听改用 AbortController，不再每次回首页叠加泄漏
- **性能**:
  - 首页数据瘦身：`data/weibo-slim.json`（481KB，脚本 `scripts/build-weibo-slim.js` 生成），替代 2MB 全量微博；全量文件保留作回退
  - by-year/by-artist 歌单懒渲染：展开时才注入 `<li>`（原先一次性 ~1.1 万节点）
  - 去掉切页人为 300ms 延迟；删除 `will-change` 滥用；hero/入场 filter blur 过渡移除；hover-preview 每帧 offsetWidth 读取改为缓存
- **无障碍**:
  - 导航/听歌 tab 改 `<button>`（含 role=tablist/tab）；卡片、essay 标题、歌单标题加 `role="button"` + `tabindex` + 委托键盘激活；弹窗加 `role="dialog"` + 焦点圈定/归还
  - 对比度：`--ink-faint` #857f74→#706a60（3.5→4.7:1）；新增 `--accent-text` 用于小号强调文字
  - 逐字拆分标题补 `aria-label`；reduced-motion 下时间轴 `transform !important` 布局破坏修复
- **SEO/杂项**: 补 meta description/OG/favicon/canonical/noscript；`document.title` 随页面切换；死代码（mockData/loadPage 等约 180 行）删除
- **验证**: headless Edge 渲染四个页面 + 懒渲染交互测试全部通过

### 2024年8月19日
#### 🔄 咔言咔语界面翻转效果
- **完成时间**: 全天
- **主要工作**:
  - 解决9宫格卡片翻转动画问题
  - 修复文字显示和翻转逻辑
  - 优化卡片背面文字的可读性
  - 调整翻转动画的视觉效果
  - 移除不必要的阴影和3D变换
  - 实现背面整体淡入效果
  - 确保多浏览器兼容性

---

## 技术栈
- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **样式**: 自定义CSS，侘寂风格设计
- **字体**: Google Fonts (Noto Serif SC, Cormorant Garamond)
- **动画**: CSS 3D Transform, Transition
- **数据**: JSON格式本地存储

---

## 当前功能状态

### ✅ 已完成
- [x] 网站基础架构
- [x] 导航系统
- [x] 咔滋页面随机微博显示
- [x] 咔言咔语9宫格翻转效果
- [x] 微博数据整理和存储
- [x] 响应式设计基础

### 🚧 进行中
- [ ] Deep Cooking页面内容填充
- [ ] Deep Listening页面音乐数据
- [ ] 详情弹窗内容完善

### 📋 待开发
- [ ] 后端API接口
- [ ] 数据库集成
- [ ] 用户交互功能增强
- [ ] SEO优化
- [ ] 性能优化

---

## 遇到的主要问题及解决方案

### 1. 卡片翻转文字显示问题
**问题**: 卡片翻转后文字出现镜像或不显示
**解决**: 
- 移除文字的二次翻转
- 调整`backface-visibility`属性
- 优化透明度过渡效果

### 2. 微博随机显示逻辑
**问题**: 需要实现既有随机性又有一定规律的显示
**解决**:
- 基于日期的伪随机算法
- Session存储访问计数
- 特殊处理"去年今日"功能

---

## 下一步计划
1. 完善Deep Cooking和Deep Listening页面的内容
2. 优化移动端体验
3. 添加加载动画和过渡效果
4. 考虑添加暗黑模式支持
5. 准备部署到生产环境

---

*最后更新: 2024年8月19日*