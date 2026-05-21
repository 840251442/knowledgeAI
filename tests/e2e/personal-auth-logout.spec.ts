import { expect, test } from "@playwright/test";

import { personalArticleSelectors } from "./support/selectors";

test("personal logout should clear session and block me/articles", async ({ page }) => {
  test.setTimeout(120_000);

  const email = `logout-e2e-${Date.now()}@knowledgeai.dev`;
  const password = "Writer#123456";

  await page.goto("/auth?mode=register");
  await page.getByTestId("personal-auth-email").fill(email);
  await page.getByTestId("personal-auth-password").fill(password);
  await page.getByTestId("personal-auth-submit").click();

  await page.waitForURL(/\/me\/articles$/, { timeout: 30_000 });
  await expect(page.getByTestId(personalArticleSelectors.list)).toBeVisible();

  await page.getByTestId(personalArticleSelectors.logout).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);

  await page.goto("/me/articles");
  await expect(page).toHaveURL(/\/auth(\?|$)/);
});
