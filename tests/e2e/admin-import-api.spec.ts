import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";

test("import api should create failed task for unsupported files and queue supported files", async ({ page }) => {
  await loginAsAdmin(page);

  const result = await page.evaluate(async () => {
    const form = new FormData();
    form.append(
      "files",
      new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], "bad.exe", { type: "application/x-msdownload" }),
    );
    form.append("files", new File(["# hello\nimport"], "ok.md", { type: "text/markdown" }));

    const response = await fetch(new URL("/api/admin/articles/import", window.location.origin).toString(), {
      method: "POST",
      body: form,
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.json(),
    };
  });

  expect(result.ok).toBeTruthy();
  expect(result.status).toBe(201);

  const json = result.body as {
    success: boolean;
    data?: {
      total?: number;
      items?: Array<{ fileName: string; status: string; errorCode: string | null; storagePath: string }>;
    };
  };

  expect(json.success).toBeTruthy();
  expect(json.data?.total).toBe(2);

  const items = json.data?.items ?? [];
  const unsupported = items.find((item) => item.fileName === "bad.exe");
  const supported = items.find((item) => item.fileName === "ok.md");

  expect(unsupported?.status).toBe("FAILED");
  expect(unsupported?.errorCode).toBe("UNSUPPORTED_FILE_TYPE");
  expect(unsupported?.storagePath.startsWith("unsupported://not-stored/")).toBeTruthy();
  expect(supported?.status).toBe("QUEUED");
  expect(supported?.errorCode).toBeNull();
  expect(supported?.storagePath.startsWith("unsupported://not-stored/")).toBeFalsy();
});

test("import api should process queued task and create draft article", async ({ page }) => {
  await loginAsAdmin(page);

  test.slow();  const created = await page.evaluate(async () => {
    const form = new FormData();
    form.append("files", new File(["# markdown draft\nhello import task"], "import-success.md", { type: "text/markdown" }));

    const response = await fetch(new URL("/api/admin/articles/import", window.location.origin).toString(), {
      method: "POST",
      body: form,
    });

    return {
      ok: response.ok,
      status: response.status,
      body: await response.json(),
    };
  });

  expect(created.ok).toBeTruthy();
  expect(created.status).toBe(201);

  const processed = await page.evaluate(async () => {
    const processRes = await fetch(new URL("/api/admin/articles/imports/process?limit=10", window.location.origin).toString(), {
      method: "POST",
    });
    const listRes = await fetch(new URL("/api/admin/articles/imports?page=1&pageSize=20", window.location.origin).toString());
    const articleRes = await fetch(new URL("/api/admin/articles?page=1&pageSize=50", window.location.origin).toString());

    return {
      processStatus: processRes.status,
      listStatus: listRes.status,
      articleStatus: articleRes.status,
      listBody: await listRes.json(),
      articleBody: await articleRes.json(),
    };
  });

  expect(processed.processStatus).toBe(200);
  expect(processed.listStatus).toBe(200);
  expect(processed.articleStatus).toBe(200);

  const listJson = processed.listBody as {
    success: boolean;
    data?: {
      items?: Array<{ fileName: string; status: string; articleId: string | null }>;
    };
  };

  expect(listJson.success).toBeTruthy();
  const createdTask = (listJson.data?.items ?? []).find((item) => item.fileName === "import-success.md");
  expect(createdTask?.status).toBe("SUCCEEDED");
  expect(createdTask?.articleId).toBeTruthy();

  const articleListJson = processed.articleBody as {
    success: boolean;
    data?: { items?: Array<{ title: string; status: string }> };
  };
  expect(articleListJson.success).toBeTruthy();
  const draft = (articleListJson.data?.items ?? []).find((item) => item.title === "import-success");
  expect(draft?.status).toBe("DRAFT");
});
