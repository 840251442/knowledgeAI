import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { adminLoginSelectors } from "./support/selectors";

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
  await page.request.post("/api/admin/logout");
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
});

test("admin login exposes stable test hooks", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByTestId(adminLoginSelectors.form)).toBeVisible();
  await expect(page.getByTestId(adminLoginSelectors.email)).toBeVisible();
  await expect(page.getByTestId(adminLoginSelectors.password)).toBeVisible();
  await expect(page.getByTestId(adminLoginSelectors.submit)).toBeVisible();
});

test("anonymous user is redirected to admin login", async ({ request }) => {
  const res = await request.get("/api/admin/articles?page=1&pageSize=1", { timeout: 20_000 });
  expect(res.status()).toBe(401);
});

test("admin can log in with seeded credentials", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByRole("link", { name: "新建文章", exact: true })).toBeVisible();
});

test("admin session survives visiting public site", async ({ page }) => {
  test.slow();

  await loginAsAdmin(page);

  await page.goto("/search");
  await expect(page.getByRole("heading", { name: "搜索" })).toBeVisible();

  await page.goto("/admin/articles");
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByRole("link", { name: "新建文章", exact: true })).toBeVisible();
});

test("admin articles page exposes import and review entries", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByTestId("admin-import-entry").click();
  await expect(page).toHaveURL(/\/admin\/articles\/imports$/);

  await page.goto("/admin/articles");
  await expect(page.getByRole("link", { name: "审核列表", exact: true })).toBeVisible();
  await page.goto("/admin/reviews");
  await expect(page).toHaveURL(/\/admin\/reviews$/);
});

test("register tab can create personal account and enter admin articles", async ({ page }) => {
  const email = `admin-tab-register-${Date.now()}@knowledgeai.dev`;
  const password = "Writer#123456";

  await page.goto("/admin/login");
  await page.getByRole("button", { name: "去注册" }).click();
  await page.getByTestId(adminLoginSelectors.email).fill(email);
  await page.getByTestId(adminLoginSelectors.password).fill(password);
  await page.getByPlaceholder("确认密码").fill(password);
  await page.getByTestId(adminLoginSelectors.submit).click();

  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByRole("link", { name: "新建文章", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "文章管理" })).toBeVisible();
  await expect(page.getByRole("link", { name: "退出" })).toBeVisible();
  await expect(page.getByRole("link", { name: "分类管理" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "标签管理" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "搜索日志" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "返回公开站" })).toHaveCount(0);
});

test("admin sees full sidebar menus", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByTestId(adminLoginSelectors.email).fill("admin@knowledgeai.dev");
  await page.getByTestId(adminLoginSelectors.password).fill("dev");
  await page.getByTestId(adminLoginSelectors.submit).click();

  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByRole("link", { name: /文章管理/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /分类管理/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /标签管理/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /搜索日志/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /退出/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /返回公开站/ })).toBeVisible();
});

test("expired access token should refresh before admin write request", async ({ page }) => {
  await loginAsAdmin(page);

  await page.evaluate(() => {
    const key = "ka_auth_session";
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const session = JSON.parse(raw) as {
      accessToken: string;
      accessTokenExpiresAt: number;
      role: "ADMIN" | "PERSONAL";
      userId: string;
    };
    session.accessToken = "expired-token-for-e2e";
    session.accessTokenExpiresAt = Date.now() - 60_000;
    window.localStorage.setItem(key, JSON.stringify(session));
  });

  await page.goto("/admin/articles/new");
  await page.getByTestId("article-editor-title").fill(`refresh-e2e-${Date.now()}`);
  await page.getByTestId("article-editor-markdown").fill("# refresh e2e");
  await page.getByTestId("article-editor-save").click();

  await expect(page).toHaveURL(/\/admin\/articles\/.+\/edit$/, { timeout: 15_000 });
  const refreshed = await page.evaluate(() => {
    const raw = window.localStorage.getItem("ka_auth_session");
    if (!raw) return null;
    return JSON.parse(raw) as { accessToken: string };
  });
  expect(refreshed?.accessToken).toBeTruthy();
  expect(refreshed?.accessToken).not.toBe("expired-token-for-e2e");
});

test("admin login shows error on invalid password", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByTestId(adminLoginSelectors.email).fill("admin@knowledgeai.dev");
  await page.getByTestId(adminLoginSelectors.password).fill("wrong-password");
  await page.getByTestId(adminLoginSelectors.submit).click();
  await expect(page.getByText("邮箱或密码错误")).toBeVisible();
});
