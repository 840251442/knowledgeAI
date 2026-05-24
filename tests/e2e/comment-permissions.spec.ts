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
  const slug = `comment-permissions-${stamp}`;

  const createResponse = await page.request.post("/api/admin/articles", {
    headers: { cookie: `ka_admin_session=${adminCookie}` },
    data: {
      title: `Comment permissions ${stamp}`,
      slug,
      contentMarkdown: "# Comment permissions test",
      categoryId,
      summary: "comment permissions",
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

test("comment creation rejects when closed", async ({ page }) => {
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  await prisma.article.update({
    where: { id: article.id },
    data: { commentStatus: ArticleCommentStatus.CLOSED },
  });

  const personalCookie = await registerPersonal(page, `closed-comment-${Date.now()}@knowledgeai.dev`);
  const response = await page.request.post(`/api/articles/${article.slug}/comments`, {
    headers: { cookie: `ka_personal_session=${personalCookie}` },
    data: { body: "closed comment" },
  });

  expect(response.status()).toBe(400);
  const json = (await response.json()) as { success: boolean; error?: { code?: string } };
  expect(json.success).toBeFalsy();
  expect(json.error?.code).toBe("COMMENT_CLOSED");
});

test("comment delete checks owner and admin", async ({ page }) => {
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  const ownerCookie = await registerPersonal(page, `owner-comment-${Date.now()}@knowledgeai.dev`);
  const ownerCreateResponse = await page.request.post(`/api/articles/${article.slug}/comments`, {
    headers: { cookie: `ka_personal_session=${ownerCookie}` },
    data: { body: "owner comment" },
  });
  expect(ownerCreateResponse.ok()).toBeTruthy();

  const ownerCreateJson = (await ownerCreateResponse.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(ownerCreateJson.success).toBeTruthy();
  const ownerCommentId = ownerCreateJson.data?.id ?? "";
  expect(ownerCommentId).toBeTruthy();

  const ownerDeleteResponse = await page.request.delete(`/api/comments/${ownerCommentId}`, {
    headers: { cookie: `ka_personal_session=${ownerCookie}` },
  });
  expect(ownerDeleteResponse.ok()).toBeTruthy();

  const otherCookie = await registerPersonal(page, `other-comment-${Date.now()}@knowledgeai.dev`);
  const otherCreateResponse = await page.request.post(`/api/articles/${article.slug}/comments`, {
    headers: { cookie: `ka_personal_session=${ownerCookie}` },
    data: { body: "admin delete" },
  });
  expect(otherCreateResponse.ok()).toBeTruthy();

  const otherCreateJson = (await otherCreateResponse.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(otherCreateJson.success).toBeTruthy();
  const adminCommentId = otherCreateJson.data?.id ?? "";
  expect(adminCommentId).toBeTruthy();

  const forbiddenResponse = await page.request.delete(`/api/comments/${adminCommentId}`, {
    headers: { cookie: `ka_personal_session=${otherCookie}` },
  });
  expect(forbiddenResponse.status()).toBe(403);

  const forbiddenJson = (await forbiddenResponse.json()) as {
    success: boolean;
    error?: { code?: string };
  };
  expect(forbiddenJson.success).toBeFalsy();
  expect(forbiddenJson.error?.code).toBe("FORBIDDEN");

  const adminDeleteResponse = await page.request.delete(`/api/admin/comments/${adminCommentId}`, {
    headers: { cookie: `ka_admin_session=${adminCookie}` },
  });
  expect(adminDeleteResponse.ok()).toBeTruthy();

  const adminDeleteJson = (await adminDeleteResponse.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(adminDeleteJson.success).toBeTruthy();
  expect(adminDeleteJson.data?.id).toBe(adminCommentId);
});
