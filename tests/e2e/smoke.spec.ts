import { expect, test } from "@playwright/test";

test("public home is reachable with seeded data", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("public-search-form")).toBeVisible();
  await expect(page.getByTestId("public-search-input")).toBeVisible();
  await expect(page.getByText("Redis 缓存策略实践指南")).toBeVisible();
});
