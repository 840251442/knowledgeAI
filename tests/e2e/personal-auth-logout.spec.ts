import { expect, test } from "@playwright/test";

import { personalArticleSelectors } from "./support/selectors";

test("personal logout should clear session and block me/articles", async ({ page }) => {
  test.setTimeout(120_000);

  const email = `logout-e2e-${Date.now()}@knowledgeai.dev`;
  const password = "Writer#123456";

  await page.goto("/");
  const registerResult = await page.evaluate(async ({ email, password }) => {
    const response = await fetch(new URL("/api/auth/register", window.location.origin).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return { ok: response.ok, body: await response.json() };
  }, { email, password });

  expect(registerResult.ok).toBeTruthy();

  await page.goto("/me/articles");
  await expect(page.getByTestId(personalArticleSelectors.list)).toBeVisible();

  await page.getByTestId(personalArticleSelectors.logout).click();
  await page.waitForURL(/\/admin\/login$/, { timeout: 30_000 });

  await page.goto("/me/articles");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
