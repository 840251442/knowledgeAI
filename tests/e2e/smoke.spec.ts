import { expect, test } from "@playwright/test";

test("public home is reachable with seeded data", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "用自然语言更快找到知识" })).toBeVisible();
  await expect(page.getByText("Redis 缓存策略实践指南")).toBeVisible();
});
