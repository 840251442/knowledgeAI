import { expect, type Page } from "@playwright/test";

function extractSessionCookie(setCookieHeader: string | null, cookieName: string) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function loginAsAdmin(page: Page) {
  const loginResponse = await page.request.post("/api/admin/login", {
    data: {
      email: "admin@knowledgeai.dev",
      password: "dev",
    },
  });
  expect(loginResponse.ok()).toBeTruthy();

  const cookie = extractSessionCookie(loginResponse.headers()["set-cookie"] ?? null, "ka_admin_session");
  expect(cookie).toBeTruthy();
  if (!cookie) return;

  await page.context().addCookies([
    {
      name: "ka_admin_session",
      value: cookie,
      url: "http://127.0.0.1:3000",
    },
  ]);

  await page.goto("/admin/articles");
  await expect(page.getByRole("link", { name: "新建文章" })).toBeVisible();
}
