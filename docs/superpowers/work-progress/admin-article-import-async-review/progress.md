# 后台文章导入与异步审核 Progress

## 目标
- 在后台文章列表支持 pdf/图片/doc/docx/txt 多文件导入。
- 导入解析采用异步任务，提供导入任务列表与失败重试能力。
- 导入成功后自动创建上传者草稿，标题取文件名（去后缀），摘要取正文片段。
- 作者点击发布进入 AI 审核中，审核通过后从审核列表移除。
- 已发布文章禁止重复发布，需先下线再发布。

## 当前阶段
- 阶段 7/7：收口阶段已完成，等待合并建议落定。

## 已完成项
- [x] 输入完整性检查完成（目标、约束、验收标准、目标分支、计划来源确认）。
- [x] 目标分支已切换到 `feature/export`（与发起分支 `dev` 区分）。
- [x] 需求阶段完成：按 1-2 问节奏澄清、完成方案比选与分块确认。
- [x] 设计文档已保存：`docs/designs/2026-05-27-admin-article-import-async-review-design.md`。
- [x] 计划阶段完成：实施计划已保存并消除占位符路径。
- [x] 计划文档已保存：`docs/superpowers/plans/2026-05-27-admin-article-import-async-review-implementation.md`。
- [x] 本任务 progress 文档已创建并初始化。
- [x] Node 执行门禁已通过：`node -v` 为 `v22.22.3`。
- [x] 隔离开发准备已完成：已创建独立子分支与 worktree。
- [x] DB 子任务已完成并通过二阶段复审，已集成到目标分支提交 `1a227c4`。
- [x] 后端导入解析服务已完成：`src/services/article-import-parse.service.ts`。
- [x] 后端导入任务服务已完成：`src/services/article-import.service.ts`。
- [x] 导入 API 已完成：`/api/admin/articles/import`、`/api/admin/articles/imports`、`/api/admin/articles/imports/[taskId]/retry`。
- [x] 审核队列 API 已完成：`/api/admin/reviews/queue`。
- [x] 发布幂等保护已完成：支持 `ALREADY_PENDING`、`ALREADY_PUBLISHED` 冲突返回。
- [x] UI 子任务已完成：文章管理新增导入/审核入口、行级发布/下线互斥按钮。
- [x] UI 子任务已完成：新增导入任务页面与失败重试按钮（`import-task-retry`）和状态标识（`import-task-status`）。
- [x] UI 子任务已完成：新增审核列表页面，展示 AI 审核中/命中风险/待人工状态。
- [x] 关键交互测试已补充：`tests/e2e/admin-auth.spec.ts` 增加入口导航用例。
- [x] 质量阻断修复（2026-05-28）：后台文章列表中 `PENDING_REVIEW` 状态与 `PUBLISHED` 一样禁用“发布”按钮。
- [x] 服务端兜底修复（2026-05-28）：`publishAdminArticle` 新增 `PENDING_REVIEW` 拦截并抛出 `ARTICLE_ALREADY_PENDING`。
- [x] 最小回归测试补强（2026-05-28）：`tests/e2e/auth-role-review.spec.ts` 对待审核发布冲突补充错误文案断言，继续覆盖 409 + `ALREADY_PENDING`。
- [x] 异步处理执行入口已补齐：`/api/admin/articles/imports/process`。
- [x] 导入成功验收用例已补齐：`tests/e2e/admin-import-api.spec.ts` 覆盖“入队 -> 批处理 -> 草稿落库”。
- [x] 关键 E2E 子集已全量通过（16 passed）。

## 进行中
- 无。

## 阻塞项
- 无。

## 下一步
1. 汇总最终合并建议。
2. 记录剩余未验证项与上线注意事项。
3. 等待用户决定是否合并。

## 验证证据
- 命令：`git branch --show-current` 结果：`feature/export`。
- 命令：`node -v` 结果：`v22.22.3`（满足执行门禁）。
- 命令：`npm run db:generate && npm run lint && npm run typecheck`（DB 子任务 worktree）结果：通过。
- 命令：`npm run lint && npm run typecheck`（后端子任务 worktree）结果：通过。
- 命令：`npm run lint && npm run typecheck`（UI 子任务 worktree）结果：通过。
- 命令：`npm run lint`（worktree：`feature/export-import-ui-v2`）结果：通过。
- 命令：`npm run typecheck`（worktree：`feature/export-import-ui-v2`）结果：通过。
- 命令：`npm run lint && npm run typecheck`（target branch：feature/export）结果：通过。
- 命令：`npm run test:e2e -- tests/e2e/admin-import-api.spec.ts tests/e2e/auth-role-review.spec.ts tests/e2e/admin-auth.spec.ts` 结果：16 passed。
- 命令：`npm run test:e2e -- tests/e2e/admin-import-api.spec.ts` 结果：2 passed。
- 验收命令：`npm run lint`、`npm run typecheck`、`npm run test:e2e -- tests/e2e/admin-import-api.spec.ts tests/e2e/auth-role-review.spec.ts tests/e2e/admin-auth.spec.ts`。
- 验收结果：`ACCEPTANCE_RESULT: PASS`（16 passed）。
- 提交：`1a227c4 feat: add article import task schema` 已在 `feature/export`。
- 提交：`4e5eab4 feat: add import processing endpoint and acceptance e2e` 已在 `feature/export`。

## 合并建议
- 可合并到上游分支。
- 建议合并前保持 `feature/export` 当前提交 `4e5eab4` 为基线。
- 合并后继续观察导入任务状态分布与失败码占比。

## 变更文件
- `docs/designs/2026-05-27-admin-article-import-async-review-design.md`
- `docs/superpowers/plans/2026-05-27-admin-article-import-async-review-implementation.md`
- `docs/superpowers/work-progress/admin-article-import-async-review/progress.md`
- `src/app/admin/articles/page.tsx`
- `src/app/admin/articles/imports/page.tsx`
- `src/app/admin/reviews/page.tsx`
- `src/components/admin/ArticleImportPanel.tsx`
- `src/app/admin/admin.css`
- `tests/e2e/admin-auth.spec.ts`
- `src/app/admin/articles/page.tsx`
- `src/services/admin-article.service.ts`
- `tests/e2e/auth-role-review.spec.ts`
