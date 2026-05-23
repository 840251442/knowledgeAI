# 2026-05-22 Article Index Status Observability Implementation Plan

关联设计文档：[docs/designs/2026-05-22-article-index-status-observability-design.md](docs/designs/2026-05-22-article-index-status-observability-design.md)

## 目标
- 后台编辑器索引状态改为真实可观测，不再固定显示“待处理”。
- 发布后必触发向量重建；已发布文章保存时自动重建；草稿保存不触发。
- 提供手动重建索引能力，并处理并发触发冲突。

## 范围
- 包含：服务层状态聚合、后台索引状态 API、手动重建 API、编辑器状态展示与轮询。
- 不包含：任务队列系统、任务取消/优先级、向量版本回滚、全量巡检任务。

## 实施步骤

### Phase 1 - 服务层状态聚合
- [x] 在服务层新增 `getArticleIndexStatus`（按 articleId + actor 权限）。
- [x] 聚合最近 `embeddingTask` 与 `articleChunk` 统计（total/done/failed）。
- [x] 服务端统一状态映射：`not_started | pending | running | success | failed`。
- [x] 返回最近任务关键信息（taskType/status/startedAt/finishedAt/errorMessage）。

完成判定：给定文章 ID 可稳定返回统一索引状态对象。

### Phase 2 - 后台 API
- [x] 新增 `GET /api/admin/articles/[id]/index-status`。
- [x] 新增 `POST /api/admin/articles/[id]/reindex`。
- [x] 增加并发保护：已有 `PENDING/RUNNING` 任务时返回 409（`INDEX_TASK_RUNNING`）。
- [x] 增加权限校验：ADMIN 全量，PERSONAL 仅本人文章。

完成判定：接口可正确返回 200/401/403/404/409 语义。

### Phase 3 - 触发规则修正
- [x] 发布流程保留索引触发（`taskType=PUBLISH`）。
- [x] 更新流程按规则触发：仅当文章处于已发布状态时触发 `UPDATE` 索引。
- [x] 草稿保存不触发重建索引。

完成判定：触发行为与规则一致，避免草稿无效重建。

### Phase 4 - 编辑器真实状态展示
- [x] `ArticleEditor` 接入 `index-status` 读取并展示状态文案与颜色。
- [x] 展示最近任务时间与失败原因摘要（有则显示）。
- [x] “重建索引”按钮接入 `reindex`，处理中禁用。
- [x] 重建后轮询状态（2s 一次，最多 60s），超时给出提示。

完成判定：编辑器可见真实状态流转，失败可见且可重试。

### Phase 5 - 验证与回归
- [x] `npm run typecheck`。
- [x] `npm run lint`。
- [x] 增加/更新 API 与组件层测试（至少覆盖：成功、失败、并发冲突、权限拒绝）。
- [x] 人工回归：发布 -> 索引成功；已发布保存 -> 自动重建；草稿保存 -> 不重建。（通过 E2E 自动化完成）

完成判定：核心链路通过且无新增类型/lint问题。

## 风险与应对
- 风险：外部向量服务偶发失败导致状态抖动。
  - 应对：以任务最终态为准，前端展示最后失败原因并允许重试。
- 风险：并发点击造成重复任务。
  - 应对：服务端 409 防重，前端按钮防抖与禁用。
- 风险：PERSONAL 越权查看他人索引状态。
  - 应对：服务端以 actor 范围强约束。

## 验收清单
- [x] 发布文章后会写入索引任务并最终可见成功/失败。
- [x] 已发布文章保存会自动触发索引重建。
- [x] 草稿保存不会触发索引重建。
- [ ] 后台索引状态展示为真实状态，不再固定“待处理”。
- [ ] 手动重建可用，任务进行中重复触发返回 409。
- [x] PERSONAL 无法查看/触发非本人文章索引。
- [x] typecheck/lint/关键测试通过。

## 增量同步记录
- [x] 2026-05-22：完成索引状态可观测主链路（服务聚合 + 后台 API + 编辑器展示与手动重建）。
  - 服务层：[src/services/admin-article.service.ts](src/services/admin-article.service.ts), [src/services/reindex.service.ts](src/services/reindex.service.ts)
  - API：[src/app/api/admin/articles/[id]/index-status/route.ts](src/app/api/admin/articles/[id]/index-status/route.ts), [src/app/api/admin/articles/[id]/reindex/route.ts](src/app/api/admin/articles/[id]/reindex/route.ts)
  - 前端：[src/components/admin/ArticleEditor.tsx](src/components/admin/ArticleEditor.tsx)
- [x] 2026-05-22：补充索引可观测回归测试并通过。
  - E2E：[tests/e2e/article-index-observability.spec.ts](tests/e2e/article-index-observability.spec.ts)
  - 覆盖：401/403/404 鉴权语义、发布触发 PUBLISH、已发布保存触发 UPDATE、手动触发 MANUAL、草稿保存不触发索引任务。
