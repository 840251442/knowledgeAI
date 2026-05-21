import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { searchSelectors } from "./support/selectors";

test("keyword search returns relevant result and admin can inspect logs", async ({ page }) => {
  const keyword = "Redis";
  const noResultQuery = `no-hit-${Date.now()}`;

  await page.goto(`/search?q=${keyword}`);
  await expect(page.getByTestId(searchSelectors.resultCard).first()).toContainText(
    "Redis 缓存策略实践指南",
  );

  await page.goto(`/search?q=${noResultQuery}`);
  await expect(page.getByText("没有找到结果")).toBeVisible();

  await loginAsAdmin(page);
  await page.goto("/admin/search-logs");
  await expect(page.getByTestId(searchSelectors.logsPanel)).toBeVisible();
  await expect(
    page.locator('[data-testid="search-log-query"]').filter({ hasText: keyword }).first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="search-log-query"]').filter({ hasText: noResultQuery }).first(),
  ).toBeVisible();
  await expect(page.getByText("Top Queries")).toBeVisible();
  await expect(page.getByText("No Result")).toBeVisible();
});

test("keyword search highlights matched terms in title and excerpt", async ({ page }) => {
  await page.goto("/search?q=索引");

  await expect(page.getByTestId(searchSelectors.resultTitle).first()).toContainText("索引");
  await expect(
    page.getByTestId(searchSelectors.resultTitle).first().getByTestId(searchSelectors.highlight),
  ).toContainText("索引");
  await expect(
    page
      .getByTestId(searchSelectors.resultExcerpt)
      .first()
      .getByTestId(searchSelectors.highlight)
      .first(),
  ).toContainText("索引");
});

test("natural language query returns the seeded e2e article from search api", async ({ request }) => {
  const res = await request.get("/api/search?q=数据库改完后怎么让缓存别脏&page=1&pageSize=10");
  const json = (await res.json()) as {
    success: boolean;
    data?: {
      query: string;
      queryType: string;
      items: Array<{ slug: string }>;
    };
  };

  expect(res.ok()).toBeTruthy();
  expect(json.success).toBeTruthy();
  expect(json.data?.query).toBe("数据库改完后怎么让缓存别脏");
  expect(json.data?.queryType).toBe("HYBRID");
  expect(json.data?.items[0]?.slug).toBe("redis-cache-consistency-e2e");
});
