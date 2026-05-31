import { expect, type APIResponse, type Page, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

async function wait(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(page: Page, url: string, data?: unknown, attempts = 3) {
  let last: APIResponse | null = null;
  for (let i = 0; i < attempts; i += 1) {
    const res = await page.request.post(url, data ? { data } : undefined);
    if (res.ok()) return res;
    last = res;
    if (i < attempts - 1) await wait(1000);
  }
  return last;
}

async function loginAdminForApi(page: Page) {
  const response = await postWithRetry(page, "/api/admin/login", {
    email: "admin@knowledgeai.dev",
    password: "dev",
  });
  expect(response?.ok()).toBeTruthy();
}

async function createPublishedArticle(page: Page) {
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

  const createResponse = await postWithRetry(page, "/api/admin/articles", {
    title,
    slug,
    contentMarkdown: "# admin comment test",
    categoryId,
    summary: "admin comment",
    tagIds: [],
  });
  expect(createResponse?.ok()).toBeTruthy();

  const createJson = (await createResponse!.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(createJson.success).toBeTruthy();
  expect(createJson.data?.id).toBeTruthy();

  const articleId = createJson.data?.id ?? "";
  const publishResponse = await postWithRetry(page, `/api/admin/articles/${articleId}/publish`);
  expect(publishResponse?.ok()).toBeTruthy();

  return { id: articleId, slug, title };
}

test("admin can filter comments by article and delete", async ({ page }) => {
  test.slow();

  await loginAdminForApi(page);
  const article = await createPublishedArticle(page);

  const body = `admin comment body ${Date.now()}`;
  const createCommentResponse = await page.request.post(`/api/articles/${article.slug}/comments`, {
    data: { body, authorName: "测试用户" },
  });
  expect(createCommentResponse.ok()).toBeTruthy();

  await loginAsAdmin(page, "/admin/comments");

  await expect(page.getByTestId("admin-comments-panel")).toBeVisible();

  await page.getByTestId("admin-comments-article-filter").click();
  await page.getByText(`${article.title} (${article.slug})`).click();

  const row = page.getByTestId("admin-comment-row").filter({ hasText: body });
  await expect(row).toHaveCount(1);

  const deleteButton = row.first().getByTestId("admin-comment-delete");
  await expect(deleteButton).toBeEnabled({ timeout: 30_000 });

  const deleteResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      response.url().includes("/api/admin/comments/") &&
      response.ok(),
  );

  page.once("dialog", (dialog) => dialog.accept());
  await deleteButton.click();

  await deleteResponsePromise;
  await expect(row).toHaveCount(0, { timeout: 30_000 });
});

test("rejects when upload count is greater than five", async ({ page }) => {
  await loginAsAdmin(page);

  const result = await page.evaluate(async () => {
    const form = new FormData();
    for (let i = 0; i < 6; i++) {
      form.append("files", new File([`# doc ${i}`], `file-${i}.md`, { type: "text/markdown" }));
    }
    const response = await fetch(new URL("/api/admin/articles/import", window.location.origin).toString(), {
      method: "POST",
      body: form,
    });
    return { status: response.status, body: await response.json() };
  });

  expect(result.status).toBe(400);
  const json = result.body as { success: boolean; error?: { code?: string } };
  expect(json.success).toBeFalsy();
  expect(json.error?.code).toBe("IMPORT_FILE_COUNT_INVALID");
});
