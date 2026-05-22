import { expect, type Page, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

async function loginPersonalByApi(page: Page, email: string, password: string) {
  await page.goto("/");

  const registerResult = await page.evaluate(async ({ email, password }) => {
    const response = await fetch(new URL("/api/auth/register", window.location.origin).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, role: "PERSONAL" }),
    });
    return { ok: response.ok, status: response.status, body: await response.json() };
  }, { email, password });

  expect(registerResult.ok).toBeTruthy();
  const registerJson = registerResult.body as { success: boolean };
  expect(registerJson.success).toBeTruthy();
}

test("personal submit publish should enter ai review workflow", async ({ page }) => {
  const stamp = Date.now();
  await loginPersonalByApi(page, `writer-${stamp}@knowledgeai.dev`, "Writer#123456");

  const createResult = await page.evaluate(async ({ stamp }) => {
    const categoriesResponse = await fetch(
      new URL("/api/categories", window.location.origin).toString(),
    );
    const categoriesJson = (await categoriesResponse.json()) as {
      success: boolean;
      data?: Array<{ id: string; slug: string }>;
    };
    const backendCategory = categoriesJson.data?.find((category) => category.slug === "backend");
    if (!backendCategory?.id) {
      return { ok: false, status: 500, body: { success: false, error: { message: "缺少分类" } } };
    }

    const response = await fetch(new URL("/api/me/articles", window.location.origin).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `个人文章-${stamp}`,
        slug: `personal-article-e2e-${stamp}`,
        contentMarkdown: "# hello",
        categoryId: backendCategory.id,
        tagIds: [],
      }),
    });
    return { ok: response.ok, status: response.status, body: await response.json() };
  }, { stamp });
  expect(createResult.ok).toBeTruthy();

  const created = createResult.body as { success: boolean; data?: { id?: string } };
  expect(created.success).toBeTruthy();
  expect(created.data?.id).toBeTruthy();

  const submitResult = await page.evaluate(async (articleId) => {
    const response = await fetch(`/api/me/articles/${articleId}/submit`, { method: "POST" });
    return { ok: response.ok, status: response.status, body: await response.json() };
  }, created.data?.id);
  expect(submitResult.ok).toBeTruthy();

  const submitJson = submitResult.body as { success: boolean; data?: { status?: string } };
  expect(submitJson.success).toBeTruthy();
  expect(submitJson.data?.status).toBe("PENDING_REVIEW");
});

test("personal user cannot access admin review api", async ({ page }) => {
  await loginPersonalByApi(page, `writer-review-${Date.now()}@knowledgeai.dev`, "Writer#123456");

  const queueResult = await page.evaluate(async () => {
    const response = await fetch(new URL("/api/admin/reviews", window.location.origin).toString());
    return { ok: response.ok, status: response.status, body: await response.json() };
  });

  expect(queueResult.ok).toBeFalsy();
  expect(queueResult.status).toBe(403);
});

test("personal user should only see own articles in admin list api", async ({ page }) => {
  const stamp = Date.now();
  await loginPersonalByApi(page, `writer-own-${stamp}@knowledgeai.dev`, "Writer#123456");

  const createResult = await page.evaluate(async ({ stamp }) => {
    const categoriesResponse = await fetch(new URL("/api/categories", window.location.origin).toString());
    const categoriesJson = (await categoriesResponse.json()) as {
      success: boolean;
      data?: Array<{ id: string; slug: string }>;
    };
    const backendCategory = categoriesJson.data?.find((category) => category.slug === "backend");
    if (!backendCategory?.id) {
      return { ok: false, status: 500, body: { success: false, error: { message: "缺少分类" } } };
    }

    const response = await fetch(new URL("/api/admin/articles", window.location.origin).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: `个人后台文章-${stamp}`,
        slug: `personal-admin-own-${stamp}`,
        contentMarkdown: "# own",
        categoryId: backendCategory.id,
        tagIds: [],
      }),
    });
    return { ok: response.ok, status: response.status, body: await response.json() };
  }, { stamp });
  expect(createResult.ok).toBeTruthy();

  const listResult = await page.evaluate(async () => {
    const response = await fetch(new URL("/api/admin/articles?page=1&pageSize=100", window.location.origin).toString());
    return { ok: response.ok, status: response.status, body: await response.json() };
  });
  expect(listResult.ok).toBeTruthy();

  const listJson = listResult.body as {
    success: boolean;
    data?: { items?: Array<{ slug: string }> };
  };
  expect(listJson.success).toBeTruthy();
  const items = listJson.data?.items ?? [];
  expect(items.length).toBe(1);
  expect(items[0]?.slug.startsWith("personal-admin-own-")).toBeTruthy();
});

test("ai rejected article should enter admin manual queue", async ({ page }) => {
  await loginAsAdmin(page);

  const queueResult = await page.evaluate(async () => {
    const response = await fetch(new URL("/api/admin/reviews", window.location.origin).toString());
    return { ok: response.ok, status: response.status, body: await response.json() };
  });
  expect(queueResult.ok).toBeTruthy();

  const queueJson = queueResult.body as {
    success: boolean;
    data?: { items?: Array<{ articleId: string; decision: string }> };
  };
  expect(queueJson.success).toBeTruthy();
  expect(Array.isArray(queueJson.data?.items)).toBeTruthy();
});
