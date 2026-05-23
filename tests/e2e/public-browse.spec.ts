import { expect, test } from "@playwright/test";

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
