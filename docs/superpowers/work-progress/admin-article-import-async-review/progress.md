# 后台文章导入与异步审核 Progress

## 目标
- 在后台文章列表支持 pdf/图片/doc/docx/txt 多文件导入。
- 导入解析采用异步任务，提供导入任务列表与失败重试能力。
- 导入成功后自动创建上传者草稿，标题取文件名（去后缀），摘要取正文片段。
- 作者点击发布进入 AI 审核中，审核通过后从审核列表移除。
- 已发布文章禁止重复发布，需先下线再发布。

## 当前阶段
- 阶段 5/7：执行阶段进行中（DB 与后端 API 子任务已完成并通过复审）。

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

## 进行中
- 分发并集成 UI 子任务（后台导入列表与审核列表页面）。

## 阻塞项
- 无。

## 下一步
1. 分发第 3 个子 Agent（后台 UI 页面与交互）。
2. 集成 UI 子任务并执行最终质量门禁。
3. 调用 `acceptance-reviewer` 输出验收结论与合并建议。

## 验证证据
- 命令：`git branch --show-current` 结果：`feature/export`。
- 命令：`node -v` 结果：`v22.22.3`（满足执行门禁）。
- 命令：`npm run db:generate && npm run lint && npm run typecheck`（DB 子任务 worktree）结果：通过。
- 命令：`npm run lint && npm run typecheck`（后端子任务 worktree）结果：通过。
- 提交：`1a227c4 feat: add article import task schema` 已在 `feature/export`。

## 变更文件
- `docs/designs/2026-05-27-admin-article-import-async-review-design.md`
- `docs/superpowers/plans/2026-05-27-admin-article-import-async-review-implementation.md`
- `docs/superpowers/work-progress/admin-article-import-async-review/progress.md`
