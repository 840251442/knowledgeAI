# UI Rework From Mockups Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有全站前端界面重构为与 design-mockups 当前版本一致的深色赛博风格，并完成“顶部仅登录 + 弹窗内注册 + 首页热门标签下沉到搜索框下方”。

**Architecture:** 保持 Next.js App Router 现有路由与 API 契约不变，仅改布局结构、样式系统与前端状态管理；保留关键 data-testid，避免破坏已有 E2E。

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules/Global CSS, Playwright

## Change Sync (2026-05-22)

- [x] 顶栏新增“首页”菜单项（Public Nav）
- [x] 首页移除“入口”整栏，仅保留“最近更新”主内容区
- [x] 首页移除“最近更新”模块，改为与文章页一致的文章列表展示
- [x] 全局背景去除色带分割，统一为上半部分深色底
- [x] 移除顶栏“搜索”菜单项，但保留搜索功能与 `/search` 结果页承接搜索请求
- [x] 移除顶栏“文章”菜单项
- [x] 顶栏导航顺序调整为“首页、后台、登录（最后）”
- [x] 首页搜索改为就地过滤：搜索不跳页、结果直接筛选首页内容
- [x] 首页标签改为本地多选筛选：激活态可见、再次点击取消、多标签按“或”关系匹配
- [x] 修复后台“退出”点击报错：改为客户端调用 `/api/admin/logout` 后跳转登录页
- [x] 页面左右边距统一为 10px（公开站与后台）
- [x] 滚动策略调整为仅文档区滚动，页面整体不滚动
- [x] 首页滚动进一步细化为“仅热门标签下方列表区域滚动”，顶部标题/搜索/标签固定
- [x] 首页外层容器最大宽度限制取消，左右空白进一步压缩
- [x] 移除首页第一块“大标题说明”区域
- [x] 将首页第二块“搜索+热门标签”做成独立卡片区域
- [x] 首页重排为三块同级结构：顶部栏 / 搜索标签块 / 列表块
- [x] 底部列表区去掉最外层包裹框，仅保留列表内容卡片
- [x] 顶部菜单块去掉边框与背景色（仅调整第一个块）
- [x] 全局背景亮度与层次优化：减弱纯黑感，增加柔和蓝青渐变与光晕
- [x] 首页色板统一收敛：按钮/标签/输入框/列表卡片使用同一蓝青色阶
- [x] 主题回调为淡蓝科技风：背景提亮，列表卡片使用更亮蓝色表面
- [x] 搜索区细节配色微调：占位文案与搜索按钮颜色统一为柔和淡蓝
- [x] 搜索按钮背景二次微调：降低发白感，补充独立 hover 渐变层次
- [x] 搜索按钮改为深色蓝调：主态与 hover 统一加深，视觉更稳重
- [x] 搜索与登录按钮风格统一：主态/hover 使用同一套深蓝渐变与阴影
- [x] 后台左侧栏贴边展示：去掉左缝隙与外边框，左侧圆角取消
- [x] 后台底部可见性修复：左栏与主区增加滚动和底部安全留白
- [x] AI 预览内容块滚动增强：固定纵向滚动并补充可见滚动条样式
- [x] article-editor-ai-panel 容器滚动修复：外层面板增加高度上限与纵向滚动
- [x] AI 面板滚动策略回调：article-editor-ai-panel 与 article-editor-ai-preview 改为 flex 自适应并取消局部滚动
- [x] AI 预览区精调：article-editor-ai-preview 改为 overflow:auto 且 max-height:200px
- [x] 后台 panel 交互增强：panel 本体可滚动，panelHeader 改为 sticky 固定
- [x] panelHeader 视觉修正：改为不透明实色背景，滚动时不透底
- [x] article-editor 容器样式调整：border:none 且 border-radius:0
- [x] 后台表单控件迁移到 Ant Design：登录页/文章编辑器/分类管理/标签管理/搜索日志分页的 Input、Select、TextArea、Button 替换
- [x] 按钮全量迁移到 Ant Design：公开站与认证流程中的原生 button 全部替换为 antd Button
- [x] 全局 Antd 主题接入：使用 darkAlgorithm + 统一蓝色 token 配置
- [x] 链接样式按钮统一：文章管理、文章详情、搜索结果、认证页入口改为 antd Button
- [x] article-editor-markdown 行数限制：最小 3 行，最大 20 行
- [x] article-editor-markdown 组件替换：由 textarea 改为 Markdown 编辑器
- [x] 编辑器预览改造：右侧预览区改为 Markdown 实际渲染
- [x] 后台侧栏英文 pill 文案改为中文
- [x] 新建文章 slug 自动生成且隐藏字段，状态统一展示中文，发布成功增加提示，仅已发布文章显示下线
- [x] 编辑器底部索引状态文案改为中文
- [x] 前台/后台登录态拆分为独立 cookie，避免跳转前台覆盖后台会话

---

## File Structure Mapping

- Modify: `src/app/globals.css`
  - 统一全站设计 token（色板、阴影、圆角、字体基线）
- Modify: `src/app/(public)/public.css`
  - 重写公开站视觉与组件样式（导航、hero、卡片、搜索、弹窗）
- Modify: `src/app/admin/admin.css`
  - 重写后台视觉（sidebar、panel、table、form、mobile）
- Create: `src/components/auth/PublicAuthModal.tsx`
  - 公开站登录/注册弹窗组件（邮箱/密码）
- Modify: `src/app/(public)/layout.tsx`
  - 顶部去注册按钮，接入弹窗触发与后台入口
- Modify: `src/app/(public)/page.tsx`
  - 首页结构重排，热门标签放到搜索框下方
- Modify: `src/app/(public)/search/page.tsx`
  - 对齐新布局区块和视觉层级
- Modify: `src/app/(public)/articles/page.tsx`
  - 对齐新列表样式与信息层级
- Modify: `src/app/(public)/articles/[slug]/page.tsx`
  - 对齐详情页头图、元信息、正文区样式
- Modify: `src/app/admin/layout.tsx`
  - 后台壳层级与导航区块对齐 mockup
- Modify: `src/app/admin/login/page.tsx`
  - 重构为统一视觉登录面板（与公开站弹窗语言一致）
- Optional Modify: `tests/e2e/*`
  - 仅在必要时补充/修复选择器，不改变既有断言语义

---

## Task 1: 建立统一视觉基线（Token + 全局）

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/(public)/public.css`
- Modify: `src/app/admin/admin.css`

- [x] **Step 1: 在 globals.css 统一色彩与字体 token**
  - 对齐 mockup：深底、发光边线、半透明 panel、按钮渐变、输入 focus ring。

- [x] **Step 2: public.css 重构公开站基础样式**
  - 包括 topbar、hero、search row、hot tags、cards、modal、mobile breakpoint。

- [x] **Step 3: admin.css 重构后台基础样式**
  - 包括 sidebar、panel header、table row、status pill、form controls。

- [x] **Step 4: 本地检查无明显样式语法错误**
Run:
```bash
npm run lint
```
Expected: 与本次改动相关的 CSS/TSX 不新增错误。

- [ ] **Step 5: Commit**
```bash
git add src/app/globals.css src/app/(public)/public.css src/app/admin/admin.css
git commit -m "feat(ui): establish mockup-aligned design tokens and theme baseline"
```

---

## Task 2: 公开站导航与认证弹窗改造

**Files:**
- Create: `src/components/auth/PublicAuthModal.tsx`
- Modify: `src/app/(public)/layout.tsx`

- [x] **Step 1: 创建 PublicAuthModal 组件**
  - 支持 login/register 切换。
  - 当前只保留邮箱/密码路径。
  - 错误提示、loading、成功态反馈统一样式。

- [x] **Step 2: 在 public layout 接入弹窗触发**
  - 顶部保留“登录”按钮。
  - 删除顶栏“注册”按钮。
  - “后台”入口保持存在。

- [x] **Step 3: 可访问性与交互收尾**
  - 支持 Esc 关闭、遮罩点击关闭、焦点可达。

- [x] **Step 4: 运行类型检查**
Run:
```bash
npm run typecheck
```
Expected: PASS。

- [ ] **Step 5: Commit**
```bash
git add src/components/auth/PublicAuthModal.tsx src/app/(public)/layout.tsx
git commit -m "feat(ui): add public auth modal and simplify top navigation"
```

---

## Task 3: 首页结构重排（热门标签下沉）

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/public.css`

- [x] **Step 1: 调整首页 hero 区块结构**
  - 保留搜索表单 testid。
  - 在搜索框下方渲染热门标签条。

- [x] **Step 2: 热门标签交互保持可跳转**
  - 点击跳转 articles tag 过滤页。

- [x] **Step 3: 校验空数据场景样式**
  - 标签为空/DB 未就绪均有可读展示。

- [x] **Step 4: 回归首页渲染**
Run:
```bash
npm run typecheck
```
Expected: PASS。

- [ ] **Step 5: Commit**
```bash
git add src/app/(public)/page.tsx src/app/(public)/public.css
git commit -m "feat(ui): move hot tags under search on home page"
```

---

## Task 4: 公开站其余页面视觉收敛

**Files:**
- Modify: `src/app/(public)/search/page.tsx`
- Modify: `src/app/(public)/articles/page.tsx`
- Modify: `src/app/(public)/articles/[slug]/page.tsx`
- Modify: `src/components/search/*` (if needed)

- [x] **Step 1: 搜索页区块与统计侧栏风格统一**
  - 统一结果卡片、统计卡片、无结果态视觉。

- [x] **Step 2: 文章列表页风格统一**
  - 保持分页/筛选行为不变，仅改结构与样式类。

- [x] **Step 3: 文章详情页风格统一**
  - 统一标题区、meta、markdown 内容块层级。

- [x] **Step 4: 运行类型检查与 lint**
Run:
```bash
npm run typecheck && npm run lint
```
Expected: PASS 或仅存在历史无关问题。

- [ ] **Step 5: Commit**
```bash
git add src/app/(public)/search/page.tsx src/app/(public)/articles/page.tsx src/app/(public)/articles/[slug]/page.tsx src/components/search
git commit -m "feat(ui): align public search and article pages with mockup style"
```

---

## Task 5: 后台壳与登录页视觉重构

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/admin/login/page.tsx`
- Modify: `src/app/admin/admin.css`

- [x] **Step 1: 后台 layout 结构对齐 mockup**
  - 侧栏品牌区、菜单态、主内容区背景层级一致。

- [x] **Step 2: 登录页视觉统一**
  - 移除大段内联 style，改为 class 驱动。
  - 错误提示与按钮态统一。

- [x] **Step 3: 移动端断点验证**
  - 侧栏与表单在窄屏可用。

- [x] **Step 4: 运行类型检查**
Run:
```bash
npm run typecheck
```
Expected: PASS。

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/layout.tsx src/app/admin/login/page.tsx src/app/admin/admin.css
git commit -m "feat(ui): redesign admin shell and login page"
```

---

## Task 6: 回归验证与收尾

**Files:**
- Optional Modify: `tests/e2e/*`
- Modify: `README.md` (如需更新界面说明)

- [x] **Step 1: 跑关键 E2E 冒烟**
Run:
```bash
npm run test:e2e -- tests/e2e/smoke.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/public-browse.spec.ts --project=chromium
npm run test:e2e -- tests/e2e/admin-auth.spec.ts --project=chromium
```
Expected: 关键路径通过；若因选择器变化失败，仅做最小修复。

- [ ] **Step 2: 手工验收清单**
  - 顶部无注册按钮。
  - 登录弹窗可切注册并可提交。
  - 首页热门标签在搜索框下。
  - 后台页面主题与 mockup 对齐。

- [ ] **Step 3: 更新文档并提交**
```bash
git add README.md tests/e2e
# 若无文档/测试改动，可跳过
git commit -m "test(ui): validate mockup-aligned experience across key flows"
```

---

## Exit Criteria

- [ ] 全站 UI 达到设计稿一致性预期（视觉方向一致，关键交互一致）。
- [ ] 后端 API、数据库 schema、服务层逻辑无改动。
- [ ] 关键 E2E 通过或有明确、最小化的兼容修复。
- [ ] 可在 PR 中按任务粒度审阅每组提交。
