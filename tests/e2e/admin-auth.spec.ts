import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { adminLoginSelectors } from "./support/selectors";

test("admin login exposes stable test hooks", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(page.getByTestId(adminLoginSelectors.form)).toBeVisible();
  await expect(page.getByTestId(adminLoginSelectors.email)).toBeVisible();
  await expect(page.getByTestId(adminLoginSelectors.password)).toBeVisible();
  await expect(page.getByTestId(adminLoginSelectors.submit)).toBeVisible();
});

test("anonymous user is redirected to admin login", async ({ page }) => {
  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin can log in with seeded credentials", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByRole("link", { name: "新建文章" })).toBeVisible();
});

test("admin session survives visiting public site", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "首页" })).toBeVisible();

  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByRole("link", { name: "新建文章" })).toBeVisible();
});

test("admin login shows error on invalid password", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByTestId(adminLoginSelectors.email).fill("admin@knowledgeai.dev");
  await page.getByTestId(adminLoginSelectors.password).fill("wrong-password");
  await page.getByTestId(adminLoginSelectors.submit).click();
  await expect(page.getByText("邮箱或密码错误")).toBeVisible();
});
