# Article Comments Public UI Implementation Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** Show comments on public article detail pages, allow guest and logged-in comment submission, and hide the input when the article is closed for comments.

**Architecture:** Reuse the public article detail page and add a dedicated comment section component that renders the list, form, and empty states. The page consumes the comment service contract from the data-domain plan and keeps comment UI logic separate from article content rendering.

**Tech Stack:** Next.js App Router, React, TypeScript, existing article service, existing auth session helpers, existing global styles.

---

### Task 1: Add public comment section component

**Files:**
- Create: `src/components/home/ArticleCommentSection.tsx`
- Modify: `src/app/(public)/articles/[slug]/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write a failing render test or static usage expectation**

```tsx
// ArticleCommentSection should render:
// - comment list
// - empty state "暂无评论"
// - hidden input when commentStatus === "CLOSED"
```

- [ ] **Step 2: Run typecheck to confirm the component import is unresolved**

Run: `npm run typecheck`
Expected: FAIL — component and props are not yet implemented.

- [ ] **Step 3: Write minimal component structure**

```tsx
export function ArticleCommentSection(props: {
  articleId: string;
  commentStatus: "OPEN" | "CLOSED";
  initialComments: CommentView[];
}) {
  return null;
}
```

- [ ] **Step 4: Run typecheck to confirm the component compiles**

Run: `npm run typecheck`
Expected: PASS after the page consumes the component.

- [ ] **Step 5: Commit the public UI shell**

```bash
git add src/components/home/ArticleCommentSection.tsx src/app/(public)/articles/[slug]/page.tsx src/app/globals.css
git commit -m "feat(comments): add public comment section shell"
```

### Task 2: Wire public comment loading and submission states

**Files:**
- Modify: `src/components/home/ArticleCommentSection.tsx`
- Modify: `src/app/(public)/articles/[slug]/page.tsx`
- Test: `tests/e2e/public-article-comments.spec.ts`

- [ ] **Step 1: Write failing E2E expectations**

```typescript
test('guest can comment and logged-in user sees their name', async ({ page }) => {
  await page.goto('/articles/example');
  await expect(page.getByText('暂无评论')).toBeVisible();
});
```

- [ ] **Step 2: Run the focused E2E spec to confirm failure**

Run: `npm run test:e2e -- tests/e2e/public-article-comments.spec.ts`
Expected: FAIL — comment section interactions are not wired yet.

- [ ] **Step 3: Implement the public state wiring**

```tsx
// render guest label as "游客"
// render account name for logged-in users
// hide input when status is CLOSED
```

- [ ] **Step 4: Re-run the focused E2E spec**

Run: `npm run test:e2e -- tests/e2e/public-article-comments.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit the behavior wiring**

```bash
git add src/components/home/ArticleCommentSection.tsx src/app/(public)/articles/[slug]/page.tsx tests/e2e/public-article-comments.spec.ts
git commit -m "feat(comments): wire public comment behavior"
```

### Task 3: Validate empty and closed states

**Files:**
- Modify: `tests/e2e/public-article-comments.spec.ts`

- [ ] **Step 1: Add the closed-state assertions**

```typescript
await expect(page.getByText('暂无评论')).toBeVisible();
await expect(page.getByTestId('comment-input')).toBeHidden();
```

- [ ] **Step 2: Run the focused E2E spec**

Run: `npm run test:e2e -- tests/e2e/public-article-comments.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit the public regression coverage**

```bash
git add tests/e2e/public-article-comments.spec.ts
git commit -m "test(comments): cover public empty and closed states"
```
