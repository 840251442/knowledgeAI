# Search UI Completion Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Complete workflow I by extracting the public search page into reusable components and adding predictable keyword highlighting without changing the existing search API contract.
**Architecture:** Keep `searchArticles()` and `/api/search` unchanged, move UI rendering out of `src/app/(public)/search/page.tsx`, and implement highlighting entirely in presentation helpers/components. Preserve existing `data-testid` values and extend them only where focused E2E coverage needs new hooks.
**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Playwright
---

## File Structure Mapping

- Create: `src/components/search/highlight.tsx`
  - Pure presentation helper for rendering safe keyword highlights without `dangerouslySetInnerHTML`
- Create: `src/components/search/SearchBox.tsx`
  - Search form with existing `GET /search` submission behavior
- Create: `src/components/search/SearchFilters.tsx`
  - Static search context card for query type and result count
- Create: `src/components/search/SearchResultCard.tsx`
  - Single result renderer with title, excerpt, metadata, and highlight output
- Create: `src/components/search/SearchResults.tsx`
  - Handles empty, error, no-result, and result-list states
- Modify: `src/app/(public)/search/page.tsx`
  - Reduce to server-side data fetch + layout composition
- Modify: `tests/e2e/support/selectors.ts`
  - Add selectors for excerpt and highlight assertions
- Modify: `tests/e2e/search-and-analytics.spec.ts`
  - Add regression coverage for highlighted keyword rendering
- Modify: `README.md`
  - Sync component split and highlight behavior
- Modify: `docs/superpowers/plans/2026-05-19-ai-knowledge-base.md`
  - Mark workflow I items completed to match implementation

### Task 1: Lock Highlighting Behavior With E2E Coverage
**Files:**
- Modify: `tests/e2e/support/selectors.ts`
- Modify: `tests/e2e/search-and-analytics.spec.ts`
- Create: `src/components/search/highlight.tsx`

- [x] **Step 1: Write the failing E2E expectation for highlight output**
```ts
// tests/e2e/support/selectors.ts
export const searchSelectors = {
  form: "search-page-form",
  input: "search-page-input",
  resultCard: "search-result-card",
  resultTitle: "search-result-title",
  resultExcerpt: "search-result-excerpt",
  highlight: "search-highlight",
  logsPanel: "search-logs-panel",
  logRow: "search-log-row",
  logQuery: "search-log-query",
} as const;
```

```ts
// tests/e2e/search-and-analytics.spec.ts
test("keyword search highlights matched terms in title and excerpt", async ({ page }) => {
  await page.goto("/search?q=Redis");

  await expect(page.getByTestId(searchSelectors.resultTitle).first()).toContainText("Redis");
  await expect(
    page.getByTestId(searchSelectors.resultTitle).first().getByTestId(searchSelectors.highlight),
  ).toContainText("Redis");
  await expect(
    page.getByTestId(searchSelectors.resultExcerpt).first().getByTestId(searchSelectors.highlight),
  ).toContainText("Redis");
});
```

- [x] **Step 2: Run the focused search spec to verify it fails**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/search-and-analytics.spec.ts --project=chromium
```
Expected: FAIL because `search-result-excerpt` and `search-highlight` do not exist yet.

- [x] **Step 3: Add the minimal safe highlight helper**
```tsx
// src/components/search/highlight.tsx
import { Fragment } from "react";

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractHighlightTerms(query: string) {
  const terms = query
    .toLowerCase()
    .split(/[\s,.;:!?/\\()[\]{}"-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  return Array.from(new Set(terms));
}

export function HighlightedText(props: {
  text: string;
  query: string;
  testId?: string;
}) {
  const terms = extractHighlightTerms(props.query);
  if (!props.text || terms.length === 0) return <>{props.text}</>;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = props.text.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const matched = terms.some((term) => term === part.toLowerCase());
        if (!matched) return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
        return (
          <mark key={`${part}-${index}`} data-testid={props.testId}>
            {part}
          </mark>
        );
      })}
    </>
  );
}
```

- [x] **Step 4: Re-run the focused search spec**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/search-and-analytics.spec.ts --project=chromium
```
Expected: Still FAIL, but now only because the search page has not been wired to use `HighlightedText`.

- [ ] **Step 5: Commit**
```bash
git add tests/e2e/support/selectors.ts tests/e2e/search-and-analytics.spec.ts src/components/search/highlight.tsx
git commit -m "test: lock search highlight behavior"
```

### Task 2: Extract Search Components And Wire Highlight Rendering
**Files:**
- Create: `src/components/search/SearchBox.tsx`
- Create: `src/components/search/SearchFilters.tsx`
- Create: `src/components/search/SearchResultCard.tsx`
- Create: `src/components/search/SearchResults.tsx`
- Modify: `src/app/(public)/search/page.tsx`

- [x] **Step 1: Implement the search box component**
```tsx
// src/components/search/SearchBox.tsx
export default function SearchBox(props: { defaultValue: string }) {
  return (
    <form className="heroRow" action="/search" data-testid="search-page-form">
      <input
        className="input"
        name="q"
        defaultValue={props.defaultValue}
        placeholder="例如：Redis 缓存一致性怎么做？"
        data-testid="search-page-input"
      />
      <button className="btn btnPrimary" type="submit">
        搜索
      </button>
    </form>
  );
}
```

- [x] **Step 2: Implement the static filters/status card**
```tsx
// src/components/search/SearchFilters.tsx
import type { SearchQueryType } from "@/types/search";

export default function SearchFilters(props: {
  queryType: SearchQueryType;
  total: number;
  visibleCount: number;
}) {
  return (
    <div className="card">
      <h3>统计</h3>
      <p>搜索会记录关键词与混合检索结果，便于后台分析。</p>
      <div className="list">
        <div className="result">
          <div>
            <strong>搜索类型</strong>
            <div className="resultMeta">{props.queryType}</div>
          </div>
          <div className="score">v1</div>
        </div>
        <div className="result">
          <div>
            <strong>结果数量</strong>
            <div className="resultMeta">{props.total}</div>
          </div>
          <div className="score">{props.visibleCount}</div>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Implement the result card and results wrapper**
```tsx
// src/components/search/SearchResultCard.tsx
import Link from "next/link";

import { HighlightedText } from "./highlight";
import type { SearchResultItem } from "@/types/search";

export default function SearchResultCard(props: {
  item: SearchResultItem;
  query: string;
}) {
  const excerpt = props.item.excerpt ?? "（无摘要片段）";

  return (
    <div className="result" data-testid="search-result-card">
      <div>
        <strong data-testid="search-result-title">
          <HighlightedText query={props.query} testId="search-highlight" text={props.item.title} />
        </strong>
        <div
          data-testid="search-result-excerpt"
          style={{ color: "rgba(255,255,255,.72)", fontSize: 13, lineHeight: 1.4 }}
        >
          <HighlightedText query={props.query} testId="search-highlight" text={excerpt} />
        </div>
        <div className="resultMeta">
          {props.item.category.name} · 分数 {props.item.score.toFixed(2)}
        </div>
      </div>
      <Link className="score" href={`/articles/${props.item.slug}`}>
        OPEN
      </Link>
    </div>
  );
}
```

```tsx
// src/components/search/SearchResults.tsx
import type { SearchResponse } from "@/types/search";

import SearchResultCard from "./SearchResultCard";

export default function SearchResults(props: {
  query: string;
  result: SearchResponse | null;
}) {
  if (!props.query) {
    return (
      <div className="result">
        <div>
          <strong>请输入搜索词</strong>
          <div className="resultMeta">支持关键词与自然语言混合检索</div>
        </div>
        <div className="score">TIP</div>
      </div>
    );
  }

  if (!props.result) {
    return (
      <div className="result">
        <div>
          <strong>数据未就绪</strong>
          <div className="resultMeta">请先配置 DATABASE_URL 并初始化数据库</div>
        </div>
        <div className="score">DB</div>
      </div>
    );
  }

  if (props.result.items.length === 0) {
    return (
      <div className="result">
        <div>
          <strong>没有找到结果</strong>
          <div className="resultMeta">尝试换个关键词或更短的查询</div>
        </div>
        <div className="score">0</div>
      </div>
    );
  }

  return (
    <>
      {props.result.items.map((item) => (
        <SearchResultCard key={item.articleId} item={item} query={props.query} />
      ))}
    </>
  );
}
```

- [x] **Step 4: Refactor the page to compose the new components**
```tsx
// src/app/(public)/search/page.tsx
import SearchBox from "@/components/search/SearchBox";
import SearchFilters from "@/components/search/SearchFilters";
import SearchResults from "@/components/search/SearchResults";
import { searchArticles } from "@/services/search.service";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const result = q ? await searchArticles({ q, page: 1, pageSize: 20 }).catch(() => null) : null;

  return (
    <main className="panel">
      <div className="hero">
        <h1 className="heroTitle">搜索</h1>
        <p className="heroSub">输入关键词或自然语言问题，返回站内内容匹配结果。</p>
        <SearchBox defaultValue={q} />
      </div>

      <div className="twoCol">
        <div>
          <div className="list" style={{ marginTop: 0 }}>
            <SearchResults query={q} result={result} />
          </div>
        </div>
        <div>
          <SearchFilters
            queryType={result?.queryType ?? "KEYWORD"}
            total={result?.total ?? 0}
            visibleCount={result?.items.length ?? 0}
          />
        </div>
      </div>
    </main>
  );
}
```

- [x] **Step 5: Run typecheck and the focused search regression**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
npm run test:e2e -- tests/e2e/search-and-analytics.spec.ts --project=chromium
```
Expected: PASS for `typecheck` and the search spec, including the new highlight assertion.

- [ ] **Step 6: Commit**
```bash
git add src/components/search/highlight.tsx src/components/search/SearchBox.tsx src/components/search/SearchFilters.tsx src/components/search/SearchResultCard.tsx src/components/search/SearchResults.tsx src/app/'(public)'/search/page.tsx
git commit -m "feat: split search ui components"
```

### Task 3: Regress Full Search Flow And Sync Documentation
**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-19-ai-knowledge-base.md`

- [x] **Step 1: Sync the README with the new search UI structure**
```md
### 当前语义检索实现

- 搜索页组件：`src/components/search/SearchBox.tsx`、`src/components/search/SearchFilters.tsx`、`src/components/search/SearchResultCard.tsx`、`src/components/search/SearchResults.tsx`
- 高亮规则：关键词高亮只在展示层完成，不修改 `/api/search` 响应结构；`HYBRID` 自然语言命中在没有直接词命中时保留原摘要
- 回归命令：`npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts tests/e2e/search-and-analytics.spec.ts --project=chromium`
```

- [x] **Step 2: Mark workflow I items complete in the master plan**
```md
- [x] 实现 `app/(public)/search/page.tsx`
- [x] 实现 `components/search/search-box.tsx`、`search-filters.tsx`、`search-result-card.tsx`
- [x] 使用统一的结果卡片展示关键词搜索与语义搜索结果
- [x] 添加高亮片段与摘要展示
- [x] 实现后台搜索日志页面，包括热门查询、无结果查询、延迟概览
```

- [x] **Step 3: Run the final regression for search, cache, and publish flows**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts tests/e2e/search-and-analytics.spec.ts --project=chromium
```
Expected: PASS with `3 passed`.

- [x] **Step 4: Check diagnostics on touched files**
Run:
```text
GetDiagnostics for:
- src/app/(public)/search/page.tsx
- src/components/search/SearchBox.tsx
- src/components/search/SearchFilters.tsx
- src/components/search/SearchResultCard.tsx
- src/components/search/SearchResults.tsx
- src/components/search/highlight.tsx
```
Expected: no new diagnostics introduced.

- [ ] **Step 5: Commit**
```bash
git add README.md docs/superpowers/plans/2026-05-19-ai-knowledge-base.md tests/e2e/search-and-analytics.spec.ts tests/e2e/support/selectors.ts
git commit -m "docs: sync search ui completion"
```

## Self-Review

- Spec coverage:
  - Component extraction is implemented in Task 2.
  - Presentation-layer highlighting is locked by Task 1 and wired in Task 2.
  - README and master plan synchronization are covered in Task 3.
  - Search API contract preservation is enforced by only changing UI files and Playwright selectors/tests.
- Placeholder scan:
  - No `TBD`, `TODO`, or deferred instructions remain.
  - Each verification step includes an exact command and expected result.
- Type consistency:
  - The plan uses the existing `SearchResponse`, `SearchResultItem`, and `SearchQueryType` names from `src/types/search.ts`.
  - The same selector names introduced in Task 1 are referenced consistently in Task 2 and Task 3.
