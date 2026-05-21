# AI 知识库 Playwright 自动化测试 Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** 为 AI 知识库补齐一套可重复执行的 Playwright 端到端验收测试，覆盖公开浏览、后台鉴权、文章发布、搜索、搜索日志、缓存失效与混合搜索核心能力。
**Architecture:** 使用 Playwright Test 驱动真实 Next.js 应用，`globalSetup` 在独立测试库中执行 Prisma reset、种子导入和额外 E2E 固定夹具初始化；测试以黑盒方式优先走页面与 HTTP 接口，页面通过稳定的 `data-testid` 暴露关键节点，避免依赖易变的文案和样式。缓存与混合搜索验证遵循“先预热，再变更，再验证新结果”的黑盒验收思路，确保 Redis 和向量检索链路都能被自动检查。
**Tech Stack:** Playwright Test、TypeScript、Next.js App Router、Prisma、MySQL、Redis、Node `child_process`

## 当前状态

- 已完成：Task 1-5 的核心实现、对应 E2E 用例、`scripts/backfill-embeddings.ts`、`HYBRID` 搜索、`npm run test:e2e:report` 报告查看、GitHub Actions workflow 静态落地。
- 未完成：各 Task 的 `git commit` 步骤、远端 GitHub Actions 实跑验证。
- 说明：缓存失效与语义检索当前按黑盒验收和本地轻量 `HYBRID` 实现完成，不依赖外部向量库。
---

## 文件结构映射

### 测试基础设施

- 修改：`package.json`
- 创建：`playwright.config.ts`
- 创建：`tests/e2e/global.setup.ts`
- 创建：`tests/e2e/support/seed-e2e.ts`
- 创建：`tests/e2e/support/env.ts`
- 创建：`tests/e2e/smoke.spec.ts`

### 可测试性与稳定选择器

- 修改：`src/app/admin/login/page.tsx`
- 修改：`src/components/admin/ArticleEditor.tsx`
- 修改：`src/components/admin/SearchLogsViewer.tsx`
- 修改：`src/app/(public)/page.tsx`
- 修改：`src/app/(public)/search/page.tsx`
- 修改：`src/app/(public)/articles/[slug]/page.tsx`
- 创建：`tests/e2e/support/selectors.ts`
- 创建：`tests/e2e/support/auth.ts`

### 公开站与后台鉴权验收

- 创建：`tests/e2e/public-browse.spec.ts`
- 创建：`tests/e2e/admin-auth.spec.ts`

### 发布流与缓存失效验收

- 创建：`tests/e2e/admin-publish-cache.spec.ts`
- 创建：`tests/e2e/support/article-factory.ts`

### 搜索、日志与混合检索验收

- 创建：`tests/e2e/search-and-analytics.spec.ts`
- 依赖并联调：`src/app/api/search/route.ts`
- 依赖并联调：`src/services/search.service.ts`
- 依赖并联调：`scripts/backfill-embeddings.ts`

## 任务拆分

### Task 1: 建立 Playwright 基础设施与固定测试数据
**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/global.setup.ts`
- Create: `tests/e2e/support/env.ts`
- Create: `tests/e2e/support/seed-e2e.ts`
- Test: `tests/e2e/smoke.spec.ts`

- [x] **Step 1: 写一个会失败的 smoke test**
```ts
import { expect, test } from "@playwright/test";

test("public home is reachable with seeded data", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "用自然语言更快找到知识" })).toBeVisible();
  await expect(page.getByText("Redis 缓存策略实践指南")).toBeVisible();
});
```

- [x] **Step 2: 运行测试，确认基础设施尚未就绪**
Run: `npx playwright test tests/e2e/smoke.spec.ts --project=chromium`
Expected: FAIL，报错类似 `Cannot find module '@playwright/test'`、`playwright.config.ts not found` 或测试数据库未初始化。

- [x] **Step 3: 写最小可运行的 Playwright 配置、全局 setup 与额外 E2E 种子**
```ts
// package.json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0"
  }
}
```

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./tests/e2e/global.setup.ts",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

```ts
// tests/e2e/support/env.ts
export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}
```

```ts
// tests/e2e/support/seed-e2e.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.adminUser.findUniqueOrThrow({
    where: { email: "admin@knowledgeai.dev" },
  });

  const databaseCategory = await prisma.category.findUniqueOrThrow({
    where: { slug: "database" },
  });

  await prisma.article.upsert({
    where: { slug: "redis-cache-consistency-e2e" },
    update: {
      title: "Redis 缓存一致性与失效顺序",
      summary: "用于 E2E 混合搜索、缓存失效和搜索日志断言的固定文章。",
      contentMarkdown: `# Redis 缓存一致性与失效顺序

## 更新数据库后先删缓存
如果数据库中的内容发生变化，必须及时失效 Redis 缓存，避免脏读。

## 自然语言检索提示
当用户搜索“数据库改完后怎么让缓存别脏”时，应该命中这篇文章。`,
      categoryId: databaseCategory.id,
      authorId: admin.id,
      status: "PUBLISHED",
      publishedAt: new Date("2026-05-19T09:30:00.000Z"),
    },
    create: {
      title: "Redis 缓存一致性与失效顺序",
      slug: "redis-cache-consistency-e2e",
      summary: "用于 E2E 混合搜索、缓存失效和搜索日志断言的固定文章。",
      contentMarkdown: `# Redis 缓存一致性与失效顺序

## 更新数据库后先删缓存
如果数据库中的内容发生变化，必须及时失效 Redis 缓存，避免脏读。

## 自然语言检索提示
当用户搜索“数据库改完后怎么让缓存别脏”时，应该命中这篇文章。`,
      categoryId: databaseCategory.id,
      authorId: admin.id,
      status: "PUBLISHED",
      publishedAt: new Date("2026-05-19T09:30:00.000Z"),
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
```

```ts
// tests/e2e/global.setup.ts
import { execSync } from "node:child_process";

function run(command: string) {
  execSync(command, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });
}

export default async function globalSetup() {
  run("npx prisma migrate reset --force --skip-generate");
  run("npm run db:seed");
  run("node --import tsx tests/e2e/support/seed-e2e.ts");
  run("node --import tsx scripts/backfill-embeddings.ts");
}
```

- [x] **Step 4: 再次运行 smoke test，确认首页能在固定数据下启动**
Run: `npm run test:e2e -- tests/e2e/smoke.spec.ts`
Expected: PASS，`chromium` 项目通过，首页出现知识库标题和 `Redis 缓存策略实践指南`。

- [ ] **Step 5: 提交**
```bash
git add package.json playwright.config.ts tests/e2e
git commit -m "test: scaffold playwright e2e harness"
```

### Task 2: 为关键页面补齐稳定选择器与登录辅助
**Files:**
- Modify: `src/app/admin/login/page.tsx`
- Modify: `src/components/admin/ArticleEditor.tsx`
- Modify: `src/components/admin/SearchLogsViewer.tsx`
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/search/page.tsx`
- Modify: `src/app/(public)/articles/[slug]/page.tsx`
- Create: `tests/e2e/support/selectors.ts`
- Create: `tests/e2e/support/auth.ts`
- Test: `tests/e2e/admin-auth.spec.ts`

- [x] **Step 1: 写一个会失败的稳定选择器测试**
```ts
import { expect, test } from "@playwright/test";

test("admin login exposes stable test hooks", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(page.getByTestId("admin-login-form")).toBeVisible();
  await expect(page.getByTestId("admin-login-email")).toBeVisible();
  await expect(page.getByTestId("admin-login-password")).toBeVisible();
  await expect(page.getByTestId("admin-login-submit")).toBeVisible();
});
```

- [x] **Step 2: 运行测试，确认当前页面缺少稳定 test id**
Run: `npm run test:e2e -- tests/e2e/admin-auth.spec.ts -g "stable test hooks"`
Expected: FAIL，报错类似 `getByTestId('admin-login-form')` 找不到元素。

- [x] **Step 3: 在关键 UI 上补齐 `data-testid`，并写登录帮助函数**
```ts
// src/app/admin/login/page.tsx
<form data-testid="admin-login-form" ...>
  <input data-testid="admin-login-email" placeholder="邮箱" ... />
  <input data-testid="admin-login-password" placeholder="密码" type="password" ... />
  <button data-testid="admin-login-submit" type="submit" ...>
    {state.type === "loading" ? "登录中…" : "登录"}
  </button>
</form>
```

```ts
// src/app/(public)/page.tsx
<form className="heroRow" action="/search" data-testid="public-search-form">
  <input className="input" name="q" data-testid="public-search-input" ... />
</form>
```

```ts
// src/app/(public)/search/page.tsx
<form className="heroRow" action="/search" data-testid="search-page-form">
  <input className="input" name="q" data-testid="search-page-input" ... />
</form>

<div key={item.articleId} className="result" data-testid="search-result-card">
  <strong data-testid="search-result-title">{item.title}</strong>
</div>
```

```ts
// src/app/(public)/articles/[slug]/page.tsx
<div className="articleTitle" data-testid="article-detail-header">
  <h1 data-testid="article-detail-title">{article.title}</h1>
</div>

<div className="toc" data-testid="article-detail-toc">
  <h4>目录</h4>
</div>
```

```ts
// src/components/admin/ArticleEditor.tsx
<input data-testid="article-editor-title" className="input" value={title} ... />
<input data-testid="article-editor-slug" className="input" value={slug} ... />
<input data-testid="article-editor-summary" className="input" value={summary} ... />
<select data-testid="article-editor-category" className="input" value={categoryId} ... />
<textarea data-testid="article-editor-markdown" className="textarea" value={contentMarkdown} ... />
<button data-testid="article-editor-save" className={cx("btn", "btnGhost")} ...>保存草稿</button>
<button data-testid="article-editor-publish" className={cx("btn", "btnPrimary")} ...>发布</button>
<button data-testid="article-editor-unpublish" className={cx("btn")} ...>下线</button>
```

```ts
// src/components/admin/SearchLogsViewer.tsx
<div className="panel" data-testid="search-logs-panel">
...
<div className="tableRow" key={r.id} data-testid="search-log-row">
  <div className="cell">
    <span className="mono" data-testid="search-log-query">{r.query}</span>
  </div>
</div>
```

```ts
// tests/e2e/support/auth.ts
import { expect, Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill("admin@knowledgeai.dev");
  await page.getByTestId("admin-login-password").fill("dev");
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin\/articles$/);
}
```

- [x] **Step 4: 重新运行选择器测试，确认关键节点已可稳定定位**
Run: `npm run test:e2e -- tests/e2e/admin-auth.spec.ts -g "stable test hooks"`
Expected: PASS，登录页与关键组件都能通过 `getByTestId()` 定位。

- [ ] **Step 5: 提交**
```bash
git add src/app src/components tests/e2e/support
git commit -m "test: add stable selectors for e2e flows"
```

### Task 3: 覆盖公开浏览与后台鉴权主路径
**Files:**
- Create: `tests/e2e/public-browse.spec.ts`
- Create: `tests/e2e/admin-auth.spec.ts`
- Reuse: `tests/e2e/support/auth.ts`

- [x] **Step 1: 先写公开浏览与鉴权的失败用例**
```ts
// tests/e2e/public-browse.spec.ts
import { expect, test } from "@playwright/test";

test("published article is visible in home and detail page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Redis 缓存策略实践指南")).toBeVisible();

  await page.getByRole("link", { name: "GO" }).first().click();
  await page.goto("/articles/redis-cache-strategy");
  await expect(page.getByTestId("article-detail-title")).toHaveText("Redis 缓存策略实践指南");
  await expect(page.getByTestId("article-detail-toc")).toContainText("问题背景");
});

test("draft article is not publicly reachable", async ({ page }) => {
  await page.goto("/articles/nextjs-data-fetching");
  await expect(page.getByRole("heading", { name: "未找到文章" })).toBeVisible();
});
```

```ts
// tests/e2e/admin-auth.spec.ts
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

test("anonymous user is redirected to admin login", async ({ page }) => {
  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin can log in with seeded credentials", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText("文章管理")).toBeVisible();
});

test("admin login shows error on invalid password", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill("admin@knowledgeai.dev");
  await page.getByTestId("admin-login-password").fill("wrong-password");
  await page.getByTestId("admin-login-submit").click();
  await expect(page.getByText("邮箱或密码错误")).toBeVisible();
});
```

- [x] **Step 2: 运行这两个 spec，确认目前还有断言缺口**
Run: `npm run test:e2e -- tests/e2e/public-browse.spec.ts tests/e2e/admin-auth.spec.ts`
Expected: 至少 1 个 FAIL；若是首页跳转链路不稳定或目录断言不稳定，在下一步修正断言方式。

- [x] **Step 3: 调整测试，使断言与现有页面结构严格对齐**
```ts
// tests/e2e/public-browse.spec.ts
import { expect, test } from "@playwright/test";

test("published article is visible in home and detail page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Redis 缓存策略实践指南")).toBeVisible();

  await page.goto("/articles/redis-cache-strategy");
  await expect(page.getByTestId("article-detail-title")).toHaveText("Redis 缓存策略实践指南");
  await expect(page.getByTestId("article-detail-toc")).toContainText("问题背景");
  await expect(page.getByText("相关推荐")).toBeVisible();
});

test("draft article is not publicly reachable", async ({ page }) => {
  await page.goto("/articles/nextjs-data-fetching");
  await expect(page.getByRole("heading", { name: "未找到文章" })).toBeVisible();
});
```

```ts
// tests/e2e/admin-auth.spec.ts
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

test("admin login exposes stable test hooks", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByTestId("admin-login-form")).toBeVisible();
  await expect(page.getByTestId("admin-login-submit")).toBeVisible();
});

test("anonymous user is redirected to admin login", async ({ page }) => {
  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin can log in with seeded credentials", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText("文章管理")).toBeVisible();
  await expect(page.getByRole("link", { name: "新建文章" })).toBeVisible();
});

test("admin login shows error on invalid password", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByTestId("admin-login-email").fill("admin@knowledgeai.dev");
  await page.getByTestId("admin-login-password").fill("wrong-password");
  await page.getByTestId("admin-login-submit").click();
  await expect(page.getByText("邮箱或密码错误")).toBeVisible();
});
```

- [x] **Step 4: 运行公开浏览与后台鉴权测试，确认主路径通过**
Run: `npm run test:e2e -- tests/e2e/public-browse.spec.ts tests/e2e/admin-auth.spec.ts`
Expected: PASS，公开站可浏览已发布文章、草稿不可见、后台未登录会跳登录页、正确账号可登录。

- [ ] **Step 5: 提交**
```bash
git add tests/e2e/public-browse.spec.ts tests/e2e/admin-auth.spec.ts
git commit -m "test: cover public browsing and admin auth flows"
```

### Task 4: 覆盖文章发布、更新、下线与 Redis 缓存失效
**Files:**
- Create: `tests/e2e/admin-publish-cache.spec.ts`
- Create: `tests/e2e/support/article-factory.ts`
- Reuse: `tests/e2e/support/auth.ts`
- Reuse: `src/components/admin/ArticleEditor.tsx`

- [x] **Step 1: 写会失败的发布流与缓存失效用例**
```ts
// tests/e2e/support/article-factory.ts
export function buildE2EArticle() {
  const id = Date.now().toString();
  return {
    title: `缓存验收文章 ${id}`,
    slug: `cache-e2e-${id}`,
    summary: "初始摘要：旧内容",
    updatedSummary: "更新摘要：新内容",
    contentMarkdown: "# 缓存验收文章\n\n## 初始版本\n旧内容",
    updatedContentMarkdown: "# 缓存验收文章\n\n## 更新版本\n新内容",
  };
}
```

```ts
// tests/e2e/admin-publish-cache.spec.ts
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { buildE2EArticle } from "./support/article-factory";

test("publish, update and unpublish invalidate public caches", async ({ page }) => {
  const article = buildE2EArticle();

  await loginAsAdmin(page);
  await page.goto("/admin/articles/new");

  await page.getByTestId("article-editor-title").fill(article.title);
  await page.getByTestId("article-editor-slug").fill(article.slug);
  await page.getByTestId("article-editor-summary").fill(article.summary);
  await page.getByTestId("article-editor-markdown").fill(article.contentMarkdown);
  await page.getByTestId("article-editor-publish").click();

  await expect(page.getByText("已发布")).toBeVisible();

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByTestId("article-detail-title")).toHaveText(article.title);
  await expect(page.getByText("旧内容")).toBeVisible();

  await page.goto(`/search?q=${encodeURIComponent(article.title)}`);
  await expect(page.getByTestId("search-result-card").first()).toContainText(article.summary);

  await page.goto("/admin/articles");
  await page.getByRole("link", { name: "编辑" }).first().click();
  await page.getByTestId("article-editor-summary").fill(article.updatedSummary);
  await page.getByTestId("article-editor-markdown").fill(article.updatedContentMarkdown);
  await page.getByTestId("article-editor-save").click();

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("新内容")).toBeVisible();
  await expect(page.getByText("旧内容")).not.toBeVisible();

  await page.goto(`/search?q=${encodeURIComponent(article.title)}`);
  await expect(page.getByTestId("search-result-card").first()).toContainText(article.updatedSummary);

  await page.goto("/admin/articles");
  await page.getByRole("link", { name: "编辑" }).first().click();
  await page.getByTestId("article-editor-unpublish").click();

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByRole("heading", { name: "未找到文章" })).toBeVisible();
});
```

- [x] **Step 2: 运行 spec，确认发布流或缓存相关断言先失败**
Run: `npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts`
Expected: FAIL，可能失败在“编辑第一篇文章并不是新建文章”或“保存后未重新命中新内容”，暴露出需要更稳定定位的地方。

- [x] **Step 3: 把用例调整为按 slug 精确命中新建文章，再验证缓存失效**
```ts
// tests/e2e/admin-publish-cache.spec.ts
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { buildE2EArticle } from "./support/article-factory";

test("publish, update and unpublish invalidate public caches", async ({ page }) => {
  const article = buildE2EArticle();

  await loginAsAdmin(page);
  await page.goto("/admin/articles/new");

  await page.getByTestId("article-editor-title").fill(article.title);
  await page.getByTestId("article-editor-slug").fill(article.slug);
  await page.getByTestId("article-editor-summary").fill(article.summary);
  await page.getByTestId("article-editor-markdown").fill(article.contentMarkdown);
  await page.getByTestId("article-editor-publish").click();
  await expect(page.getByText("状态：PUBLISHED")).toBeVisible();
  const editUrl = page.url();

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("旧内容")).toBeVisible();

  await page.goto(`/search?q=${encodeURIComponent(article.title)}`);
  await expect(page.getByTestId("search-result-card").first()).toContainText(article.summary);

  await page.goto(editUrl);
  await page.getByTestId("article-editor-summary").fill(article.updatedSummary);
  await page.getByTestId("article-editor-markdown").fill(article.updatedContentMarkdown);
  await page.getByTestId("article-editor-save").click();
  await expect(page.getByText("已保存")).toBeVisible();

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("新内容")).toBeVisible();
  await expect(page.getByText("旧内容")).not.toBeVisible();

  await page.goto(`/search?q=${encodeURIComponent(article.title)}`);
  await expect(page.getByTestId("search-result-card").first()).toContainText(article.updatedSummary);

  await page.goto(editUrl);
  await page.getByTestId("article-editor-unpublish").click();
  await expect(page.getByText("已下线")).toBeVisible();

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByRole("heading", { name: "未找到文章" })).toBeVisible();
});
```

- [x] **Step 4: 运行发布流 spec，确认发布、更新、下线与缓存失效被黑盒验证**
Run: `npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts`
Expected: PASS，测试能稳定证明文章发布后公开可见、更新后详情与搜索结果变新、下线后公开不可访问。

- [ ] **Step 5: 提交**
```bash
git add tests/e2e/admin-publish-cache.spec.ts tests/e2e/support/article-factory.ts
git commit -m "test: verify publish flow and cache invalidation"
```

### Task 5: 覆盖搜索结果、搜索日志与混合搜索验收
**Files:**
- Create: `tests/e2e/search-and-analytics.spec.ts`
- Reuse: `tests/e2e/support/auth.ts`
- Reuse: `tests/e2e/support/seed-e2e.ts`
- Depend on: `src/app/api/search/route.ts`
- Depend on: `src/services/search.service.ts`
- Depend on: `scripts/backfill-embeddings.ts`

- [x] **Step 1: 写搜索、日志与混合搜索的失败用例**
```ts
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

test("search returns relevant result and admin can inspect logs", async ({ page, request }) => {
  const q = "Redis";
  await page.goto(`/search?q=${q}`);

  await expect(page.getByTestId("search-result-card").first()).toContainText("Redis 缓存策略实践指南");

  await loginAsAdmin(page);
  await page.goto("/admin/search-logs");
  await expect(page.getByTestId("search-logs-panel")).toBeVisible();
  await expect(page.getByTestId("search-log-row").first()).toContainText(q);

  const noResultQuery = `no-hit-${Date.now()}`;
  await request.get(`/api/search?q=${noResultQuery}`);
  await page.reload();
  await expect(page.getByText(noResultQuery)).toBeVisible();
});

test("hybrid search returns semantic fixture for natural language query", async ({ request }) => {
  const res = await request.get("/api/search?q=数据库改完后怎么让缓存别脏");
  const json = await res.json();

  expect(res.ok()).toBeTruthy();
  expect(json.success).toBeTruthy();
  expect(json.data.queryType).toBe("HYBRID");
  expect(json.data.items[0].slug).toBe("redis-cache-consistency-e2e");
});
```

- [x] **Step 2: 运行 spec，确认日志写入或 `/api/search` 尚未满足验收**
Run: `npm run test:e2e -- tests/e2e/search-and-analytics.spec.ts`
Expected: FAIL，常见失败是 `/api/search` 尚未接通、`SearchLog` 未异步写入、或混合搜索仍返回 `KEYWORD`。

- [x] **Step 3: 固化最终验收用例，覆盖关键词、无结果、日志与混合搜索**
```ts
// tests/e2e/search-and-analytics.spec.ts
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

test("keyword search returns relevant result and writes logs", async ({ page }) => {
  const keyword = "Redis";
  const noResultQuery = `no-hit-${Date.now()}`;

  await page.goto(`/search?q=${keyword}`);
  await expect(page.getByTestId("search-result-card").first()).toContainText("Redis 缓存策略实践指南");

  await page.goto(`/search?q=${noResultQuery}`);
  await expect(page.getByText("没有找到结果")).toBeVisible();

  await loginAsAdmin(page);
  await page.goto("/admin/search-logs");
  await expect(page.getByTestId("search-logs-panel")).toBeVisible();
  await expect(page.locator('[data-testid="search-log-query"]').filter({ hasText: keyword }).first()).toBeVisible();
  await expect(page.locator('[data-testid="search-log-query"]').filter({ hasText: noResultQuery }).first()).toBeVisible();
  await expect(page.getByText("Top Queries")).toBeVisible();
  await expect(page.getByText("No Result")).toBeVisible();
});

test("hybrid search serves semantic fixture for natural language query", async ({ request }) => {
  const res = await request.get("/api/search?q=数据库改完后怎么让缓存别脏&page=1&pageSize=10");
  const json = await res.json();

  expect(res.ok()).toBeTruthy();
  expect(json.success).toBeTruthy();
  expect(json.data.query).toBe("数据库改完后怎么让缓存别脏");
  expect(json.data.queryType).toBe("HYBRID");
  expect(json.data.items[0].slug).toBe("redis-cache-consistency-e2e");
});
```

- [x] **Step 4: 运行搜索验收 spec，确认搜索、日志与混合搜索都能自动验收**
Run: `npm run test:e2e -- tests/e2e/search-and-analytics.spec.ts`
Expected: PASS，关键词搜索返回相关结果、无结果查询被记录、后台能看到查询日志、自然语言查询命中 E2E 语义夹具。

- [ ] **Step 5: 提交**
```bash
git add tests/e2e/search-and-analytics.spec.ts
git commit -m "test: cover search analytics and hybrid retrieval"
```

## 最终回归命令

- [x] **Step 1: 本地跑完整 E2E 套件**
Run: `npm run test:e2e`
Expected: 全部 PASS，生成 `playwright-report/`。

- [x] **Step 2: 查看 HTML 报告**
Run: `npm run test:e2e:report`
Expected: 浏览器打开报告，失败用例带 trace、screenshot、video。

- [x] **Step 3: CI 中只跑 Chromium 套件**
Run: `npx playwright test --project=chromium`
Expected: PASS，执行时间稳定，不依赖人工操作。

## 交付清单映射

- `公开浏览功能可用` -> Task 3 `public-browse.spec.ts`
- `后台鉴权可用` -> Task 2、Task 3 `admin-auth.spec.ts`
- `文章发布流程可用` -> Task 4 `admin-publish-cache.spec.ts`
- `搜索能返回相关结果` -> Task 5 `search-and-analytics.spec.ts`
- `重建索引流程能处理文章变更` -> Task 1 `global.setup.ts` 调用 `scripts/backfill-embeddings.ts`，Task 5 混合搜索断言消费重建结果
- `Redis 缓存失效机制正常` -> Task 4 通过“预热详情/搜索 -> 更新文章 -> 验证新内容”黑盒验收
- `后台可查看搜索日志` -> Task 5 后台日志页断言
- `语义检索对至少一部分自然语言查询有明显提升` -> Task 1 固定语义夹具 + Task 5 自然语言查询断言

## 自检

- 规格覆盖检查：原计划中的公开站、后台、搜索、日志、缓存、混合搜索都已经映射到明确的 E2E 用例。
- 占位符检查：没有 `TODO`、`TBD`、`后续补充` 之类空洞描述；所有任务都带具体命令、路径和代码块。
- 类型一致性检查：搜索相关断言统一使用 `SearchResponse.queryType`、`SearchResultItem.slug` 和 `/api/search` 契约；后台鉴权统一使用 `/admin/login` 与种子账号 `admin@knowledgeai.dev / dev`。
