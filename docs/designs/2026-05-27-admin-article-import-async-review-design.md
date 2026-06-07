# Admin Article Import Async Review Design

**Problem:** 后台缺少多格式文件导入与异步解析能力，无法将上传文件自动转为文章草稿并接入 AI 审核/发布流程。
**Solution:** 新增导入任务数据模型与异步解析管线，在后台提供导入列表和审核列表，并将发布动作接入“AI 审核中 -> 审核结论”状态机。
**Out of scope:** 本期不做外部对象存储迁移、不做复杂内容清洗规则编辑器、不做跨租户权限体系改造。

## Technical Approach

### 1) Import Pipeline (Async)
1. 后台文章列表页新增“导入文件”入口，ADMIN/PERSONAL 均可见。
2. 单次上传 1-5 个文件（pdf/image/doc/docx/txt），服务端做硬校验。
3. 每个文件创建一条导入任务（`QUEUED`），由后台 worker 异步处理。
4. worker 拉取任务后置为 `PROCESSING`，按文件类型路由不同 Qwen 模型：
   - pdf -> 文档理解模型
   - image(png/jpg/jpeg/webp) -> 视觉理解模型
   - doc/docx/txt -> 文本理解模型
5. 解析成功后创建文章草稿（`DRAFT`）：
   - `title = 文件名去后缀`
   - `summary = 正文前一段截取`
   - `contentMarkdown = 解析正文`
   - 归属当前上传者
6. 任务完成置 `SUCCEEDED` 并记录 `articleId`；失败置 `FAILED`，记录错误码与错误信息。

### 2) Review & Publish State Machine
1. 新导入文章默认 `DRAFT`。
2. 作者点击发布：
   - 文章从 `DRAFT` 进入 `PENDING_REVIEW`（AI 审核中）。
3. AI 审核结果：
   - `APPROVED` -> 文章 `PUBLISHED`，从审核列表移除。
   - `REJECTED` 或 `MANUAL_REQUIRED` -> 留在审核列表待管理员审批。
4. 已发布文章再次点击发布必须被禁止；仅在先下线（`UNPUBLISH -> DRAFT`）后才可重新发布。

### 3) Complete Enhancements
1. 失败任务支持重试（`RETRYING`），限制最大重试次数。
2. 用户级并发限制与全局 worker 并发参数可配置。
3. 审计记录：保留任务生命周期时间戳、模型名、错误细节。

## Interface / Data Structures

### Data Model
- 新增 `ArticleImportTask`：
  - identity: `id`
  - uploader: `uploaderRole`, `uploaderId`
  - file meta: `fileName`, `fileType`, `fileSize`, `storagePath`
  - process: `status(QUEUED|PROCESSING|SUCCEEDED|FAILED|RETRYING)`, `parseModel`
  - result: `parsedTitle`, `parsedSummary`, `parsedContent`, `articleId`
  - error: `errorCode`, `errorMessage`
  - retry: `retryCount`, `maxRetries`
  - time: `startedAt`, `finishedAt`, `createdAt`, `updatedAt`

### API Endpoints
1. `POST /api/admin/articles/import`
   - 入参：multipart files（1-5）
   - 出参：`taskIds[]`
2. `GET /api/admin/articles/imports`
   - 入参：分页/状态过滤
   - 权限：ADMIN 全量可见，PERSONAL 仅本人
3. `POST /api/admin/articles/imports/[taskId]/retry`
   - 权限：任务所属人或管理员
4. `GET /api/admin/reviews/queue`
   - 返回 AI 审核中/命中风险/人工待审文章
5. `POST /api/admin/articles/[id]/publish`
   - 补充状态幂等保护：已发布不可重复发布
6. `POST /api/admin/articles/[id]/unpublish`
   - 下线回草稿

### Admin UI
1. 文章列表页：导入按钮 + 审核列表入口 + 发布/下线互斥按钮。
2. 导入任务页：展示 `QUEUED/PROCESSING/SUCCEEDED/FAILED/RETRYING`，支持失败重试。
3. 审核列表页：展示 AI 审核中和风险待审项，管理员可审批。

## Edge Cases
1. 上传超过 5 个文件：直接 400 拒绝。
2. 不支持格式：任务置 `FAILED`，错误码 `UNSUPPORTED_FILE_TYPE`。
3. 模型超时/空响应：任务失败并允许重试。
4. 标题冲突（同名文件）：写入时自动生成后缀避免 slug 冲突。
5. 用户在解析中刷新页面：通过导入任务列表追踪，不依赖前端长连接。
6. 已发布重复发布：返回冲突错误，不改变数据。
7. AI 审核中重复点击发布：返回“审核中”错误，防止重复入队。

## Acceptance Criteria
- [ ] 后台文章列表中，ADMIN/PERSONAL 都能看到导入按钮并上传文件。
- [ ] 单次上传超过 5 个文件会被拦截。
- [ ] 上传后在导入任务列表看到“解析中”，完成后看到成功/失败状态。
- [ ] 成功解析的文件会在对应上传者文章列表中新增草稿。
- [ ] 草稿标题为文件名去后缀，摘要来自正文片段。
- [ ] 作者点击发布后进入审核中，AI 审核通过后从审核列表移除。
- [ ] 已发布文章不能重复发布，必须先下线后再发布。
- [ ] 模拟多种文件（pdf/image/doc/txt）导入可成功创建文章。

