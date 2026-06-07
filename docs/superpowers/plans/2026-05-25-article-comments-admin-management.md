# Article Comments Admin Management Implementation Plan

> **For AI workers:** Track progress with checkbox (`- [ ]`) syntax.

**Goal:** Add an admin-only comment management page with article filtering and deletion, expose it in the admin menu, and cover it with minimal E2E tests.

**Tech Stack:** Next.js App Router, React, TypeScript, existing admin layout and styles, Playwright.

---

### Task 1: Admin navigation and page shell

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Create: `src/app/admin/comments/page.tsx`
- Modify: `src/app/admin/admin.css`

- [x] Add the admin-only navigation entry for comments.
- [x] Create the admin comments page shell and server-side auth guard.
- [x] Add minimal styles for the comment table layout.

### Task 2: Comment list, filter, and delete

**Files:**
- Create: `src/components/admin/AdminCommentTable.tsx`
- Modify: `src/app/admin/comments/page.tsx`

- [x] Implement comment list rendering with pagination.
- [x] Implement article filter and list refresh.
- [x] Implement admin delete action and reload behavior.

### Task 3: E2E coverage and verification

**Files:**
- Create/Modify: `tests/e2e/admin-comments.spec.ts`
- Modify: `docs/superpowers/work-progress/comments-admin-management-20260524/progress.md`

- [x] Add admin E2E coverage for filtering and deletion.
- [x] Run quality checks and record verification evidence.
