# Article Comments Admin Management Implementation Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** Add an admin-only comment management page with article filtering and deletion controls, and expose it from the admin navigation.

**Architecture:** Reuse the admin layout and route structure, add a dedicated comment management page, and keep all admin comment operations behind the existing admin session checks. The page consumes the admin comment service contract and remains separate from article editing to avoid coupling moderation with content editing.

**Tech Stack:** Next.js App Router, React, TypeScript, existing admin layout, existing Ant Design button patterns, existing admin CSS.

---

### Task 1: Add admin comment navigation and page shell

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Create: `src/app/admin/comments/page.tsx`
- Modify: `src/app/admin/admin.css`

- [ ] **Step 1: Write a failing navigation/page expectation**

```tsx
// admin layout should expose a "评论管理" entry for ADMIN only
```

- [ ] **Step 2: Run typecheck to confirm the route is missing**

Run: `npm run typecheck`
Expected: FAIL — admin comments page and navigation are not wired yet.

- [ ] **Step 3: Write the minimal admin page shell**

```tsx
export default async function AdminCommentsPage() {
  return <main />;
}
```

- [ ] **Step 4: Run typecheck to confirm the shell compiles**

Run: `npm run typecheck`
Expected: PASS after navigation and page shell are added.

- [ ] **Step 5: Commit the admin entry point**

```bash
git add src/app/admin/layout.tsx src/app/admin/comments/page.tsx src/app/admin/admin.css
git commit -m "feat(comments): add admin comments entry point"
```

### Task 2: Build admin filtering and delete actions

**Files:**
- Create: `src/components/admin/AdminCommentTable.tsx`
- Modify: `src/app/admin/comments/page.tsx`
- Create: `tests/e2e/admin-comments.spec.ts`

- [ ] **Step 1: Write failing filtering and delete expectations**

```typescript
test('admin can filter comments by article and delete one', async ({ page }) => {
  await page.goto('/admin/comments');
  await expect(page.getByText('评论管理')).toBeVisible();
});
```

- [ ] **Step 2: Run the focused E2E spec to confirm failure**

Run: `npm run test:e2e -- tests/e2e/admin-comments.spec.ts`
Expected: FAIL — table, filter, and delete actions are not wired yet.

- [ ] **Step 3: Implement the admin table and filter UI**

```tsx
// filter by article
// list comments
// expose delete button only for ADMIN
```

- [ ] **Step 4: Re-run the focused E2E spec**

Run: `npm run test:e2e -- tests/e2e/admin-comments.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit the admin moderation workflow**

```bash
git add src/components/admin/AdminCommentTable.tsx src/app/admin/comments/page.tsx tests/e2e/admin-comments.spec.ts
git commit -m "feat(comments): add admin moderation workflow"
```

### Task 3: Validate admin-only access and menu visibility

**Files:**
- Modify: `tests/e2e/admin-comments.spec.ts`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Add role-gated visibility assertions**

```typescript
await expect(page.getByText('评论管理')).toBeVisible();
```

- [ ] **Step 2: Run the focused E2E spec**

Run: `npm run test:e2e -- tests/e2e/admin-comments.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit the access control coverage**

```bash
git add src/app/admin/layout.tsx tests/e2e/admin-comments.spec.ts
git commit -m "test(comments): cover admin-only access"
```
