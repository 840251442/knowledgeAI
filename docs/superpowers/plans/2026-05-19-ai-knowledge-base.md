# AI 知识库实施计划
> **给执行型智能体：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项执行本计划。任务步骤使用勾选框语法（`- [ ]`）进行跟踪。
**目标：** 构建一个面向公开访问的 AI 知识库，包含 React/Next.js 前端、管理后台、MySQL 持久化、Redis 缓存，以及基于向量检索的语义搜索能力。
**架构：** 使用单一 Next.js 代码库，明确划分工作流边界：公开界面与后台界面位于 `app/`，业务逻辑位于 `services/`，数据持久化通过 Prisma/MySQL，缓存由 Redis 负责，语义检索隔离在 `lib/ai` 与 `lib/search` 中。并行开发的前提是先锁定 API 契约、共享类型和数据结构，再让各工作流基于 mock 或固定数据独立推进。
**技术栈：** Next.js App Router、React、TypeScript、Prisma、MySQL、Redis、向量数据库或向量服务、Markdown 渲染链路、Auth.js 或基于 Cookie 的后台鉴权
---

## 文件结构映射

### 共享契约

- 创建：`types/article.ts`
- 创建：`types/search.ts`
- 创建：`types/api.ts`
- 创建：`config/site.ts`
- 创建：`config/search.ts`

### 前端公开站

- 创建：`app/(public)/page.tsx`
- 创建：`app/(public)/articles/page.tsx`
- 创建：`app/(public)/articles/[slug]/page.tsx`
- 创建：`app/(public)/search/page.tsx`
- 创建：`app/(public)/category/[slug]/page.tsx`
- 创建：`app/(public)/tag/[slug]/page.tsx`
- 创建：`components/public/*`
- 创建：`components/search/*`

### 前端后台

- 创建：`app/admin/login/page.tsx`
- 创建：`app/admin/dashboard/page.tsx`
- 创建：`app/admin/articles/page.tsx`
- 创建：`app/admin/articles/new/page.tsx`
- 创建：`app/admin/articles/[id]/edit/page.tsx`
- 创建：`app/admin/categories/page.tsx`
- 创建：`app/admin/tags/page.tsx`
- 创建：`app/admin/search-logs/page.tsx`
- 创建：`components/admin/*`
- 创建：`components/editor/*`

### 后端与数据层

- 创建：`app/api/articles/route.ts`
- 创建：`app/api/articles/[slug]/route.ts`
- 创建：`app/api/search/route.ts`
- 创建：`app/api/categories/route.ts`
- 创建：`app/api/tags/route.ts`
- 创建：`app/api/admin/**/route.ts`
- 创建：`lib/db/prisma.ts`
- 创建：`lib/redis/client.ts`
- 创建：`lib/auth/*`
- 创建：`services/article.service.ts`
- 创建：`services/category.service.ts`
- 创建：`services/tag.service.ts`
- 创建：`services/search.service.ts`
- 创建：`services/embedding.service.ts`
- 创建：`services/reindex.service.ts`

### 数据库与脚本

- 创建：`prisma/schema.prisma`
- 创建：`prisma/seed.ts`
- 创建：`scripts/reindex-all.ts`
- 创建：`scripts/backfill-embeddings.ts`

## 并行工作流

### 工作流 A：共享契约与项目骨架

**负责人：** 技术负责人 / 全栈工程师
**依赖：** 无
**解锁：** 其他所有工作流

- [ ] 在 `types/article.ts` 和 `types/search.ts` 中定义 `ArticleListItem`、`ArticleDetail`、`SearchResultItem`、`CategorySummary`、`TagSummary`
- [ ] 在 `types/api.ts` 中定义公开 API 的统一响应结构
- [ ] 在 `config/search.ts` 中定义搜索默认配置，包括 `keywordWeight`、`semanticWeight`、`freshnessWeight`、`searchCacheTtlSeconds`
- [ ] 在 `app/(public)` 和 `app/admin` 下建立路由分组结构
- [ ] 创建占位布局和 loading 状态，使前端在后端接口未完成前也可先行开发
- [ ] 提交，提交信息：`chore: scaffold app structure and shared contracts`

### 工作流 B：数据库与 Prisma

**负责人：** 数据库工程师
**依赖：** 工作流 A 中锁定的共享命名
**解锁：** 后端 API、后台内容流、AI 流水线

- [ ] 在 `prisma/schema.prisma` 中创建模型：`AdminUser`、`Category`、`Tag`、`Article`、`ArticleTag`、`ArticleChunk`、`EmbeddingTask`、`SearchLog`、`ArticleView`
- [ ] 为 `Article.slug`、`Category.slug`、`Tag.slug`、`Article.status + publishedAt`、`ArticleChunk.articleId + chunkIndex` 添加索引
- [ ] 生成初始 migration
- [ ] 创建 `lib/db/prisma.ts` 单例 Prisma Client
- [ ] 创建 `prisma/seed.ts`，预置 1 个管理员、3 个分类、6 个标签和 3 篇示例文章
- [ ] 使用以下命令验证：`npx prisma migrate dev --name init` 和 `npx prisma db seed`
- [ ] 提交，提交信息：`feat: add database schema and seed data`

### 工作流 C：后端内容 API

**负责人：** 后端工程师
**依赖：** 工作流 A 与 B
**解锁：** 后台界面、公开页面、搜索能力

- [ ] 在 `services/article.service.ts` 中实现文章列表、按 slug 查询详情、创建、更新、发布、下线
- [ ] 实现 `services/category.service.ts` 与 `services/tag.service.ts`
- [ ] 实现公开接口：
  - `GET /api/articles`
  - `GET /api/articles/[slug]`
  - `GET /api/categories`
  - `GET /api/tags`
- [ ] 实现后台接口：
  - `POST /api/admin/login`
  - `POST /api/admin/logout`
  - `GET/POST /api/admin/articles`
  - `PUT/DELETE /api/admin/articles/[id]`
  - `POST /api/admin/articles/[id]/publish`
  - `POST /api/admin/articles/[id]/unpublish`
  - `GET/POST /api/admin/categories`
  - `GET/POST /api/admin/tags`
- [ ] 所有接口都使用 `types/api.ts` 中定义的统一响应结构，保证前端可稳定对接
- [ ] 为所有 `/api/admin/*` 路由补充基础参数校验与鉴权守卫
- [ ] 提交，提交信息：`feat: add content management api`

### 工作流 D：公开前端

**负责人：** 前端工程师
**依赖：** 可立即依赖工作流 A；真实数据依赖工作流 C
**解锁：** 公开版 MVP 演示

- [ ] 在 `components/public` 中构建公开站通用布局、页头、页脚组件
- [ ] 实现首页，包括主搜索框、最新文章、推荐标签
- [ ] 实现文章列表页，包括分类与标签筛选 UI
- [ ] 实现文章详情页，包括 Markdown 渲染、目录导航和相关文章区域
- [ ] 实现分类页和标签页
- [ ] 如果后端未完成，先用 mock fetch 层开发，后续切换真实 API 时不改页面结构
- [ ] 为首页、列表页、文章页添加 metadata 生成逻辑
- [ ] 提交，提交信息：`feat: add public knowledge base pages`

### 工作流 E：后台前端

**负责人：** 前端工程师 2 / 全栈工程师
**依赖：** 可立即依赖工作流 A；真实提交依赖工作流 C
**解锁：** 内容运营流程

- [ ] 实现后台登录页
- [ ] 实现后台概览页
- [ ] 实现文章管理表格，包括状态徽标和快捷操作
- [ ] 实现文章新建/编辑页，包含标题、slug、摘要、正文、分类、标签、状态字段
- [ ] 实现分类管理页
- [ ] 实现标签管理页
- [ ] 为请求失败场景补充乐观状态处理和错误提示条
- [ ] 提交，提交信息：`feat: add admin management ui`

### 工作流 F：Redis 缓存与基础设施

**负责人：** 后端 / 平台工程师
**依赖：** 工作流 A 与 B
**解锁：** 性能优化与热点搜索

- [x] 创建 `lib/redis/client.ts`
- [x] 为首页、文章详情、搜索结果、热门标签定义缓存 key 帮助函数
- [x] 为公开文章详情和搜索结果加入 read-through 缓存
- [x] 为文章发布、下线、更新操作添加缓存失效钩子
- [x] 添加 Redis 临时不可用时的降级逻辑，保证系统仍可运行
- [ ] 提交，提交信息：`feat: add redis caching layer`

### 工作流 G：搜索服务

**负责人：** 后端 / 搜索工程师
**依赖：** 工作流 B、C、F
**解锁：** 搜索页面与搜索分析

- [x] 在 `services/search.service.ts` 中实现 `searchArticles(query, filters)` 入口
- [x] 实现基于标题、摘要、标签名和文章正文的关键词搜索
- [x] 按 `SearchResultItem` 结构返回结果，包括 `title`、`slug`、`excerpt`、`score`、`category`、`tags`
- [x] 在响应后或非阻塞后台路径中异步写入 `SearchLog`
- [x] 实现 `GET /api/search`，使用稳定的统一响应结构
- [ ] 提交，提交信息：`feat: add keyword search service`

### 工作流 H：向量流水线与语义搜索

**负责人：** AI / 搜索工程师
**依赖：** 工作流 B、C、G
**解锁：** AI 搜索 MVP

- [x] 选定向量存储方案，并将其封装在 `lib/ai/vector-store.ts`
- [x] 在 `lib/ai/chunking.ts` 中实现基于标题层级感知的文章切片
- [x] 在 `services/embedding.service.ts` 中实现 embedding 生成逻辑
- [x] 实现 `scripts/backfill-embeddings.ts`，用于历史文章向量回填
- [x] 在 `services/reindex.service.ts` 中实现发布后的重建索引逻辑
- [x] 实现基于 top-K 切片相似度的语义召回
- [x] 在 `services/search.service.ts` 中将语义结果与关键词结果融合排序
- [x] 在不修改前端请求格式的前提下，通过现有 `GET /api/search` 暴露混合搜索能力
- [ ] 提交，提交信息：`feat: add semantic retrieval pipeline`

### 工作流 I：搜索界面与分析

**负责人：** 前端工程师 + 后端工程师
**依赖：** 工作流 D 与 G，后续由 H 进一步增强
**解锁：** 可用的搜索体验与运营反馈

- [x] 实现 `app/(public)/search/page.tsx`
- [x] 实现 `components/search/search-box.tsx`、`search-filters.tsx`、`search-result-card.tsx`
- [x] 使用统一的结果卡片展示关键词搜索与语义搜索结果
- [x] 添加高亮片段与摘要展示
- [x] 实现后台搜索日志页面，包括热门查询、无结果查询、延迟概览
- [ ] 提交，提交信息：`feat: add search interface and analytics views`

## 依赖关系图

- 工作流 A 最先开始
- 工作流 B 在 A 的命名和结构锁定后开始
- 工作流 C 在 B 的 migration 契约稳定后开始
- 工作流 D 和 E 在 A 完成后即可启动，并可先使用 mock
- 工作流 F 在 B 完成后开始
- 工作流 G 在 C 和 F 完成后开始
- 工作流 H 在 B 完成后即可准备；当 chunk schema 固定后可与 G 并行推进
- 工作流 I 在 D 和 G 完成后开始

## 并行协作规则

- 如果 `types/api.ts` 中的响应契约已经冻结，前端不得再阻塞等待后端
- AI 相关工作不得随意修改公开 API 结构；语义搜索只能扩展排序能力，不能改请求格式
- 数据库工程师统一负责 schema 变更；所有新增字段在合并前都必须经过 Prisma migration 审核
- 搜索工程师与 AI 工程师共享的唯一边界是 `SearchResultItem` 输出结构与 `searchArticles()` 服务契约

## 团队分工建议

- 工程师 1：工作流 A + B
- 工程师 2：工作流 C + F
- 工程师 3：工作流 D
- 工程师 4：工作流 E
- 工程师 5：工作流 G + I
- 工程师 6：工作流 H

## 合并里程碑

### 里程碑 1：内容平台可用

- 工作流 A、B、C、D、E 完成
- 结果：管理员可以发布内容，访客可以浏览内容

### 里程碑 2：搜索能力可用

- 工作流 F、G、I 完成
- 结果：关键词搜索上线，缓存与日志可用

### 里程碑 3：AI 搜索可用

- 工作流 H 完成
- 结果：语义检索合入正式搜索链路

## 交付检查清单

- [x] 公开浏览功能可用
- [x] 后台鉴权可用
- [x] 文章发布流程可用
- [x] 搜索能返回相关结果
- [x] 重建索引流程能处理文章变更
- [x] Redis 缓存失效机制正常
- [x] 后台可查看搜索日志
- [x] 语义检索对至少一部分自然语言查询有明显提升
- [x] 后台文章编辑页支持 AI 关键词创作入口
- [x] 流式返回正文草稿并展示临时预览区
- [x] 用户手动插入或放弃草稿，不自动覆盖正文
- [x] 管理员与个人用户可区分登录
- [x] 个人文章提交后进入 AI 合规审核，AI 拒绝或异常转人工审核

## 自检

- 规格覆盖检查：公开站、后台 CMS、MySQL、Redis、语义搜索和分析能力都已映射到具体工作流
- 占位符检查：不存在 `TBD`、`TODO` 或“后续再处理”这类模糊项
- 类型一致性检查：前后端与 AI 工作流共享的类型命名统一基于 `Article*` 与 `SearchResultItem`
