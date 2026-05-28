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
