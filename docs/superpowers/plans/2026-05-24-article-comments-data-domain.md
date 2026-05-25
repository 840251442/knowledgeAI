# Article Comments Data Domain Implementation Plan

> **For AI workers:** Use `writing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** Add the article comment data model, comment status control, and comment domain APIs that public and admin UIs can consume.

**Architecture:** Extend the Prisma schema with article comment state and a dedicated comment table, then centralize comment business rules in a new service layer. Expose thin route handlers for public comment reading/creation/deletion and admin comment listing/deletion so UI plans can reuse stable contracts.

**Tech Stack:** Next.js route handlers, Prisma, TypeScript, existing auth session helpers, existing Prisma client.

---

### Task 1: Add schema fields and generated types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/article.ts`
- Modify: `src/services/article.service.ts`

- [ ] **Step 1: Write failing typecheck expectations**

```typescript
// src/types/article.ts
export type ArticleCommentStatus = "OPEN" | "CLOSED";

// src/services/article.service.ts
// mapArticleDetail should expose commentStatus on ArticleDetail
```

- [ ] **Step 2: Run typecheck to confirm schema references fail first**

Run: `npm run typecheck`
Expected: FAIL — `commentStatus` / comment model references are missing.

- [ ] **Step 3: Write minimal schema and type additions**

```prisma
model Article {
  commentStatus ArticleCommentStatus @default(OPEN)
}

model Comment {
  id               String   @id @default(cuid())
  articleId        String
  authorType       CommentAuthorType
  personalUserId   String?
  body             String   @db.Text
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

- [ ] **Step 4: Run typecheck to confirm schema-facing types compile**

Run: `npm run typecheck`
Expected: PASS after the schema client and types are aligned.

- [ ] **Step 5: Commit the schema foundation**

```bash
git add prisma/schema.prisma src/types/article.ts src/services/article.service.ts
git commit -m "feat(comments): add article comment schema foundation"
```

### Task 2: Build comment service and route contracts

**Files:**
- Create: `src/services/comment.service.ts`
- Create: `src/app/api/articles/[slug]/comments/route.ts`
- Create: `src/app/api/comments/[id]/route.ts`
- Create: `src/app/api/admin/comments/route.ts`
- Create: `src/app/api/admin/comments/[id]/route.ts`

- [ ] **Step 1: Write failing service tests or compile assertions**

```typescript
// src/services/comment.service.ts
// listPublishedComments(slug), createComment(input), deleteComment(id, actor)
// listAdminComments(input)
```

- [ ] **Step 2: Run typecheck to confirm the new routes are unresolved**

Run: `npm run typecheck`
Expected: FAIL — new service and route symbols are not implemented yet.

- [ ] **Step 3: Write minimal comment service implementation**

```typescript
export async function createComment(input: {
  articleId: string;
  body: string;
  actor: { id: string; role: "ADMIN" | "PERSONAL" | null; displayName?: string } | null;
}) {
  // enforce OPEN status, authorType, and ownership rules
}
```

- [ ] **Step 4: Run typecheck and targeted route build checks**

Run: `npm run typecheck`
Expected: PASS after service and route handlers compile.

- [ ] **Step 5: Commit the service and API contract layer**

```bash
git add src/services/comment.service.ts src/app/api/articles/[slug]/comments/route.ts src/app/api/comments/[id]/route.ts src/app/api/admin/comments/route.ts src/app/api/admin/comments/[id]/route.ts
git commit -m "feat(comments): add comment service and api contracts"
```

### Task 3: Record verification evidence and boundary decisions

**Files:**
- Modify: `docs/superpowers/work-progress/article-comments/progress.md`

- [ ] **Step 1: Write the exact validation commands used**

```bash
npm run typecheck
```

- [ ] **Step 2: Run the documented checks after implementation**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Update progress evidence**

```markdown
- 验证证据: `npm run typecheck` PASS
```

- [ ] **Step 4: Commit verification notes**

```bash
git add docs/superpowers/work-progress/article-comments/progress.md
git commit -m "docs(comments): record data domain verification"
```
