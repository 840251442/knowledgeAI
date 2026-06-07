# Article List And Review Button Fix Implementation Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 修复公开文章列表仅展示少量已发布文章的问题，并恢复后台待审核文章的人工审核按钮可见性。

**Architecture:** 前台通过客户端增量加载组件复用现有 `/api/articles` 分页契约，实现“首屏 + 懒加载直到完成”。后台审核页保持服务端拉取待审核队列，在行级渲染中恢复“审核通过/驳回”动作入口，并调用现有审核 API 完成状态流转。整体不改数据库 schema 与审核状态机，仅修正展示层与调用链。

**Tech Stack:** Next.js App Router, React, TypeScript, Ant Design, Playwright E2E

---

## Step 1 Scope Check
- 该需求横跨两个可独立验证子系统（公开文章浏览、后台审核操作）。
- 本计划保持“单计划双任务”执行，以便后续分发为两个独立子分支/子 Agent 并最终在目标分支集成。

## Step 2 File Structure Planning

### Public Article Infinite Loading
- Create: `src/components/home/PublicArticleInfiniteList.tsx`
- Modify: `src/app/(public)/articles/page.tsx`
- Modify: `src/types/article.ts`（若需补充分页响应类型）
- Test: `tests/e2e/public-browse.spec.ts`

### Admin Review Action Buttons
- Create: `src/components/admin/AdminReviewActions.tsx`
- Modify: `src/app/admin/reviews/page.tsx`
- Test: `tests/e2e/admin-comments.spec.ts`（如不匹配则新增专用 spec）
- Test: `tests/e2e/support/selectors.ts`

### Optional API/Contract Stabilization (only if needed)
- Modify: `src/app/api/admin/reviews/route.ts`
- Modify: `src/services/review.service.ts`
- Test: `tests/e2e/auth-role-review.spec.ts`

## Step 3 Implementation Tasks (TDD)

### Task 1: Public Articles Infinite Loading

**Files:**
- Create: `src/components/home/PublicArticleInfiniteList.tsx`
- Modify: `src/app/(public)/articles/page.tsx`
- Test: `tests/e2e/public-browse.spec.ts`

- [ ] **Step 1: Write failing E2E for lazy loading full published list**

```typescript
test("public articles page lazy-loads until all published items are reachable", async ({ page }) => {
  await page.goto("/articles?page=1");
  await expect(page.getByRole("heading", { name: "文章" })).toBeVisible();

  // 滚动触发懒加载，最终出现“已加载全部”提示。
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, 2000);
  }
  await expect(page.getByText("已加载全部")).toBeVisible();
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/public-browse.spec.ts --grep "lazy-loads until all published"`
Expected: FAIL — 当前页面无懒加载交互或无“已加载全部”标识。

- [ ] **Step 3: Implement minimal lazy-loading component**

```tsx
// src/components/home/PublicArticleInfiniteList.tsx
"use client";

export default function PublicArticleInfiniteList(props: { initialItems: ArticleListItem[]; initialPage: number }) {
  // 维护 items/nextPage/hasMore/loading/error
  // 使用 IntersectionObserver 触发下一页请求 /api/articles?page=nextPage&pageSize=12
  // 去重合并后渲染列表；hasMore=false 时渲染“已加载全部”
}
```

- [ ] **Step 4: Wire page to client list component**

```tsx
// src/app/(public)/articles/page.tsx
<PublicArticleInfiniteList
  initialItems={result.items}
  initialPage={page}
  categorySlug={categorySlug}
  tagSlug={tagSlug}
/>
```

- [ ] **Step 5: Run test to confirm pass**

Run: `npm run test:e2e -- tests/e2e/public-browse.spec.ts --grep "lazy-loads until all published"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/public-browse.spec.ts src/components/home/PublicArticleInfiniteList.tsx src/app/(public)/articles/page.tsx
git commit -m "fix: lazy-load public published article list"
```

### Task 2: Restore Admin Review Buttons

**Files:**
- Create: `src/components/admin/AdminReviewActions.tsx`
- Modify: `src/app/admin/reviews/page.tsx`
- Modify: `tests/e2e/support/selectors.ts`
- Test: `tests/e2e/admin-comments.spec.ts`（或新增 `tests/e2e/admin-reviews.spec.ts`）

- [ ] **Step 1: Write failing E2E for pending review action buttons**

```typescript
test("admin review list shows approve/reject actions for pending items", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/reviews");

  await expect(page.getByTestId("admin-review-list")).toBeVisible();
  const row = page.getByTestId("admin-review-row").first();
  await expect(row.getByTestId("admin-review-approve")).toBeVisible();
  await expect(row.getByTestId("admin-review-reject")).toBeVisible();
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npm run test:e2e -- tests/e2e/admin-comments.spec.ts --grep "shows approve/reject actions"`
Expected: FAIL — 当前审核列表无按钮 DOM。

- [ ] **Step 3: Implement review actions UI and wire to existing APIs**

```tsx
// src/components/admin/AdminReviewActions.tsx
"use client";

export function AdminReviewActions(props: { articleId: string }) {
  // 渲染通过/驳回按钮，调用
  // POST /api/admin/reviews/:articleId/approve
  // POST /api/admin/reviews/:articleId/reject
}
```

- [ ] **Step 4: Restore row testids and render action cell in admin reviews page**

```tsx
// src/app/admin/reviews/page.tsx
<div className="tableWrap adminReviewsTableWrap" data-testid="admin-review-list">
  <div className="tableRow adminReviewTableRow" data-testid="admin-review-row">
    ...
    <div className="cell">
      <AdminReviewActions articleId={item.id} />
    </div>
  </div>
</div>
```

- [ ] **Step 5: Run test to confirm pass**

Run: `npm run test:e2e -- tests/e2e/admin-comments.spec.ts --grep "shows approve/reject actions"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/support/selectors.ts tests/e2e/admin-comments.spec.ts src/components/admin/AdminReviewActions.tsx src/app/admin/reviews/page.tsx
git commit -m "fix: restore admin review action buttons"
```

### Task 3: Contract Guard For Review Queue (Conditional)

**Files:**
- Modify: `src/services/review.service.ts`
- Modify: `src/app/api/admin/reviews/route.ts`
- Test: `tests/e2e/auth-role-review.spec.ts`

- [ ] **Step 1: Add failing assertion for queue payload shape (status present)**

```typescript
expect(queueJson.success).toBeTruthy();
expect(queueJson.data?.items?.[0]).toHaveProperty("status");
```

- [ ] **Step 2: Run test to confirm failure (only if payload mismatch exists)**

Run: `npm run test:e2e -- tests/e2e/auth-role-review.spec.ts --grep "admin manual queue"`
Expected: FAIL（仅当字段缺失时）

- [ ] **Step 3: Minimal service/route mapping fix**

```typescript
return apiOk({ items, total: items.length });
// 保证 items[*].status 与 latestReview 结构稳定返回
```

- [ ] **Step 4: Run test to confirm pass**

Run: `npm run test:e2e -- tests/e2e/auth-role-review.spec.ts --grep "admin manual queue"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/review.service.ts src/app/api/admin/reviews/route.ts tests/e2e/auth-role-review.spec.ts
git commit -m "fix: stabilize admin review queue payload"
```

## Requirement Mapping
- REQ-1 前台列表可访问全部已发布文章（懒加载实现）：Task 1
- REQ-2 前台在无更多数据时有明确完成提示：Task 1
- REQ-3 后台待审核列表显示审核按钮：Task 2
- REQ-4 非待审核/无权限不显示审核按钮：Task 2
- REQ-5 关键回归测试覆盖上述修复：Task 1 + Task 2 (+ Task 3 conditional)

## Verification Bundle
- `npm run test:e2e -- tests/e2e/public-browse.spec.ts`
- `npm run test:e2e -- tests/e2e/admin-comments.spec.ts`
- `npm run test:e2e -- tests/e2e/auth-role-review.spec.ts`
- `npm run lint`
- `npm run typecheck`

## README Sync Check
- 本次改动预期仅涉及公开列表交互与后台审核按钮恢复，不新增环境变量、命令或架构能力。
- 计划执行完成后若无新操作指引，则 README 不更新；若新增用户可见交互约束，将补充对应说明。


## Orchestration Status Sync
- [x] Stage 1 输入完整性检查完成。
- [x] Stage 2 需求阶段完成并保存设计文档。
- [x] Stage 3 计划阶段完成（本文档）。
- [x] Stage 4 进度文档已创建：`docs/superpowers/work-progress/article-list-review-button-fix/progress.md`。
- [ ] Stage 5 执行阶段（待完成隔离开发准备后分发子 Agent）。
- [ ] Stage 6 验收阶段。
- [ ] Stage 7 收口阶段。

## Execution Status Sync
- [x] Task 1 前台懒加载实现已完成并合并回目标分支。
- [x] Task 2 后台审核按钮实现已完成并合并回目标分支。
- [x] Task 3 条件性契约修复未触发，不需要额外改动。
- [ ] Acceptance gate running.
