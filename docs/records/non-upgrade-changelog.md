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

## 2026-05-31 (bugfix/260531)

- 修复管理后台自动登录死循环 bug：
  - **根因**：`/api/auth/refresh` 路由 token 刷新成功后只轮换了 refresh token cookie，未更新 `ka_admin_session` session cookie；而服务端渲染的 admin 页面（如 `/admin/articles`）通过 `requireRole` 校验 session cookie，导致刷新成功后跳转到 admin 页面仍被 302 到登录页，无限循环。
  - **F1 主修复**（`src/app/api/auth/refresh/route.ts`）：调用 `createSessionToken` + `getSessionCookieName`，在 token 刷新成功后同步颁发新的 session cookie，与登录流程保持一致。
  - **F2 兜底修复**（`src/app/admin/login/page.tsx`）：`ensureSession` 中 refresh 成功后不直接跳转，先执行 `probeAdminSession()` 确认 session 可用；probe 失败则 `clearAuthSession()` 并展示登录表单，不再循环。若自动登录失败（refresh 或 probe 均失败），清除 localStorage 登录记忆。
  - **验证**：`npx tsc --noEmit` 通过，无 TS 错误。

## 2026-05-31 (bugfix/260531 续)

- 移除 `.subPanel, .tableWrap, .pane, .aiPanel` 的 `overflow: hidden`，允许内容溢出（`src/app/admin/admin.css`）。
- 修复 `/api/admin/articles/import` 500 错误：Vercel serverless 环境下 `process.cwd()/.cache/imports` 只读，`mkdir + writeFile` 抛 EACCES。改为将文件内容存入数据库 `fileContent Bytes?` 字段，彻底去除文件系统依赖；新增迁移 `20260531100000_article_import_file_content`（`ALTER TABLE "ArticleImportTask" ADD COLUMN "fileContent" BYTEA`）。验证：`tsc --noEmit` 通过。
- 改善导入页上传区布局为 dropzone 风格（`src/components/admin/ArticleImportPanel.tsx` + `src/app/admin/admin.css`）：空态显示 dashed 虚线框提示；已选文件以列表形式展示文件名和大小（最高 180px 可滚动）；操作按钮集中在底部一行；新增 `.importUploadZone / .importDropHint / .importFileList / .importFileItem / .importUploadActions` 等 CSS 类。commit `f96fb06`。
- 修复 `/api/admin/articles/imports/process` 401 错误：上传 (`/import`) 与任务列表 (`/imports GET`) 都接受 `["ADMIN", "PERSONAL"]` 权限，但 `process` 端点仅接受 `["ADMIN"]`；PERSONAL 账号上传成功后触发处理时 401。修复：`requireRole(["ADMIN", "PERSONAL"])` 对齐。commit `c3a350d`。
- `.adminArticlesPanel, .adminImportsPanel, .adminReviewsPanel` 的 `overflow` 由 `hidden` 改为 `auto`，允许内容溢出时显示滚动条。
- 修复 PDF/DOCX 解析乱码 bug：新增 `mammoth`（DOCX→Markdown）和 `pdf-parse`（PDF→纯文本）依赖，重写 `article-import-parse.service.ts`；DOCX 由 `mammoth.convertToMarkdown` 处理，PDF 先用 `pdf-parse` 提取文本再送 AI 整理，图片类型改用 OpenAI vision multipart image_url 格式；彻底去除原有 `buffer.toString("utf8")` 对二进制格式的误用。
- 强化 `project-rules.instructions.md`：新增"Agent 执行强制检查清单"章节，要求每次改动结束前必须按序完成：写 changelog → 检查 README → 同批 commit → 回复确认，违反任意一条视为任务未完成。
- 修复 CI lint 失败：去除 `article-import-parse.service.ts` 中两行无效的 `eslint-disable-next-line @typescript-eslint/no-require-imports` 注释（该规则在 `eslint-config-next` 中不存在，成为多余指令触发警告）。验证：`npx eslint src/services/article-import-parse.service.ts --max-warnings 0` 通过。
