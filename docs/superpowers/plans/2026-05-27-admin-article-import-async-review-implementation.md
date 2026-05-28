# Admin Article Import Async Review Implementation Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 在后台文章列表实现多格式文件异步导入、导入任务列表、审核列表与发布/下线状态互斥，满足单次最多 5 文件与按类型路由 Qwen 模型解析。

**Architecture:** 采用 DB 任务队列模式：上传接口只负责入队，解析 worker 负责状态推进与草稿落库。审核列表复用现有 Article 与 ArticleReview 状态，新增导入任务实体承载文件解析生命周期。前端分为文章列表增强、导入任务页与审核队列页，后端分为导入 API、任务处理服务、审核/发布状态保护。

**Tech Stack:** Next.js App Router, Prisma, PostgreSQL, OpenAI/Qwen-compatible API, Playwright

---

### Task 1: Prisma 导入任务模型与迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260527100000_article_import_tasks/migration.sql`
- Modify: `src/types/article.ts`
- Test: `tests/e2e/admin-ai-draft.spec.ts`

- [x] **Step 1: Write failing test for import task visibility contract**

```typescript
it("shows import task status in admin import list", async ({ page }) => {
  await page.goto("/admin/articles/imports");
  await expect(page.getByTestId("import-task-status").first()).toBeVisible();
});
```

- [x] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/admin-ai-draft.spec.ts --grep "import task status"`
Expected: FAIL - route or selector not found

- [x] **Step 3: Add Prisma enum/model for import tasks**

```prisma
enum ArticleImportTaskStatus {
  QUEUED
  PROCESSING
  SUCCEEDED
  FAILED
  RETRYING
}

model ArticleImportTask {
  id           String                  @id @default(cuid())
  uploaderRole UserRole
  uploaderId   String
  fileName     String
  fileType     String
  fileSize     Int
  storagePath  String
  status       ArticleImportTaskStatus @default(QUEUED)
  parseModel   String?
  parsedTitle  String?
  parsedSummary String?
  parsedContent String?
  articleId    String?
  errorCode    String?
  errorMessage String?
  retryCount   Int                     @default(0)
  maxRetries   Int                     @default(3)
  startedAt    DateTime?
  finishedAt   DateTime?
  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  article      Article?                @relation(fields: [articleId], references: [id], onDelete: SetNull)

  @@index([uploaderId, createdAt])
  @@index([status, updatedAt])
}
```

- [x] **Step 4: Generate migration SQL and article import types**

Run: `npx prisma migrate dev --name article_import_tasks`
Expected: migration created with enum/table/indexes

- [x] **Step 5: Run test to confirm schema-dependent compile passes**

Run: `npm run lint && npm run typecheck`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/types/article.ts tests/e2e/admin-ai-draft.spec.ts
git commit -m "feat: add article import task schema"
```

### Task 2: 文件类型路由与解析服务

**Files:**
- Create: `src/services/article-import-parse.service.ts`
- Modify: `src/config/ai.ts`
- Modify: `src/services/ai-article-agent.service.ts`
- Test: `tests/e2e/article-index-observability.spec.ts`

- [ ] **Step 1: Write failing test for file type model routing**

```typescript
it("routes parser model by file type", async () => {
  const pdfModel = selectImportModel("application/pdf");
  const imgModel = selectImportModel("image/png");
  const txtModel = selectImportModel("text/plain");
  expect(pdfModel).not.toBe(imgModel);
  expect(txtModel).toBeDefined();
});
```

- [x] **Step 2: Run test to confirm failure**

Run: `npm run test -- tests/e2e/article-index-observability.spec.ts --grep "routes parser model"`
Expected: FAIL - selectImportModel undefined

- [x] **Step 3: Implement deterministic model router + parser facade**

```typescript
export function selectImportModel(fileType: string) {
  if (fileType === "application/pdf") return aiConfig.importPdfModel;
  if (fileType.startsWith("image/")) return aiConfig.importVisionModel;
  if (fileType === "text/plain" || fileType.includes("word")) return aiConfig.importTextModel;
  throw new Error("UNSUPPORTED_FILE_TYPE");
}
```

- [x] **Step 4: Implement parse entry with normalized output**

```typescript
export async function parseImportFile(input: ParseInput): Promise<ParseOutput> {
  const model = selectImportModel(input.fileType);
  const text = await callQwenForExtraction({ model, content: input.bufferBase64, fileType: input.fileType });
  return {
    model,
    title: stripFileExt(input.fileName),
    summary: summarizeText(text, 120),
    contentMarkdown: text,
  };
}
```

- [x] **Step 5: Run targeted tests**

Run: `npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/article-import-parse.service.ts src/config/ai.ts src/services/ai-article-agent.service.ts tests/e2e/article-index-observability.spec.ts
git commit -m "feat: add import parser model routing"
```

### Task 3: 导入任务服务与状态推进

**Files:**
- Create: `src/services/article-import.service.ts`
- Modify: `src/services/admin-article.service.ts`
- Create: `src/lib/security/file-upload.ts`
- Test: `tests/e2e/admin-comments.spec.ts`

- [ ] **Step 1: Write failing test for max-5 upload guard**

```typescript
it("rejects when upload count is greater than five", async ({ request }) => {
  const res = await request.post("/api/admin/articles/import", { multipart: buildFiles(6) });
  expect(res.status()).toBe(400);
});
```

- [x] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/admin-comments.spec.ts --grep "greater than five"`
Expected: FAIL - endpoint not implemented

- [x] **Step 3: Implement createImportTasks with validation**

```typescript
if (files.length < 1 || files.length > 5) {
  throw new Error("IMPORT_FILE_COUNT_INVALID");
}
```

- [x] **Step 4: Implement processNextImportTask state transition**

```typescript
// QUEUED -> PROCESSING -> SUCCEEDED/FAILED (+ RETRYING)
await prisma.$transaction(async (tx) => {
  const task = await lockNextTask(tx);
  if (!task) return null;
  await tx.articleImportTask.update({ where: { id: task.id }, data: { status: "PROCESSING", startedAt: new Date() } });
  // parse + create draft article + finalize status
});
```

- [x] **Step 5: Run lint/typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/article-import.service.ts src/services/admin-article.service.ts src/lib/security/file-upload.ts tests/e2e/admin-comments.spec.ts
git commit -m "feat: add import task service and queue transitions"
```

### Task 4: 导入 API（上传/列表/重试）

**Files:**
- Create: `src/app/api/admin/articles/import/route.ts`
- Create: `src/app/api/admin/articles/imports/route.ts`
- Create: `src/app/api/admin/articles/imports/[taskId]/retry/route.ts`
- Modify: `src/lib/api/response.ts`
- Test: `tests/e2e/public-article-comments.spec.ts`

- [ ] **Step 1: Write failing API test for import list visibility rule**

```typescript
it("returns only own import tasks for personal user", async ({ request }) => {
  const res = await request.get("/api/admin/articles/imports?page=1&pageSize=20");
  expect(res.status()).toBe(200);
  // assert payload filtered by current actor
});
```

- [x] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/public-article-comments.spec.ts --grep "own import tasks"`
Expected: FAIL - endpoint missing

- [x] **Step 3: Implement POST import API with multipart parsing**

```typescript
const form = await request.formData();
const files = form.getAll("files").filter((v): v is File => v instanceof File);
const result = await createImportTasks({ files, actor: { id: user.id, role: user.role } });
return apiOk(result, { status: 201 });
```

- [x] **Step 4: Implement GET imports and POST retry APIs**

```typescript
const tasks = await listImportTasks({ actor, page, pageSize, status });
const retried = await retryImportTask({ taskId, actor });
```

- [x] **Step 5: Run API-focused tests**

Run: `npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/articles/import/route.ts src/app/api/admin/articles/imports/route.ts src/app/api/admin/articles/imports/[taskId]/retry/route.ts src/lib/api/response.ts tests/e2e/public-article-comments.spec.ts
git commit -m "feat: add import upload list and retry apis"
```

### Task 5: 审核队列 API 与发布幂等保护

**Files:**
- Create: `src/app/api/admin/reviews/queue/route.ts`
- Modify: `src/services/review.service.ts`
- Modify: `src/services/admin-article.service.ts`
- Test: `tests/e2e/auth-role-review.spec.ts`

- [ ] **Step 1: Write failing test for publish idempotency**

```typescript
it("blocks duplicate publish when article is already published", async ({ request }) => {
  const res = await request.post(`/api/admin/articles/${seedPublishedId}/publish`);
  expect(res.status()).toBe(409);
});
```

- [x] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/auth-role-review.spec.ts --grep "duplicate publish"`
Expected: FAIL - current API may return success

- [x] **Step 3: Add strict state guards in publish/unpublish and review queue query**

```typescript
if (article.status === "PUBLISHED") throw new Error("ARTICLE_ALREADY_PUBLISHED");
if (article.status === "DRAFT") throw new Error("ARTICLE_ALREADY_DRAFT");
```

- [x] **Step 4: Expose admin review queue endpoint**

```typescript
const queue = await listAdminReviewQueue();
return apiOk({ items: queue });
```

- [x] **Step 5: Run tests and static checks**

Run: `npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/reviews/queue/route.ts src/services/review.service.ts src/services/admin-article.service.ts tests/e2e/auth-role-review.spec.ts
git commit -m "feat: add review queue api and publish state guards"
```

### Task 6: 后台页面实现（导入按钮/导入列表/审核列表）

**Files:**
- Modify: `src/app/admin/articles/page.tsx`
- Create: `src/app/admin/articles/imports/page.tsx`
- Create: `src/app/admin/reviews/page.tsx`
- Create: `src/components/admin/ArticleImportPanel.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/admin-auth.spec.ts`

- [ ] **Step 1: Write failing e2e test for import button and list navigation**

```typescript
it("shows import button and navigates to import list", async ({ page }) => {
  await page.goto("/admin/articles");
  await page.getByTestId("admin-import-entry").click();
  await expect(page).toHaveURL(/\/admin\/articles\/imports/);
});
```

- [x] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/admin-auth.spec.ts --grep "import button"`
Expected: FAIL - entry missing

- [x] **Step 3: Implement admin articles UI actions and status badges**

```tsx
<Button data-testid="admin-import-entry" href="/admin/articles/imports">导入任务</Button>
<Button disabled={item.status === "PUBLISHED"} onClick={() => publish(item.id)}>发布</Button>
<Button disabled={item.status !== "PUBLISHED"} onClick={() => unpublish(item.id)}>下线</Button>
```

- [x] **Step 4: Implement imports page and review queue page**

```tsx
<span data-testid="import-task-status">{statusLabel(task.status)}</span>
<Button data-testid="import-task-retry" disabled={task.status !== "FAILED"}>重试</Button>
```

- [ ] **Step 5: Run UI e2e subset + lint/typecheck**

Run: `npm run test:e2e -- tests/e2e/admin-auth.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/articles/page.tsx src/app/admin/articles/imports/page.tsx src/app/admin/reviews/page.tsx src/components/admin/ArticleImportPanel.tsx src/app/globals.css tests/e2e/admin-auth.spec.ts
git commit -m "feat: add admin import and review pages"
```

### Task 7: 异步处理执行入口与回归验收

**Files:**
- Create: `src/app/api/internal/import-tasks/process/route.ts`
- Create: `scripts/probe-import-pipeline.ts`
- Modify: `package.json`
- Modify: `README.md`
- Test: `tests/e2e/admin-ai-draft.spec.ts`

- [ ] **Step 1: Write failing smoke test for async processing endpoint**

```typescript
it("processes queued import tasks and creates draft articles", async ({ request }) => {
  const res = await request.post("/api/internal/import-tasks/process");
  expect(res.status()).toBe(200);
});
```

- [x] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/admin-ai-draft.spec.ts --grep "queued import tasks"`
Expected: FAIL - endpoint missing

- [ ] **Step 3: Implement processing endpoint + probe script**

```typescript
export async function POST() {
  const processed = await processImportTasksBatch({ limit: 10 });
  return apiOk({ processed });
}
```

- [ ] **Step 4: Add npm script and README usage docs**

Run: `npm pkg set scripts.probe:import="tsx scripts/probe-import-pipeline.ts"`
Expected: `package.json` contains probe script and README documents upload/processing flow

- [ ] **Step 5: Run acceptance verification commands**

Run: `npm run lint && npm run typecheck`
Run: `npm run test:e2e -- tests/e2e/admin-auth.spec.ts tests/e2e/auth-role-review.spec.ts tests/e2e/admin-ai-draft.spec.ts`
Run: `npm run probe:import`
Expected: 支持模拟 pdf/image/doc/txt 导入并成功新增草稿文章

- [ ] **Step 6: Commit**

```bash
git add src/app/api/internal/import-tasks/process/route.ts scripts/probe-import-pipeline.ts package.json README.md tests/e2e/admin-ai-draft.spec.ts
git commit -m "feat: add async import processor and acceptance probes"
```

### Task 8: 质量门禁与交付清单

**Files:**
- Modify: `docs/records/non-upgrade-changelog.md`
- Modify: `docs/superpowers/work-progress/admin-article-import-async-review/progress.md`

- [ ] **Step 1: Record verified/unverified items with evidence**

```markdown
- Verified: 上传 4 种文件导入成功（命令 + 结果）
- Unverified: 高并发 100 文件压测未执行
```

- [ ] **Step 2: Update changelog and progress evidence section**

Run: `git diff -- docs/records/non-upgrade-changelog.md docs/superpowers/work-progress/admin-article-import-async-review/progress.md`
Expected: 包含功能点、验证命令、结果摘要

- [ ] **Step 3: Final gate checks**

Run: `npm run lint && npm run typecheck && npm run test:e2e -- tests/e2e/admin-auth.spec.ts tests/e2e/auth-role-review.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/records/non-upgrade-changelog.md docs/superpowers/work-progress
git commit -m "docs: record import workflow verification evidence"
```
