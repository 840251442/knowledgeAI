import { expect, type Page, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

function extractSessionCookie(setCookieHeader: string | null, cookieName: string) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? null;
}

async function loginAdminForApi(page: Page) {
  const response = await page.request.post("/api/admin/login", {
    data: {
      email: "admin@knowledgeai.dev",
      password: "dev",
    },
  });
  expect(response.ok()).toBeTruthy();

  const cookie = extractSessionCookie(response.headers()["set-cookie"] ?? null, "ka_admin_session");
  expect(cookie).toBeTruthy();
  return cookie ?? "";
}

async function createPublishedArticle(page: Page, adminCookie: string) {
  const categoriesResponse = await page.request.get("/api/categories");
  expect(categoriesResponse.ok()).toBeTruthy();

  const categoriesJson = (await categoriesResponse.json()) as {
    success: boolean;
    data?: Array<{ id: string; slug: string }>;
  };
  expect(categoriesJson.success).toBeTruthy();

  const category = categoriesJson.data?.find((item) => item.slug === "backend");
  expect(category?.id).toBeTruthy();
  const categoryId = category?.id ?? "";

  const stamp = Date.now();
  const slug = `admin-comment-${stamp}`;
  const title = `后台评论 ${stamp}`;

  const createResponse = await page.request.post("/api/admin/articles", {
    headers: { cookie: `ka_admin_session=${adminCookie}` },
    data: {
      title,
      slug,
      contentMarkdown: "# admin comment test",
      categoryId,
      summary: "admin comment",
      tagIds: [],
    },
  });
  expect(createResponse.ok()).toBeTruthy();

  const createJson = (await createResponse.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(createJson.success).toBeTruthy();
  expect(createJson.data?.id).toBeTruthy();

  const articleId = createJson.data?.id ?? "";
  const publishResponse = await page.request.post(`/api/admin/articles/${articleId}/publish`, {
    headers: { cookie: `ka_admin_session=${adminCookie}` },
  });
  expect(publishResponse.ok()).toBeTruthy();

  return { id: articleId, slug, title };
}

test("admin can filter comments by article and delete", async ({ page }) => {
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  const body = `admin comment body ${Date.now()}`;
  const createCommentResponse = await page.request.post(`/api/articles/${article.slug}/comments`, {
    data: { body, authorName: "测试用户" },
  });
  expect(createCommentResponse.ok()).toBeTruthy();

  await loginAsAdmin(page);
  await page.goto("/admin/comments");

  await expect(page.getByTestId("admin-comments-panel")).toBeVisible();

  await page.getByTestId("admin-comments-article-filter").click();
  await page.getByText(`${article.title} (${article.slug})`).click();

  await expect(page.getByText(body)).toBeVisible();

  const deleteResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes("/api/admin/comments/") &&
      response.ok(),
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("admin-comment-delete").first().click();

  await deleteResponsePromise;
  await expect(page.getByText(body)).toHaveCount(0);
});
