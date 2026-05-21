# Supabase PostgreSQL Migration and CI/CD Design

**Problem:** 当前项目基于 MySQL，本次需要切换到免费可用的 PostgreSQL 托管（Supabase），并保留手动生产发布与全量质量门禁。
**Solution:** 使用 Supabase 作为生产 PostgreSQL，Prisma 从 mysql provider 切到 postgresql，GitHub Actions 负责全检查与手动生产发布，Vercel 负责应用托管与环境变量管理。
**Out of scope:** 多云容灾、跨区域双活、自动化灰度发布、复杂数据分片策略。

## Problem Definition

目标不是“换库”本身，而是：
1. 降低数据库托管成本（优先免费方案）。
2. 不破坏现有业务功能与数据完整性。
3. 保持发布流程可控（禁止自动生产发布，必须手动触发）。
4. 在同一条交付链中强制执行质量门禁。

成功标准（Done）：
1. 应用生产连接 Supabase PostgreSQL 正常运行。
2. 既有核心数据完整迁移，且关键表数据校验通过。
3. CI 对以下检查全部强制通过：Typecheck、ESLint、单测、Playwright E2E、Prisma 检查。
4. 生产发布仅支持手动按钮触发，无自动直发。
5. 配置项可在 Vercel 与 GitHub 的可视化界面维护。

## Chosen Technical Approach

选型结论：Supabase PostgreSQL（免费层）+ Prisma PostgreSQL + GitHub Actions + Vercel。

构建策略约束：
1. Next.js 产物只在云端构建（GitHub Actions 或 Vercel Build）。
2. 本地构建仅用于开发自检，不作为发布产物来源。
3. 生产部署必须由手动触发的云端工作流执行。

为何选择该方案：
1. 免费层可用，适合当前阶段。
2. 与 Vercel 集成成熟，连接管理方便。
3. Prisma 对 PostgreSQL 支持完善，迁移路径清晰。
4. 可实现“代码合并不自动发生产，手动触发发布”的流程控制。

## Interface and Data Structures

### 1) Environment Variables

运行时（Vercel Project Settings -> Environment Variables）：
1. DATABASE_URL（Supabase 生产连接串，pooled URL）
2. AUTH_SECRET
3. REDIS_URL（可选）
4. QDRANT_URL
5. QDRANT_API_KEY
6. QDRANT_COLLECTION
7. EMBEDDING_PROVIDER
8. EMBEDDING_API_KEY
9. EMBEDDING_BASE_URL
10. OPENAI_API_KEY
11. EMBEDDING_MODEL
12. AI_WRITER_MODEL
13. AI_REVIEW_MODEL
14. AI_WRITER_MAX_CHARS
15. SEARCH_SEMANTIC_MIN_SCORE

流水线（GitHub Repository/Environment Secrets）：
1. VERCEL_TOKEN
2. VERCEL_ORG_ID
3. VERCEL_PROJECT_ID
4. DATABASE_URL_CI（仅 CI 用）
5. E2E 必需的测试密钥（如有）

### 2) Prisma Layer Changes

计划变更：
1. prisma/schema.prisma 中 datasource provider：mysql -> postgresql。
2. 生成 PostgreSQL 迁移并执行。
3. 核对 Json、Text、索引在 PostgreSQL 下的实际 DDL 映射。

### 3) CI/CD Workflow Layout

工作流拆分：
1. ci.yml（PR 与主分支提交触发）
2. deploy-prod.yml（workflow_dispatch 手动触发）

ci.yml 阶段：
1. 安装依赖
2. Prisma 校验（prisma validate / prisma generate）
3. 云端 Next.js 打包（next build，仅在 GitHub Actions 执行）
4. Typecheck
5. ESLint
6. 单测
7. Playwright E2E

deploy-prod.yml 阶段：
1. 手动输入发布参数（可选版本说明）
2. 在云端构建产物（next build 或 vercel build）
3. 执行生产数据库迁移（prisma migrate deploy）
4. vercel deploy --prod（仅手动触发）

首次初始化策略：
1. 第一次上线前必须执行 prisma migrate deploy，完成表结构初始化。
2. 若需要默认管理员账号、分类、标签等基础数据，执行一次性 seed（prisma db seed）。
3. seed 仅在首次初始化或明确需要重建基础数据时运行，避免重复写入。

## Migration Plan (Execution Steps)

### Phase 0 - Preparation

1. 创建迁移分支（示例：chore/postgres-supabase-migration）。
2. 盘点现网写入高峰，预留最终切换窗口。
3. 在 Supabase 创建生产数据库与应用用户。

### Phase 1 - Schema and Code Switch

1. 修改 prisma/schema.prisma provider 为 postgresql。
2. 更新 .env.example 的 DATABASE_URL 示例为 PostgreSQL 格式。
3. 运行 Prisma 生成与迁移，修复类型差异问题。
4. 本地用 PostgreSQL 启动项目并通过基础 smoke。

### Phase 2 - Data Migration

1. 从 MySQL 导出全量数据（建议先在只读快照上导出）。
2. 导入 PostgreSQL。
3. 执行数据校验：
- 表行数比对：AdminUser、PersonalUser、Article、ArticleReview、Category、Tag、SearchLog、ArticleChunk
- 抽样数据完整性比对：文章状态、作者归属、审核记录、标签关联

### Phase 3 - Verification

在迁移分支运行全量检查：
1. Typecheck
2. ESLint
3. 单测
4. Playwright E2E
5. Prisma 检查（validate/generate/migrate status）

### Phase 4 - Production Cutover

1. 冻结写入（短窗口）。
2. 将生产 DATABASE_URL 切到 Supabase。
3. 首次执行 prisma migrate deploy（必要时追加一次 seed）。
4. 执行最终增量迁移（若切换窗口内仍有变更）。
5. 通过 GitHub Actions 手动按钮触发生产发布。
5. 观察关键指标（登录、发文、审核、搜索）30-60 分钟。

### Phase 5 - Rollback Strategy

回滚触发条件：
1. 核心交易路径失败率异常上升。
2. 数据一致性检查失败。

回滚动作：
1. 恢复 Vercel 生产 DATABASE_URL 到原 MySQL。
2. 重新手动触发生产发布。
3. 冻结迁移分支，定位问题后二次切换。

## Edge Cases

1. PostgreSQL 与 MySQL 大小写/排序规则差异导致唯一约束行为不同。
2. 时区处理差异影响 createdAt/updatedAt 比对。
3. JSON 字段序列化差异影响深比较。
4. E2E 依赖外部服务（Qdrant/AI）时的不稳定性。
5. Supabase 免费层连接上限不足导致突发连接错误（需连接池策略与监控）。

## Security and Config Governance

1. 所有密钥仅存放在 GitHub Secrets 与 Vercel Environment Variables。
2. 禁止提交任何真实连接串到仓库。
3. 生产发布工作流绑定 GitHub Environment 审批（可选开启）。

## Acceptance Criteria

- [ ] Prisma provider 已从 mysql 切为 postgresql 并可通过生成与校验。
- [ ] Supabase DATABASE_URL 已接入并可在本地/预发正常运行。
- [ ] 核心业务数据迁移完成并通过表级与抽样校验。
- [ ] CI 中 Typecheck、ESLint、单测、Playwright E2E、Prisma 检查全绿。
- [ ] 生产发布仅支持手动触发，不存在自动发生产路径。
- [ ] 回滚预案经过至少一次演练或桌面演练确认。

## Implementation Notes for Next Step

下一步建议用写计划技能拆成可执行任务单：
1. 代码改造任务（Prisma 与配置）
2. 数据迁移任务（导出、导入、校验）
3. 流水线任务（CI 与手动发布）
4. 切换与回滚演练任务