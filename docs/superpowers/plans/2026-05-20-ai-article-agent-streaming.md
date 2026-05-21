# AI Article Agent Streaming Implementation Plan
> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 在后台文章编辑页新增 AI 创作入口，输入关键词后通过 LangChain 流式生成正文草稿，并先显示到临时预览区，由用户手动决定是否插入正文。

**Architecture:** 新增 `LangChain 文章智能体服务 + Admin 流式 SSE API + 编辑器侧流式消费 UI` 三层结构。服务端仅生成 Markdown 正文且限制最大 2000 字；前端不自动覆盖正文，用户点击“插入正文”后才写入编辑器。搜索与发布链路保持不变。

**Tech Stack:** Next.js App Router, React Client Components, TypeScript, LangChain (`langchain`, `@langchain/openai`), Playwright

---

## Scope Check

该需求涉及同一条“AI 创作正文”主链路（服务端生成 + 前端预览/插入 + 回归验证），建议保持为单一计划执行，不拆分子计划。

## File Structure Mapping

- Create: `src/services/ai-article-agent.service.ts`
  - LangChain 文章智能体，按关键词流式输出 Markdown 正文
- Create: `src/app/api/admin/ai/draft/stream/route.ts`
  - 后台鉴权 + SSE 流式接口
- Create: `tests/e2e/admin-ai-draft.spec.ts`
  - AI 创作入口、流式预览、插入正文回归
- Modify: `src/config/ai.ts`
  - 增加写作模型配置（`AI_WRITER_MODEL`、`AI_WRITER_MAX_CHARS`）
- Modify: `src/components/admin/ArticleEditor.tsx`
  - 新增 AI 创作入口、关键词输入、临时预览区、插入/放弃
- Modify: `src/app/admin/admin.css`
  - AI 创作面板样式
- Modify: `tests/e2e/support/selectors.ts`
  - 新增 AI 创作相关 test id
- Modify: `.env.example`
  - 增加 AI 写作模型参数示例
- Modify: `package.json`
  - 增加 LangChain 依赖
- Modify: `README.md`
  - 补充 AI 创作入口与配置说明

### Task 1: Lock AI Draft UX With Failing E2E

**Files:**
- Modify: `tests/e2e/support/selectors.ts`
- Create: `tests/e2e/admin-ai-draft.spec.ts`

- [x] **Step 1: Add AI draft selectors**
```ts
// tests/e2e/support/selectors.ts
export const articleEditorSelectors = {
  root: "article-editor",
  title: "article-editor-title",
  slug: "article-editor-slug",
  summary: "article-editor-summary",
  category: "article-editor-category",
  markdown: "article-editor-markdown",
  save: "article-editor-save",
  publish: "article-editor-publish",
  unpublish: "article-editor-unpublish",
  aiEntry: "article-editor-ai-entry",
  aiPanel: "article-editor-ai-panel",
  aiKeyword: "article-editor-ai-keyword",
  aiGenerate: "article-editor-ai-generate",
  aiPreview: "article-editor-ai-preview",
  aiInsert: "article-editor-ai-insert",
  aiDiscard: "article-editor-ai-discard",
} as const;
```

- [x] **Step 2: Write failing E2E for AI panel and insert flow**
```ts
// tests/e2e/admin-ai-draft.spec.ts
import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./support/auth";
import { articleEditorSelectors } from "./support/selectors";

test("article editor shows AI draft panel and allows insert", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/articles/new");

  await page.getByTestId(articleEditorSelectors.aiEntry).click();
  await expect(page.getByTestId(articleEditorSelectors.aiPanel)).toBeVisible();

  await page.getByTestId(articleEditorSelectors.aiKeyword).fill("Redis 缓存一致性");
  await page.getByTestId(articleEditorSelectors.aiGenerate).click();

  await expect(page.getByTestId(articleEditorSelectors.aiPreview)).toContainText("##");

  const before = await page.getByTestId(articleEditorSelectors.markdown).inputValue();
  await page.getByTestId(articleEditorSelectors.aiInsert).click();
  const after = await page.getByTestId(articleEditorSelectors.markdown).inputValue();

  expect(after.length).toBeGreaterThan(before.length);
});
```

- [x] **Step 3: Run focused spec to confirm failure**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/admin-ai-draft.spec.ts --project=chromium
```
Expected: FAIL because AI entry/panel/test ids are not implemented yet.

- [x] **Step 4: Commit test baseline**
```bash
git add tests/e2e/support/selectors.ts tests/e2e/admin-ai-draft.spec.ts
git commit -m "test: lock ai draft editor behavior"
```

### Task 2: Build LangChain Article Agent and Streaming API

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/config/ai.ts`
- Create: `src/services/ai-article-agent.service.ts`
- Create: `src/app/api/admin/ai/draft/stream/route.ts`

- [x] **Step 1: Add runtime dependencies for LangChain**
```json
{
  "dependencies": {
    "langchain": "^0.3.20",
    "@langchain/openai": "^0.5.16"
  }
}
```

- [x] **Step 2: Add writer config boundary**
```ts
// src/config/ai.ts (additions)
const writerModel = process.env.AI_WRITER_MODEL?.trim() || "qwen-plus";
const writerMaxCharsRaw = Number(process.env.AI_WRITER_MAX_CHARS ?? "2000");
const writerMaxChars = Number.isFinite(writerMaxCharsRaw)
  ? Math.max(200, Math.min(2000, Math.floor(writerMaxCharsRaw)))
  : 2000;

export const aiConfig = {
  // existing fields...
  writerModel,
  writerMaxChars,
} as const;
```

- [x] **Step 3: Add environment examples for writer model**
```env
AI_WRITER_MODEL="qwen-plus"
AI_WRITER_MAX_CHARS="2000"
```

- [x] **Step 4: Implement LangChain article agent service**
```ts
// src/services/ai-article-agent.service.ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { requireAiConfig } from "@/config/ai";

export async function* streamArticleDraft(input: { keyword: string }) {
  const config = requireAiConfig();
  const model = new ChatOpenAI({
    model: config.writerModel,
    apiKey: config.embeddingApiKey,
    configuration: {
      baseURL: config.embeddingBaseUrl ?? undefined,
    },
    temperature: 0.7,
    streaming: true,
  });

  const system = new SystemMessage(
    `你是技术文章写作助手。只输出 Markdown 正文，不输出标题、摘要、slug、标签。正文必须是中文，结构清晰，最大 ${config.writerMaxChars} 字。`,
  );
  const human = new HumanMessage(`关键词：${input.keyword}`);

  let total = 0;
  const stream = await model.stream([system, human]);
  for await (const chunk of stream) {
    const text = chunk.content?.toString() ?? "";
    if (!text) continue;
    if (total >= config.writerMaxChars) break;
    const rest = config.writerMaxChars - total;
    const emit = text.slice(0, rest);
    total += emit.length;
    yield emit;
  }
}
```

- [x] **Step 5: Implement admin streaming API route (SSE)**
```ts
// src/app/api/admin/ai/draft/stream/route.ts
import { apiError } from "@/lib/api/response";
import { requireAdminUserId } from "@/lib/auth/require-admin";
import { streamArticleDraft } from "@/services/ai-article-agent.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requireAdminUserId();
  if (!userId) return apiError("未登录", { status: 401, code: "UNAUTHORIZED" });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("请求体不是有效的 JSON", { status: 400, code: "BAD_JSON" });
  }

  const keyword = typeof (payload as { keyword?: unknown }).keyword === "string"
    ? (payload as { keyword: string }).keyword.trim()
    : "";

  if (!keyword) {
    return apiError("缺少关键词", { status: 400, code: "MISSING_KEYWORD" });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of streamArticleDraft({ keyword })) {
          controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content: delta })}\n\n`));
        }
        controller.enqueue(encoder.encode("event: done\\ndata: {}\\n\\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : "生成失败";
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
```

- [x] **Step 6: Install dependencies and run typecheck**
Run:
```bash
npm install
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
```
Expected: PASS.

- [x] **Step 7: Commit backend streaming foundation**
```bash
git add package.json package-lock.json .env.example src/config/ai.ts src/services/ai-article-agent.service.ts src/app/api/admin/ai/draft/stream/route.ts
git commit -m "feat: add langchain article draft streaming api"
```

### Task 3: Wire AI Draft Panel Into Article Editor

**Files:**
- Modify: `src/components/admin/ArticleEditor.tsx`
- Modify: `src/app/admin/admin.css`

- [x] **Step 1: Add failing UI state expectation in test snippet**
```ts
// tests/e2e/admin-ai-draft.spec.ts (assert while generating)
await expect(page.getByTestId(articleEditorSelectors.aiGenerate)).toBeDisabled();
```

- [x] **Step 2: Add AI panel states and controls in editor component**
```tsx
// ArticleEditor.tsx (new state)
const [showAiPanel, setShowAiPanel] = useState(false);
const [aiKeyword, setAiKeyword] = useState("");
const [aiPreview, setAiPreview] = useState("");
const [aiState, setAiState] = useState<"idle" | "generating" | "done" | "error">("idle");
const [aiError, setAiError] = useState("");
```

- [x] **Step 3: Implement SSE parsing and preview accumulation**
```tsx
async function generateWithAi() {
  if (!aiKeyword.trim() || aiState === "generating") return;
  setAiPreview("");
  setAiError("");
  setAiState("generating");

  const res = await fetch("/api/admin/ai/draft/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ keyword: aiKeyword.trim() }),
  });

  if (!res.ok || !res.body) {
    setAiState("error");
    setAiError("AI 生成失败");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const raw of events) {
      const lines = raw.split("\n");
      const event = lines.find((x) => x.startsWith("event:"))?.slice(6).trim();
      const dataText = lines.find((x) => x.startsWith("data:"))?.slice(5).trim() ?? "{}";
      const data = JSON.parse(dataText) as { content?: string; message?: string };

      if (event === "delta" && data.content) setAiPreview((prev) => prev + data.content);
      if (event === "done") setAiState("done");
      if (event === "error") {
        setAiState("error");
        setAiError(data.message ?? "AI 生成失败");
      }
    }
  }

  setAiState((prev) => (prev === "generating" ? "done" : prev));
}
```

- [x] **Step 4: Add insert/discard actions without auto-overwrite**
```tsx
function insertAiDraft() {
  if (!aiPreview.trim()) return;
  setContentMarkdown((prev) => (prev.trim() ? `${prev}\n\n${aiPreview.trim()}` : aiPreview.trim()));
  setAiState("idle");
  setAiKeyword("");
  setAiPreview("");
}

function discardAiDraft() {
  setAiState("idle");
  setAiKeyword("");
  setAiPreview("");
  setAiError("");
}
```

- [x] **Step 5: Add panel markup and test ids**
```tsx
<button data-testid="article-editor-ai-entry" type="button" className="btn" onClick={() => setShowAiPanel((v) => !v)}>
  AI 创作
</button>

{showAiPanel ? (
  <div className="aiPanel" data-testid="article-editor-ai-panel">
    <input data-testid="article-editor-ai-keyword" className="input" value={aiKeyword} onChange={(e) => setAiKeyword(e.target.value)} />
    <button data-testid="article-editor-ai-generate" type="button" className="btn btnPrimary" disabled={aiState === "generating"} onClick={() => void generateWithAi()}>
      {aiState === "generating" ? "生成中…" : "开始生成"}
    </button>
    <pre data-testid="article-editor-ai-preview" className="aiPreview">{aiPreview}</pre>
    <button data-testid="article-editor-ai-insert" type="button" className="btn" onClick={insertAiDraft}>插入正文</button>
    <button data-testid="article-editor-ai-discard" type="button" className="btn" onClick={discardAiDraft}>放弃</button>
  </div>
) : null}
```

- [x] **Step 6: Add styles for panel/preview**
```css
/* src/app/admin/admin.css */
.aiPanel {
  margin: 0 16px 16px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  display: grid;
  gap: 10px;
}

.aiPreview {
  min-height: 140px;
  max-height: 300px;
  overflow: auto;
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.9);
  white-space: pre-wrap;
}
```

- [ ] **Step 7: Run focused AI draft spec**（已执行，受 admin 登录重定向问题阻塞）
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/admin-ai-draft.spec.ts --project=chromium
```
Expected: PASS.

- [ ] **Step 8: Commit editor integration**
```bash
git add src/components/admin/ArticleEditor.tsx src/app/admin/admin.css
git commit -m "feat: add ai draft preview panel in article editor"
```

### Task 4: Add Robustness Checks For Streaming Errors and Length Cap

**Files:**
- Modify: `tests/e2e/admin-ai-draft.spec.ts`
- Modify: `src/services/ai-article-agent.service.ts`
- Modify: `src/components/admin/ArticleEditor.tsx`

- [x] **Step 1: Add failing E2E for empty keyword and discard behavior**
```ts
// tests/e2e/admin-ai-draft.spec.ts
test("ai draft requires keyword and discard keeps markdown unchanged", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/articles/new");

  const before = await page.getByTestId(articleEditorSelectors.markdown).inputValue();
  await page.getByTestId(articleEditorSelectors.aiEntry).click();
  await page.getByTestId(articleEditorSelectors.aiGenerate).click();
  await expect(page.getByText("请输入关键词")).toBeVisible();

  await page.getByTestId(articleEditorSelectors.aiDiscard).click();
  const after = await page.getByTestId(articleEditorSelectors.markdown).inputValue();
  expect(after).toBe(before);
});
```

- [x] **Step 2: Enforce max length in service stream output**
```ts
// src/services/ai-article-agent.service.ts
let total = 0;
for await (const chunk of stream) {
  const text = chunk.content?.toString() ?? "";
  if (!text) continue;
  if (total >= config.writerMaxChars) break;
  const rest = config.writerMaxChars - total;
  const emit = text.slice(0, rest);
  total += emit.length;
  yield emit;
}
```

- [x] **Step 3: Add client-side empty keyword guard and clear error UX**
```tsx
if (!aiKeyword.trim()) {
  setAiState("error");
  setAiError("请输入关键词");
  return;
}
```

- [ ] **Step 4: Run full AI draft spec**（已执行，受 admin 登录重定向问题阻塞）
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/admin-ai-draft.spec.ts --project=chromium
```
Expected: PASS for insert/discard/keyword validation.

- [ ] **Step 5: Commit robustness updates**
```bash
git add tests/e2e/admin-ai-draft.spec.ts src/services/ai-article-agent.service.ts src/components/admin/ArticleEditor.tsx
git commit -m "test: harden ai draft stream and editor guards"
```

### Task 5: Docs Sync and Regression

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-19-ai-knowledge-base.md`

- [x] **Step 1: Update README with AI draft feature and env setup**
```md
### AI 创作（后台）

- 入口：文章编辑器中的“AI 创作”按钮
- 输入：关键词
- 输出：流式 Markdown 正文草稿（临时预览区）
- 操作：仅在点击“插入正文”后写入编辑区；点击“放弃”不改正文
- 必需配置：`EMBEDDING_PROVIDER`、`EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL`、`AI_WRITER_MODEL`、`AI_WRITER_MAX_CHARS`
```

- [x] **Step 2: Mark plan progress in master plan**
```md
- [x] 后台文章编辑页支持 AI 关键词创作入口
- [x] 流式返回正文草稿并展示临时预览区
- [x] 用户手动插入或放弃草稿，不自动覆盖正文
```

- [ ] **Step 3: Run regression suite**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
npm run test:e2e -- tests/e2e/admin-ai-draft.spec.ts tests/e2e/admin-publish-cache.spec.ts tests/e2e/search-and-analytics.spec.ts --project=chromium
```
Expected: PASS.

- [ ] **Step 4: Check diagnostics on touched files**
Run:
```text
GetDiagnostics for:
- src/config/ai.ts
- src/services/ai-article-agent.service.ts
- src/app/api/admin/ai/draft/stream/route.ts
- src/components/admin/ArticleEditor.tsx
- src/app/admin/admin.css
- tests/e2e/admin-ai-draft.spec.ts
- tests/e2e/support/selectors.ts
```
Expected: no new diagnostics introduced.

- [ ] **Step 5: Commit docs and plan sync**
```bash
git add README.md docs/superpowers/plans/2026-05-19-ai-knowledge-base.md docs/superpowers/plans/2026-05-20-ai-article-agent-streaming.md
git commit -m "docs: sync ai draft streaming implementation plan"
```

## Self-Check

- Coverage check:
  - AI 入口、关键词生成、流式预览、插入/放弃、长度限制均映射到明确 Task。
- Placeholder scan:
  - No `TBD`, `TODO`, `implement later`, or deferred placeholders.
- Type consistency:
  - `streamArticleDraft`, `/api/admin/ai/draft/stream`, `article-editor-ai-*` selectors are used consistently across tasks.
