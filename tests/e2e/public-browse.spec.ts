import { expect, type Page, test } from "@playwright/test";

function extractSessionCookie(setCookieHeader: string | null, cookieName: string) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? null;
}

async function loginAdminForApi(page: Page) {
  const response = await page.request.post("/api/admin/login", {
    data: {
      email: "admin@knowledgeai.dev",
      password: "dev",
    },
  });
  expect(response.ok()).toBeTruthy();

  const cookie = extractSessionCookie(response.headers()["set-cookie"] ?? null, "ka_admin_session");
  expect(cookie).toBeTruthy();
  return cookie ?? "";
}

async function getBackendCategoryId(page: Page) {
  const categoriesResponse = await page.request.get("/api/categories");
  expect(categoriesResponse.ok()).toBeTruthy();

  const categoriesJson = (await categoriesResponse.json()) as {
    success: boolean;
    data?: Array<{ id: string; slug: string }>;
  };
  expect(categoriesJson.success).toBeTruthy();
  const category = categoriesJson.data?.find((item) => item.slug === "backend");
  expect(category?.id).toBeTruthy();
  return category?.id ?? "";
}

async function createPublishedArticles(page: Page, input: {
  count: number;
  adminCookie: string;
  categoryId: string;
}) {
  for (let index = 0; index < input.count; index += 1) {
    const stamp = Date.now();
    const slug = `lazy-load-${stamp}-${index}`;

    const createResponse = await page.request.post("/api/admin/articles", {
      headers: { cookie: `ka_admin_session=${input.adminCookie}` },
      data: {
        title: `Lazy load ${index}`,
        slug,
        contentMarkdown: "# Lazy load",
        categoryId: input.categoryId,
        summary: "用于验证公开文章列表懒加载",
        tagIds: [],
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createJson = (await createResponse.json()) as {
      success: boolean;
      data?: { id?: string };
    };
    expect(createJson.success).toBeTruthy();
    const articleId = createJson.data?.id ?? "";
    expect(articleId).toBeTruthy();

    const publishResponse = await page.request.post(`/api/admin/articles/${articleId}/publish`, {
      headers: { cookie: `ka_admin_session=${input.adminCookie}` },
    });
    expect(publishResponse.ok()).toBeTruthy();
  }
}

test("published article is visible in home and detail page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "登录" })).toHaveCount(0);
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

test("invalid page query is normalized to page=1", async ({ page }) => {
  await page.goto("/articles?page=abc");
  await expect(page).toHaveURL(/\/articles\?page=1$/);
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();

  await page.goto("/articles?page=0");
  await expect(page).toHaveURL(/\/articles\?page=1$/);

  await page.goto("/articles?page=-1");
  await expect(page).toHaveURL(/\/articles\?page=1$/);
});

test("out-of-range page query is normalized to the last page", async ({ page }) => {
  await page.goto("/articles?page=9999");
  await expect(page).toHaveURL(/\/articles\?page=1$/);
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();
});

test("lazy-loads published articles until all loaded", async ({ page }) => {
  test.slow();

  const adminCookie = await loginAdminForApi(page);
  const categoryId = await getBackendCategoryId(page);
  await createPublishedArticles(page, { count: 13, adminCookie, categoryId });

  await page.goto("/articles?category=backend");
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();

  const lazyLinks = page.locator("a[href^='/articles/lazy-load-']");
  await expect(lazyLinks).toHaveCount(12);
  await page.getByTestId("public-infinite-sentinel").scrollIntoViewIfNeeded();

  await expect
    .poll(async () => lazyLinks.count(), {
      message: "should load the second page after sentinel is intersected",
      timeout: 10000,
    })
    .toBe(13);
  await expect(page.getByTestId("public-infinite-status")).toContainText("已加载全部");
});
