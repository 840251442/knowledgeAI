import { expect, type APIResponse, type Page } from "@playwright/test";

function extractSessionCookie(setCookieHeader: string | null, cookieName: string) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function loginAsAdmin(page: Page, targetPath = "/admin/articles") {
  let loginResponse: APIResponse | null = null;

  for (let i = 0; i < 3; i += 1) {
    try {
      const response = await page.request.post("/api/admin/login", {
        data: {
          email: "admin@knowledgeai.dev",
          password: "dev",
        },
        timeout: 30_000,
      });

      loginResponse = response;
      if (response.ok()) break;
    } catch {
      // Retry transient failures when the test environment is still warming up.
    }

    await page.waitForTimeout(1000);
  }

  expect(loginResponse?.ok()).toBeTruthy();
  if (!loginResponse) return;

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
    const sessionPayload = {
      accessToken: loginJson.data.accessToken,
      accessTokenExpiresAt: Date.now() + loginJson.data.accessTokenExpiresIn * 1000,
      role: loginJson.data.role,
      userId: loginJson.data.userId,
    };
    await page.addInitScript((session) => {
      window.localStorage.setItem("ka_auth_session", JSON.stringify(session));
    }, sessionPayload);
  }

  await page.goto(targetPath);
  await expect(page.getByRole("link", { name: /退出/ }).first()).toBeVisible();
}
