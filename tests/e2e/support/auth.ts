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

  const loginJson = (await loginResponse.json()) as {
    success: boolean;
    data?: {
      userId: string;
      role: "ADMIN" | "PERSONAL";
      accessToken: string;
      accessTokenExpiresIn: number;
    };
  };
  expect(loginJson.success).toBeTruthy();
  expect(loginJson.data?.accessToken).toBeTruthy();

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

  if (loginJson.data) {
    await page.goto("/admin/login");
    await page.evaluate((session) => {
      window.localStorage.setItem(
        "ka_auth_session",
        JSON.stringify({
          accessToken: session.accessToken,
          accessTokenExpiresAt: Date.now() + session.accessTokenExpiresIn * 1000,
          role: session.role,
          userId: session.userId,
        }),
      );
    }, loginJson.data);
  }

  await page.goto("/admin/articles");
  await expect(page.getByRole("link", { name: "新建文章" })).toBeVisible();
}
