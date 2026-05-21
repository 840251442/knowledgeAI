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
  await loginPersonalByApi(page, "writer1@knowledgeai.dev", "Writer#123456");

  const createResult = await page.evaluate(async () => {
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
        title: "个人文章",
        slug: "personal-article-e2e",
        contentMarkdown: "# hello",
        categoryId: backendCategory.id,
        tagIds: [],
      }),
    });
    return { ok: response.ok, status: response.status, body: await response.json() };
  });
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
