import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function seedPublishedArticlesByDb(count: number) {
  const category = await prisma.category.findUnique({
    where: { slug: "backend" },
    select: { id: true },
  });
  expect(category?.id).toBeTruthy();

  const stamp = Date.now();
  const now = new Date();
  await prisma.article.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      title: `Lazy load ${index}`,
      slug: `lazy-load-${stamp}-${index}`,
      contentMarkdown: "# Lazy load",
      categoryId: category!.id,
      summary: "用于验证公开文章列表懒加载",
      status: "PUBLISHED",
      publishedAt: now,
    })),
  });
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
  test.setTimeout(180000);

  await seedPublishedArticlesByDb(13);

  await page.goto("/articles?category=backend");
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();

  const lazyLinks = page.locator("a[href^='/articles/lazy-load-']");
  const initialCount = await lazyLinks.count();
  expect(initialCount).toBeGreaterThanOrEqual(12);

  await page.getByTestId("public-infinite-sentinel").scrollIntoViewIfNeeded();

  await expect
    .poll(async () => lazyLinks.count(), {
      message: "should load the second page after sentinel is intersected",
      timeout: 10000,
    })
    .toBeGreaterThan(initialCount);

  await expect(page.getByTestId("public-infinite-status")).toContainText("已加载全部");
});
