import { expect, test, type APIResponse, type Page } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { articleEditorSelectors } from "./support/selectors";

async function wait(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(
  page: Page,
  method: "GET" | "POST" | "PUT",
  url: string,
  data?: unknown,
  attempts = 3,
) {
  let last: APIResponse | null = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const res =
        method === "GET"
          ? await page.request.get(url, { timeout: 40_000 })
          : method === "POST"
            ? await page.request.post(url, { data, timeout: 40_000 })
            : await page.request.put(url, { data, timeout: 40_000 });

      if (res.ok()) return res;
      last = res;
    } catch {
      // Retry on transient network/server timeout under full-suite load.
    }

    if (i < attempts - 1) await wait(1500);
  }

  return last;
}

async function getBackendCategoryId(page: Page) {
  const categoriesResponse = await requestWithRetry(page, "GET", "/api/categories");
  expect(categoriesResponse?.ok()).toBeTruthy();

  const categoriesJson = (await categoriesResponse!.json()) as {
    success: boolean;
    data?: Array<{ id: string; slug: string }>;
  };
  expect(categoriesJson.success).toBeTruthy();

  const category = categoriesJson.data?.find((item) => item.slug === "backend");
  expect(category?.id).toBeTruthy();
  return category?.id ?? "";
}

test("publish, update and unpublish invalidate public content views", async ({ page }) => {
  test.setTimeout(150_000);

  const stamp = Date.now();
  const title = `cache-acceptance-${stamp}`;
  const slug = `cache-acceptance-${stamp}`;

  await loginAsAdmin(page);
  const categoryId = await getBackendCategoryId(page);

  const createRes = await requestWithRetry(page, "POST", "/api/admin/articles", {
    title,
    slug,
    summary: "初始摘要：旧内容",
    contentMarkdown: "# 缓存验收文章\n\n## 初始版本\n旧内容",
    categoryId,
    tagIds: [],
  });
  expect(createRes?.ok()).toBeTruthy();

  const createJson = (await createRes!.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(createJson.success).toBeTruthy();
  const articleId = createJson.data?.id ?? "";
  expect(articleId).toBeTruthy();

  const publishRes = await requestWithRetry(page, "POST", `/api/admin/articles/${articleId}/publish`);
  expect(publishRes?.ok()).toBeTruthy();

  const publicPage = await page.context().newPage();
  const encodedSlug = encodeURIComponent(slug);

  await expect
    .poll(
      async () => {
        await publicPage.goto(`/articles/${encodedSlug}`);
        return await publicPage.getByTestId("article-detail-title").count();
      },
      { timeout: 30_000, intervals: [1000, 2000, 3000] },
    )
    .toBe(1);

  await expect(publicPage.getByTestId("article-detail-title")).toHaveText(title);
  await expect(publicPage.getByText("旧内容")).toBeVisible();

  const updateRes = await requestWithRetry(page, "PUT", `/api/admin/articles/${articleId}`, {
    title,
    slug,
    summary: "更新摘要：新内容",
    contentMarkdown:
      "# 缓存验收文章\n\n## 更新版本\n发布后先删旧缓存，再重新读取最新正文，避免旧缓存继续生效。",
    categoryId,
    tagIds: [],
  });
  expect(updateRes?.ok()).toBeTruthy();

  await publicPage.goto(`/articles/${encodedSlug}`);
  await expect(publicPage.getByText("避免旧缓存继续生效")).toBeVisible();
  await expect(publicPage.getByText("旧内容")).not.toBeVisible();

  const unpublishRes = await requestWithRetry(page, "POST", `/api/admin/articles/${articleId}/unpublish`);
  expect(unpublishRes?.ok()).toBeTruthy();

  await publicPage.goto(`/articles/${encodedSlug}`);
  await expect(publicPage.getByRole("heading", { name: "未找到文章" })).toBeVisible();
});

test("admin article editor saves markdown changes and reloads latest content", async ({ page }) => {
  test.setTimeout(120_000);

  const stamp = Date.now();
  const title = `editor-save-${stamp}`;
  const slug = `editor-save-${stamp}`;
  const initialMarkdown = "# 初始正文\n\n旧内容";
  const updatedMarkdown = "# 初始正文\n\n新内容";

  await loginAsAdmin(page);
  const categoryId = await getBackendCategoryId(page);

  const createRes = await requestWithRetry(page, "POST", "/api/admin/articles", {
    title,
    slug,
    summary: "编辑页保存验证",
    contentMarkdown: initialMarkdown,
    categoryId,
    tagIds: [],
  });
  expect(createRes?.ok()).toBeTruthy();

  const createJson = (await createRes!.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(createJson.success).toBeTruthy();
  const articleId = createJson.data?.id ?? "";
  expect(articleId).toBeTruthy();

  await page.goto(`/admin/articles/${articleId}/edit`);
  await expect(page.getByTestId(articleEditorSelectors.root)).toBeVisible();
  await expect(page.getByTestId(articleEditorSelectors.markdown)).toHaveValue(initialMarkdown);

  const markdownInput = page.getByTestId(articleEditorSelectors.markdown);
  await markdownInput.click();
  await markdownInput.press("Meta+A");
  await markdownInput.fill(updatedMarkdown);

  const saveResponsePromise = page.waitForResponse((response) => {
    return response.url().includes(`/api/admin/articles/${articleId}`) && response.request().method() === "PUT";
  });
  await page.getByTestId(articleEditorSelectors.save).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.ok()).toBeTruthy();

  await page.reload();
  await expect(page.getByTestId(articleEditorSelectors.root)).toBeVisible();
  await expect(page.getByTestId(articleEditorSelectors.markdown)).toHaveValue(updatedMarkdown);
});
