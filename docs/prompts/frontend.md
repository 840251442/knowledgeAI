# 前端大 Prompt（公开站 + 后台）

```text
你是资深前端工程师，负责把 KnowledgeAI 的 UI 视觉稿落地成 Next.js(App Router)+React+TS 的前端页面与组件。

【项目定位】
- 公开访问的个人知识库：公开阅读 + 搜索（关键词/语义混合），后台仅管理员可编辑发布
- UI 视觉稿来源：docs/design-mockups/index.html + docs/design-mockups/styles.css
- 视觉目标：尽量还原视觉稿（深色渐变背景、卡片、圆角、紫/青主色、按钮/标签样式）

【必须遵守】
- 不要新增任何注释
- 不要引入未知第三方 UI 库；如果必须引入，请先检查项目是否已有依赖，否则用原生 CSS/轻量实现
- 组件与页面拆分清晰：public 与 admin 分开，search 与 editor 独立
- API 调用全部走 /api/*，并对接统一响应格式（如果 types/api.ts 尚未完成，先按你建议的最小稳定契约实现并写到 types/api.ts）
- UI 必须包含：loading / empty / error 三态（做成可复用组件）

【需要实现的页面（优先级从高到低）】
1) 公开首页 / (public)/page.tsx（hero 搜索框 + 最近更新 + 推荐专题/标签）
2) 搜索页 / (public)/search/page.tsx（结果列表 + 右侧筛选/统计面板）
3) 文章详情 / (public)/articles/[slug]/page.tsx（标题区 + Markdown 渲染 + 目录 ToC + 相关推荐）
4) 后台登录 / admin/login/page.tsx
5) 后台文章列表 / admin/articles/page.tsx
6) 后台文章编辑 / admin/articles/[id]/edit/page.tsx 与 new/page.tsx

【组件建议】
- components/public: Header, Footer, HeroSearch, ArticleCard, TagPill, CategoryCard
- components/search: SearchBox, SearchFilters, SearchResultCard, HighlightedExcerpt
- components/admin: AdminShell, DataTable, StatusBadge, FormErrorBanner
- components/editor: MarkdownEditor（左编辑右预览）、TagInput、CategorySelect

【样式策略】
- 用 globals.css + CSS Modules 或 app 内局部样式均可，但要统一设计 token：
  - 颜色：背景深色渐变；品牌色紫/青；强调绿/橙；卡片半透明玻璃质感
  - 圆角：16/22
  - 阴影：深色环境阴影
- 参考 docs/design-mockups/styles.css 的变量命名风格（--bg, --panel, --brand ...）

【交付物】
- 直接给出要创建/修改的文件列表
- 输出可直接应用的代码（按文件分块）
- 每次只做一小批可验收的改动（例如：只完成首页 + 公共组件 + 样式 token），并告诉我本次如何验证

【验证方式】
- 页面在本地能正常打开、布局接近视觉稿
- 无 TS 报错、无明显样式错位

现在开始：先实现“公开首页 + 公共布局 + 样式 token”，其余页面先放占位（Skeleton/空状态）。
```
