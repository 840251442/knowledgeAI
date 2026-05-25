# Article Comments Public UI Implementation Plan

> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** Show comments on public article detail pages, allow submission when open, hide input when closed, and cover public comment behaviors in E2E.

---

## Task 1: Public comment section UI

- [x] Create `src/components/home/ArticleCommentSection.tsx` with list, empty, error, and form states.
- [x] Wire the component into `src/app/(public)/articles/[slug]/page.tsx` with initial comments and user context.
- [x] Add public styles for the comment section in `src/app/(public)/public.css`.

## Task 2: Public comment behaviors and E2E coverage

- [x] Add public comments E2E spec at `tests/e2e/public-article-comments.spec.ts`.
- [x] Cover empty state (open), closed state (no input), and guest/personal display names.

## Task 3: Validation and documentation sync

- [ ] Run the focused E2E spec and record results.
- [x] Update progress log and capture verification evidence.
