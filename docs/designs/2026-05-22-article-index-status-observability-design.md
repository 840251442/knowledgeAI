# 后台文章索引状态可观测 Design

**Problem:** 后台编辑器索引状态是静态文案，无法判断“发布后是否真正入向量库”，导致混合搜索可用性不可观测。
**Solution:** 新增后台索引状态查询与手动重建接口，并在编辑器展示真实状态（进行中/成功/失败），对已发布文章保存自动重建索引。
**Out of scope:** 不引入任务队列系统、不做任务取消/优先级、不做向量版本回滚与灰度切换、不做全量自动巡检。

## Technical Approach

### 1) 触发规则
- 发布文章时：必须触发索引重建（taskType=PUBLISH）。
- 已发布文章编辑保存时：自动触发索引重建（taskType=UPDATE）。
- 草稿保存：不触发向量重建。

### 2) 后台接口
- GET /api/admin/articles/:id/index-status
  - 读取该文章最新索引任务与 chunk 汇总，返回统一状态。
- POST /api/admin/articles/:id/reindex
  - 手动触发重建；若已有 RUNNING/PENDING 任务则返回 409。

### 3) 状态计算（服务端统一）
- failed: 最新任务为 FAILED。
- running: 最新任务为 RUNNING。
- pending: 最新任务为 PENDING。
- success: 最新任务为 SUCCESS，且 chunk done > 0。
- not_started: 无任务记录或不满足成功条件。

### 4) 前端展示
- 编辑器索引区展示真实状态（替代固定“索引：待处理”）。
- 显示最近任务时间、失败原因摘要（如有）。
- 提供“重建索引”按钮，触发后轮询状态（2s/次，最多 60s）。

### 5) 失败与降级
- 向量服务不可用时任务标记 FAILED，不阻塞发布主流程。
- 前端明确提示“索引失败，可重试”，不可静默。

## Interface / Data Structures

### GET /api/admin/articles/:id/index-status

成功响应示例：

```json
{
  "success": true,
  "data": {
    "articleId": "xxx",
    "state": "success",
    "latestTask": {
      "id": "task_xxx",
      "taskType": "PUBLISH",
      "status": "SUCCESS",
      "startedAt": "2026-05-22T10:00:00.000Z",
      "finishedAt": "2026-05-22T10:00:07.000Z",
      "errorMessage": null
    },
    "chunkSummary": {
      "total": 8,
      "done": 8,
      "failed": 0
    },
    "lastSuccessAt": "2026-05-22T10:00:07.000Z"
  }
}
```

### POST /api/admin/articles/:id/reindex

成功响应示例：

```json
{
  "success": true,
  "data": {
    "taskId": "task_xxx",
    "state": "running"
  }
}
```

并发冲突示例（已有运行任务）：

```json
{
  "success": false,
  "error": {
    "code": "INDEX_TASK_RUNNING",
    "message": "索引任务进行中"
  }
}
```

## Edge Cases
- PERSONAL 访问非本人文章索引：403。
- 文章不存在：404。
- 未登录：401。
- RUNNING 长时间未结束：前端轮询超时后提示“稍后刷新查看结果”。
- SUCCESS 但 chunk=0：按 not_started 处理并提示未产出有效切片。

## Acceptance Criteria
- [ ] 发布文章后会创建索引任务，最终可见 SUCCESS/FAILED。
- [ ] 已发布文章编辑保存后会自动触发 UPDATE 索引任务。
- [ ] 编辑器索引状态展示为真实状态，不再固定“待处理”。
- [ ] 手动重建索引可用，且运行中重复触发会返回 409。
- [ ] PERSONAL 无法查看/触发非本人文章索引。
- [ ] 索引失败时可看到失败原因摘要并可重试。
- [ ] 轮询超时有明确提示，不会无限请求。
