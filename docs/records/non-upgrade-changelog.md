# Non-Upgrade Changelog

记录升级内容之外的常规改动（例如：启动配置整理、测试稳定性修复、文档增强等）。

## 2026-05-21

- 新增 README 启动配置类说明，明确 `src/config` 的职责边界。
- 拆分变更记录入口：升级内容与非升级内容分开维护。
- E2E 稳定性增强：
  - Playwright webServer 以测试态启动。
  - AI 草稿流支持 E2E 快速模式固定输出。
  - 限流在 E2E 快速模式下放行，避免并发登录误伤。
  - `global.setup.ts` 增加数据库瞬断重试。

## 2026-05-23

- 强化多 Agent 工作流编排，要求阶段 1-7 严格按顺序执行，不允许跳步、并行或重排。

## 2026-05-28

- 新增后台导入解析与任务服务：支持导入任务创建、列表、重试与异步状态推进。
- 新增后台导入 API：`POST /api/admin/articles/import`、`GET /api/admin/articles/imports`、`POST /api/admin/articles/imports/[taskId]/retry`。
- 新增后台审核队列 API：`GET /api/admin/reviews/queue`。
- 发布/下线增加幂等保护：重复发布返回 `ALREADY_PUBLISHED`，重复下线返回 `ALREADY_DRAFT`（HTTP 409）。
- AI 配置新增导入模型项：`AI_IMPORT_TEXT_MODEL`、`AI_IMPORT_PDF_MODEL`、`AI_IMPORT_VISION_MODEL`。
- 质量验证：执行 `npm run lint && npm run typecheck` 通过。

## 2026-05-31

- 新增后台导入 UI：`ArticleImportPanel` 补充文件选择（隐藏 `<input type="file">`）、"上传并解析"按钮、已选文件列表与上传反馈，串联 `POST /api/admin/articles/import` + `POST /api/admin/articles/imports/process`。
- 修复 `authFetch` multipart 上传 bug：`body` 为 `FormData` 时不再强制注入 `content-type: application/json`，让浏览器自动生成含 `boundary` 的 multipart 头；否则服务端 `request.formData()` 解析失败并报"请求体必须是 multipart/form-data"。验证：`npm run typecheck && npm run lint` 通过（commit `576bdec`）。
- 新增 TDD 锚点测试（5 条，分散在现有 spec 文件末尾）：`UNSUPPORTED_FILE_TYPE` 错误码校验、超 5 文件上传 400 拒绝、personal 用户任务隔离、重复发布 409 `ALREADY_PUBLISHED`、process endpoint 路由存在性 smoke test。
- 新增 `scripts/probe-import-pipeline.ts`：本地验收探针，使用 Node 22 原生 `fetch` + `FormData`，无额外依赖；`package.json` 同步增加 `probe:import` 脚本。

## 2026-06-07

- 修复公开文章列表仅显示首屏分页的问题：新增 `PublicArticleInfiniteList`，基于 `IntersectionObserver` 触发增量加载，按 `id` 去重并加入 in-flight 并发保护，确保可滚动加载至全部已发布文章。
- 保持原有后端分页契约与筛选参数行为：继续使用 `/api/articles?page&pageSize&category&tag`，服务端页面仍负责 `page` 参数合法化与越界归一。
- 修复后台 `/admin/reviews` 审核列表的人工审核入口：新增 `AdminReviewActions`，在待审核项行内补充通过 / 驳回按钮并复用现有审核 API。
- 在后台审核列表补充稳定 `data-testid`，确保按钮可见性与交互可被 E2E 稳定覆盖。
- 稳定公开懒加载 E2E：将测试数据准备由“循环调用创建/发布 API”调整为“直接写入已发布文章数据”，规避测试期 `ECONNREFUSED/socket hang up` 抖动；同时保留 180s 超时上限。
- 修复原因：避免公开站文章浏览存在“仅少量文章可见”的可达性缺陷，并恢复后台待审核内容的人工处理入口。
- 验证命令与结果：
  - `npm run lint` -> 通过。
  - `npm run typecheck` -> 通过。
  - `npm run test:e2e -- tests/e2e/admin-comments.spec.ts --grep review` -> 通过（1 passed）。
  - `npm run test:e2e -- tests/e2e/public-browse.spec.ts --grep lazy-loads --reporter=line` -> 通过（1 passed）。
- 关联 commit hash：`de23fed`、`7a0853be15fe03e942ff1c1813af74d35ba8389c`、`5e9a00b`、本次提交后补充。

## 2026-06-07

- 修复“后台返回前台后列表不刷新”：将公开首页 `src/app/(public)/page.tsx` 改为 `force-dynamic`，避免返回前台时复用旧缓存导致已发布文章不可见。
- 修复“登录态过期死循环”：登录页自动登录策略增加前置保护，无本地会话或本地会话已过期时不再触发 refresh 链路。
- 增强过期会话清理：`/api/auth/refresh` 在 refresh token 无效/角色不匹配时立即清空 ADMIN/PERSONAL/LEGACY 相关 cookies。
- 统一注销清理范围：`/api/auth/logout` 与 `/api/admin/logout` 均改为同时清理 ADMIN/PERSONAL session + refresh + legacy，避免跨角色残留状态。
- 客户端失败兜底：`refreshAuthSession` 在 refresh 失败时额外调用 `/api/auth/logout`，确保服务端 cookie 与本地 localStorage 同步清空。
- 修复原因：历史实现只清理了部分登录态，过期后可能残留旧 cookie 触发重复自动登录；同时首页存在缓存命中导致后台变更后前台短时不可见。
- 验证命令与结果：
  - `npm run lint` -> 通过。
  - `npm run typecheck` -> 通过。
- 关联 commit hash：本提交（见 `git log -1 --oneline`）。
