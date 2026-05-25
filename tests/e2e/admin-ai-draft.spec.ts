import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { articleEditorSelectors } from "./support/selectors";

test("article editor shows AI draft panel and allows insert", async ({ page }) => {
  test.slow();

  await loginAsAdmin(page);
  await page.goto("/admin/articles/new");

  await page.getByTestId(articleEditorSelectors.aiEntry).click();
  await expect(page.getByTestId(articleEditorSelectors.aiPanel)).toBeVisible();

  await page.getByTestId(articleEditorSelectors.aiKeyword).fill("Redis 缓存一致性");
  await page.getByTestId(articleEditorSelectors.aiGenerate).click();
  await expect(page.getByTestId(articleEditorSelectors.aiGenerate)).toBeDisabled();

  await expect(page.getByTestId(articleEditorSelectors.aiPreview)).toContainText("##", { timeout: 30_000 });

  const before = await page.getByTestId(articleEditorSelectors.markdown).inputValue();
  await page.getByTestId(articleEditorSelectors.aiInsert).click();
  const after = await page.getByTestId(articleEditorSelectors.markdown).inputValue();

  expect(after.length).toBeGreaterThan(before.length);
});

test("ai draft requires keyword and discard keeps markdown unchanged", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/articles/new");

  const before = await page.getByTestId(articleEditorSelectors.markdown).inputValue();
  await page.getByTestId(articleEditorSelectors.aiEntry).click();
  await page.getByTestId(articleEditorSelectors.aiGenerate).click();
  await expect(page.getByText("请输入关键词")).toBeVisible();

  await page.getByTestId(articleEditorSelectors.aiDiscard).click();
  const after = await page.getByTestId(articleEditorSelectors.markdown).inputValue();
  expect(after).toBe(before);
});
