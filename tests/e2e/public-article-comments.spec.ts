import { expect, type Page, test } from "@playwright/test";
import { ArticleCommentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function registerPersonal(page: Page, email: string) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      email,
      password: "Writer#123456",
    },
  });
  expect(response.ok()).toBeTruthy();

  const cookie = extractSessionCookie(response.headers()["set-cookie"] ?? null, "ka_personal_session");
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
  const slug = `public-comment-${stamp}`;

  const createResponse = await page.request.post("/api/admin/articles", {
    headers: { cookie: `ka_admin_session=${adminCookie}` },
    data: {
      title: `Public comment ${stamp}`,
      slug,
      contentMarkdown: "# Public comment test",
      categoryId,
      summary: "public comment",
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

  return { id: articleId, slug };
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("public article shows empty comments when open", async ({ page }) => {
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("暂无评论")).toBeVisible();
  await expect(page.getByTestId("comment-input")).toBeVisible();
});

test("public article hides input when comments are closed", async ({ page }) => {
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  await prisma.article.update({
    where: { id: article.id },
    data: { commentStatus: ArticleCommentStatus.CLOSED },
  });

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("暂无评论")).toBeVisible();
  await expect(page.getByTestId("comment-input")).toHaveCount(0);
});

test("public comments show guest and personal names", async ({ page }) => {
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  const guestResponse = await page.request.post(`/api/articles/${article.slug}/comments`, {
    data: { body: "guest comment", authorName: "测试用户" },
  });
  expect(guestResponse.ok()).toBeTruthy();

  const email = `commenter-${Date.now()}@knowledgeai.dev`;
  const personalCookie = await registerPersonal(page, email);
  const personalResponse = await page.request.post(`/api/articles/${article.slug}/comments`, {
    headers: { cookie: `ka_personal_session=${personalCookie}` },
    data: { body: "personal comment" },
  });
  expect(personalResponse.ok()).toBeTruthy();

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("游客")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});
