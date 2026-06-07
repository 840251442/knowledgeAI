import { expect, type Page, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

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
  test.slow();
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("暂无评论")).toBeVisible();
  await expect(page.getByTestId("comment-input")).toBeVisible();
});

test("public article hides input when comments are closed", async ({ page }) => {
  test.slow();
  const adminCookie = await loginAdminForApi(page);
  const article = await createPublishedArticle(page, adminCookie);

  await prisma.article.update({
    where: { id: article.id },
    data: { commentStatus: "CLOSED" },
  });

  await page.goto(`/articles/${article.slug}`);
  await expect(page.getByText("暂无评论")).toBeVisible();
  await expect(page.getByTestId("comment-input")).toHaveCount(0);
});

test("public comments show guest and personal names", async ({ page }) => {
  test.slow();
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

test("returns only own import tasks for personal user", async ({ page }) => {
  const stamp = Date.now();
  const email = `import-personal-${stamp}@knowledgeai.dev`;
  const password = "Writer#123456";

  // register personal account
  await page.goto("/");
  const regResult = await page.evaluate(async ({ email, password }) => {
    const res = await fetch(new URL("/api/auth/register", window.location.origin).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, role: "PERSONAL" }),
    });
    return { ok: res.ok };
  }, { email, password });
  expect(regResult.ok).toBeTruthy();

  // upload one file as personal user
  const uploadResult = await page.evaluate(async ({ stamp }) => {
    const form = new FormData();
    form.append("files", new File([`# personal import ${stamp}`], `personal-${stamp}.md`, { type: "text/markdown" }));
    const res = await fetch(new URL("/api/admin/articles/import", window.location.origin).toString(), {
      method: "POST",
      body: form,
    });
    return { ok: res.ok, status: res.status };
  }, { stamp });
  expect(uploadResult.ok).toBeTruthy();

  // list import tasks - should only see own
  const listResult = await page.evaluate(async () => {
    const res = await fetch(new URL("/api/admin/articles/imports?page=1&pageSize=20", window.location.origin).toString());
    return { ok: res.ok, status: res.status, body: await res.json() };
  });
  expect(listResult.ok).toBeTruthy();
  expect(listResult.status).toBe(200);

  const json = listResult.body as { success: boolean; data?: { items?: Array<{ uploaderId: string }> } };
  expect(json.success).toBeTruthy();
  // all returned tasks belong to the same user (no cross-user leakage)
  const items = json.data?.items ?? [];
  const uploaderIds = [...new Set(items.map((i) => i.uploaderId))];
  expect(uploaderIds.length).toBeLessThanOrEqual(1);
});
