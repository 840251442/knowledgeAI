import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

type IndexState = "not_started" | "pending" | "running" | "success" | "failed";

type IndexStatusPayload = {
  articleId: string;
  state: IndexState;
  latestTask: {
    id: string;
    taskType: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
    createdAt: string;
  } | null;
  chunkSummary: {
    total: number;
    done: number;
    failed: number;
  };
  lastSuccessAt: string | null;
};

function extractSessionCookie(setCookieHeader: string | null, cookieName: string) {
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? null;
}

async function getBackendCategoryId(request: APIRequestContext) {
  const res = await request.get("/api/categories");
  expect(res.ok()).toBeTruthy();

  const json = (await res.json()) as {
    success: boolean;
    data?: Array<{ id: string; slug: string }>;
  };
  expect(json.success).toBeTruthy();

  const backend = json.data?.find((item) => item.slug === "backend");
  expect(backend?.id).toBeTruthy();
  if (!backend?.id) {
    throw new Error("missing backend category");
  }

  return backend.id;
}

async function createDraftArticle(request: APIRequestContext, suffix: string) {
  const categoryId = await getBackendCategoryId(request);
  const createRes = await request.post("/api/admin/articles", {
    data: {
      title: `索引回归文章-${suffix}`,
      slug: `index-e2e-${suffix}`,
      summary: "草稿摘要",
      contentMarkdown: "# 索引回归\n\n草稿正文",
      categoryId,
      tagIds: [],
    },
  });
  expect(createRes.ok()).toBeTruthy();

  const createJson = (await createRes.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(createJson.success).toBeTruthy();
  expect(createJson.data?.id).toBeTruthy();
  if (!createJson.data?.id) {
    throw new Error("article id missing");
  }

  return createJson.data.id;
}

async function getIndexStatus(request: APIRequestContext, articleId: string) {
  const res = await request.get(`/api/admin/articles/${articleId}/index-status`);
  expect(res.ok()).toBeTruthy();

  const json = (await res.json()) as {
    success: boolean;
    data?: IndexStatusPayload;
  };
  expect(json.success).toBeTruthy();
  expect(json.data).toBeTruthy();
  if (!json.data) {
    throw new Error("index status missing");
  }

  return json.data;
}

async function waitUntilIndex(
  request: APIRequestContext,
  articleId: string,
  predicate: (status: IndexStatusPayload) => boolean,
  timeoutMs = 60_000,
) {
  const deadline = Date.now() + timeoutMs;
  let latest: IndexStatusPayload | null = null;

  while (Date.now() < deadline) {
    latest = await getIndexStatus(request, articleId);
    if (predicate(latest)) return latest;
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`index polling timeout, latest=${JSON.stringify(latest)}`);
}

async function registerPersonalForApi(request: APIRequestContext, email: string, password: string) {
  const response = await request.post("/api/auth/register", {
    data: { email, password, role: "PERSONAL" },
  });
  expect(response.ok()).toBeTruthy();

  const json = (await response.json()) as { success: boolean };
  expect(json.success).toBeTruthy();

  const cookie = extractSessionCookie(response.headers()["set-cookie"] ?? null, "ka_personal_session");
  expect(cookie).toBeTruthy();
  return cookie ?? "";
}

test("index status/reindex api should enforce 401 404 403", async ({ page, request }) => {
  test.slow();

  const anonymousStatus = await request.get(`/api/admin/articles/not-exists-${Date.now()}/index-status`);
  expect(anonymousStatus.status()).toBe(401);

  const anonymousReindex = await request.post(`/api/admin/articles/not-exists-${Date.now()}/reindex`);
  expect(anonymousReindex.status()).toBe(401);

  await loginAsAdmin(page);
  const articleId = await createDraftArticle(page.request, `${Date.now()}-scope`);

  const notFoundStatus = await page.request.get(`/api/admin/articles/not-exists-${Date.now()}/index-status`);
  expect(notFoundStatus.status()).toBe(404);

  const notFoundReindex = await page.request.post(`/api/admin/articles/not-exists-${Date.now()}/reindex`);
  expect(notFoundReindex.status()).toBe(404);

  const personalCookie = await registerPersonalForApi(
    request,
    `index-forbidden-${Date.now()}@knowledgeai.dev`,
    "Writer#123456",
  );

  const forbiddenStatus = await request.get(`/api/admin/articles/${articleId}/index-status`, {
    headers: { cookie: `ka_personal_session=${personalCookie}` },
  });
  expect(forbiddenStatus.status()).toBe(403);

  const forbiddenReindex = await request.post(`/api/admin/articles/${articleId}/reindex`, {
    headers: { cookie: `ka_personal_session=${personalCookie}` },
  });
  expect(forbiddenReindex.status()).toBe(403);
});

test("publish/update/manual should produce corresponding index tasks", async ({ page }) => {
  test.setTimeout(180_000);

  await loginAsAdmin(page);
  const suffix = `${Date.now()}-flow`;
  const articleId = await createDraftArticle(page.request, suffix);

  const draftStatus = await getIndexStatus(page.request, articleId);
  expect(draftStatus.state).toBe("not_started");
  expect(draftStatus.latestTask).toBeNull();

  const updateDraftRes = await page.request.put(`/api/admin/articles/${articleId}`, {
    data: {
      title: `索引回归文章-${suffix}`,
      slug: `index-e2e-${suffix}`,
      summary: "草稿保存后不触发索引",
      contentMarkdown: "# 索引回归\n\n草稿保存后不应触发索引任务",
    },
  });
  expect(updateDraftRes.ok()).toBeTruthy();

  const afterDraftSaveStatus = await getIndexStatus(page.request, articleId);
  expect(afterDraftSaveStatus.state).toBe("not_started");
  expect(afterDraftSaveStatus.latestTask).toBeNull();

  const publishRes = await page.request.post(`/api/admin/articles/${articleId}/publish`);
  expect(publishRes.ok()).toBeTruthy();

  const publishDone = await waitUntilIndex(
    page.request,
    articleId,
    (status) => status.latestTask?.taskType === "PUBLISH" && status.latestTask.status === "SUCCESS" && status.state === "success",
  );
  expect(publishDone.chunkSummary.done).toBeGreaterThan(0);

  const updatePublishedRes = await page.request.put(`/api/admin/articles/${articleId}`, {
    data: {
      title: `索引回归文章-${suffix}`,
      slug: `index-e2e-${suffix}`,
      summary: "已发布保存应触发 UPDATE 索引",
      contentMarkdown: "# 索引回归\n\n已发布保存会触发 UPDATE 任务",
    },
  });
  expect(updatePublishedRes.ok()).toBeTruthy();

  await waitUntilIndex(
    page.request,
    articleId,
    (status) => status.latestTask?.taskType === "UPDATE" && status.latestTask.status === "SUCCESS" && status.state === "success",
  );

  const manualRes = await page.request.post(`/api/admin/articles/${articleId}/reindex`);
  expect(manualRes.ok()).toBeTruthy();

  const manualJson = (await manualRes.json()) as {
    success: boolean;
    data?: { taskId?: string; state?: IndexState };
  };
  expect(manualJson.success).toBeTruthy();
  expect(manualJson.data?.taskId).toBeTruthy();

  await waitUntilIndex(
    page.request,
    articleId,
    (status) => status.latestTask?.taskType === "MANUAL" && status.latestTask.status === "SUCCESS" && status.state === "success",
  );
});
