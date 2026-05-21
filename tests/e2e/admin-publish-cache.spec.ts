import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { buildE2EArticle } from "./support/article-factory";
import { articleEditorSelectors } from "./support/selectors";

test("publish, update and unpublish invalidate public content views", async ({ page }) => {
  test.setTimeout(120_000);
  const article = buildE2EArticle();

  await loginAsAdmin(page);
  await page.goto("/admin/articles/new");

  await page.getByTestId(articleEditorSelectors.title).fill(article.title);
  await page.getByTestId(articleEditorSelectors.slug).fill(article.slug);
  await page.getByTestId(articleEditorSelectors.summary).fill(article.summary);
  await page.getByTestId(articleEditorSelectors.markdown).fill(article.contentMarkdown);
  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/admin/articles") &&
      !response.url().includes("/publish") &&
      response.ok(),
  );
  const publishResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/admin/articles/") &&
      response.url().includes("/publish") &&
      response.ok(),
  );

  await page.getByTestId(articleEditorSelectors.publish).click();

  const createResponse = await createResponsePromise;
  await publishResponsePromise;
  const created = (await createResponse.json()) as { success: boolean; data?: { id?: string } };
  expect(created.success).toBeTruthy();
  expect(created.data?.id).toBeTruthy();

  const editUrl = `/admin/articles/${created.data?.id}/edit`;
  const publicPage = await page.context().newPage();

  await publicPage.goto(`/articles/${article.slug}`);
  await expect(publicPage.getByTestId("article-detail-title")).toHaveText(article.title);
  await expect(publicPage.getByText("旧内容")).toBeVisible();

  const initialSearchRes = await page.request.get(`/api/search?q=${encodeURIComponent(article.title)}`);
  expect(initialSearchRes.ok()).toBeTruthy();
  const initialSearchJson = (await initialSearchRes.json()) as {
    success: boolean;
    data?: { items?: Array<{ slug: string; excerpt?: string | null }> };
  };
  expect(initialSearchJson.success).toBeTruthy();
  expect(
    initialSearchJson.data?.items?.some(
      (item) => item.slug === article.slug && (item.excerpt ?? "").includes(article.summary),
    ),
  ).toBeTruthy();

  await page.goto(editUrl);
  await page.getByTestId(articleEditorSelectors.summary).fill(article.updatedSummary);
  await page.getByTestId(articleEditorSelectors.markdown).fill(article.updatedContentMarkdown);
  const updateResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" && response.url().includes("/api/admin/articles/"),
  );
  await page.getByTestId(articleEditorSelectors.save).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok()).toBeTruthy();

  await publicPage.goto(`/articles/${article.slug}`);
  await expect(publicPage.getByText("避免旧缓存继续生效")).toBeVisible();
  await expect(publicPage.getByText("旧内容")).not.toBeVisible();

  const updatedSearchRes = await page.request.get(`/api/search?q=${encodeURIComponent(article.title)}`);
  expect(updatedSearchRes.ok()).toBeTruthy();
  const updatedSearchJson = (await updatedSearchRes.json()) as {
    success: boolean;
    data?: { items?: Array<{ slug: string; excerpt?: string | null }> };
  };
  expect(updatedSearchJson.success).toBeTruthy();
  expect(
    updatedSearchJson.data?.items?.some(
      (item) => item.slug === article.slug && (item.excerpt ?? "").includes(article.updatedSummary),
    ),
  ).toBeTruthy();

  const semanticSearchRes = await page.request.get(
    `/api/search?q=${encodeURIComponent(article.updatedSemanticQuery)}`,
  );
  expect(semanticSearchRes.ok()).toBeTruthy();
  const semanticSearchJson = (await semanticSearchRes.json()) as {
    success: boolean;
    data?: { items?: Array<{ slug: string; title: string }> };
  };
  expect(semanticSearchJson.success).toBeTruthy();
  expect(
    semanticSearchJson.data?.items?.some((item) => item.slug === article.slug && item.title === article.title),
  ).toBeTruthy();

  await page.goto(editUrl);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/unpublish") &&
        response.ok(),
    ),
    page.getByTestId(articleEditorSelectors.unpublish).click(),
  ]);

  await publicPage.goto(`/articles/${article.slug}`);
  await expect(publicPage.getByRole("heading", { name: "未找到文章" })).toBeVisible();
});
