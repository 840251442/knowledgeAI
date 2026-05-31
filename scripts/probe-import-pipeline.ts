/**
 * probe-import-pipeline.ts
 *
 * 本地验收探针：模拟上传 txt 文件 → 触发批量解析 → 打印任务状态与草稿文章
 *
 * 用法（需先启动 dev 服务器并配置好 .env）：
 *   npm run probe:import
 *
 * 可选环境变量：
 *   PROBE_BASE_URL        默认 http://localhost:3000
 *   PROBE_ADMIN_EMAIL     默认 admin@knowledgeai.dev
 *   PROBE_ADMIN_PASSWORD  默认 dev
 */

import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.PROBE_BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL ?? "admin@knowledgeai.dev";
const ADMIN_PASSWORD = process.env.PROBE_ADMIN_PASSWORD ?? "dev";

async function main() {
  console.log(`[probe] target: ${BASE}`);

  // 1. 登录取 cookie
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!loginRes.ok) {
    console.error("[probe] login failed:", loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const rawCookie = loginRes.headers.get("set-cookie") ?? "";
  const sessionCookie = rawCookie.split(";")[0] ?? "";
  console.log("[probe] logged in, session:", sessionCookie.slice(0, 40) + "...");

  // 2. 构造临时 txt 文件并上传
  const stamp = Date.now();
  const tmpFile = join(tmpdir(), `probe-import-${stamp}.txt`);
  const fileName = `probe-${stamp}.txt`;
  writeFileSync(tmpFile, "# probe 导入测试\n\n这是一段探针正文，用于验证导入解析管道。\n", "utf-8");
  console.log("[probe] temp file:", tmpFile);

  const fileBytes = readFileSync(tmpFile);
  unlinkSync(tmpFile);

  // 3. 使用 Node 22 原生 fetch + FormData（全局已内置）
  const form = new FormData();
  form.append("files", new Blob([fileBytes], { type: "text/plain" }), fileName);

  const uploadRes = await fetch(`${BASE}/api/admin/articles/import`, {
    method: "POST",
    headers: { cookie: sessionCookie },
    body: form,
  });
  const uploadJson = (await uploadRes.json()) as {
    success: boolean;
    data?: { total?: number; items?: Array<{ id: string; status: string }> };
    error?: { message?: string };
  };
  if (!uploadJson.success) {
    console.error("[probe] upload failed:", uploadJson.error?.message);
    process.exit(1);
  }
  console.log(
    `[probe] uploaded: total=${uploadJson.data?.total}, tasks=`,
    uploadJson.data?.items?.map((t) => `${t.id}(${t.status})`),
  );

  // 4. 触发批量解析
  const processRes = await fetch(`${BASE}/api/admin/articles/imports/process?limit=10`, {
    method: "POST",
    headers: { cookie: sessionCookie },
  });
  const processJson = (await processRes.json()) as { success: boolean; data?: { processed?: number } };
  console.log(`[probe] process: processed=${processJson.data?.processed}`);

  // 5. 列出最近任务状态
  const listRes = await fetch(`${BASE}/api/admin/articles/imports?page=1&pageSize=5`, {
    headers: { cookie: sessionCookie },
  });
  const listJson = (await listRes.json()) as {
    success: boolean;
    data?: { items?: Array<{ id: string; fileName: string; status: string; articleId: string | null }> };
  };
  console.log("[probe] recent tasks:");
  for (const t of listJson.data?.items ?? []) {
    console.log(`  ${t.fileName} → status=${t.status} articleId=${t.articleId ?? "-"}`);
  }

  // 6. 打印最近草稿文章
  const articleRes = await fetch(`${BASE}/api/admin/articles?page=1&pageSize=5`, {
    headers: { cookie: sessionCookie },
  });
  const articleJson = (await articleRes.json()) as {
    success: boolean;
    data?: { items?: Array<{ id: string; title: string; status: string }> };
  };
  console.log("[probe] recent articles:");
  for (const a of articleJson.data?.items ?? []) {
    console.log(`  [${a.status}] ${a.title} (${a.id})`);
  }

  console.log("[probe] done");
}

main().catch((err: unknown) => {
  console.error("[probe] error:", err);
  process.exit(1);
});
