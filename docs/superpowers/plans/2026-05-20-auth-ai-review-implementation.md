# Auth + AI Review Implementation Plan
> **For AI workers:** Use `superpowers:executing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 支持管理员与个人用户双角色登录；个人文章提交发布时先经 AI 合规审核，AI 拒绝或异常自动转人工审核，管理员可审核并最终发布。

**Architecture:** 在现有 Next.js + Prisma 体系中新增统一用户与审核状态机，发布链路改为 `DRAFT -> PENDING_REVIEW -> (AI APPROVED => PUBLISHED | AI REJECTED/ERROR => HUMAN REVIEW)`。

**Tech Stack:** Next.js App Router, TypeScript, Prisma, MySQL, Cookie Session, Playwright, AI Moderation Provider
x
---

## Scope Check

该需求聚焦同一业务主线（认证分角色 + 发布审核状态机 + AI 合规审核 + 人工审核兜底），建议保持单一计划执行。

## File Structure Mapping

- Modify: `prisma/schema.prisma`
  - 新增个人用户模型与审核记录模型；扩展文章状态
- Create: `prisma/migrations/<timestamp>_auth_ai_review/migration.sql`
  - 状态枚举与新表落库
- Modify: `src/lib/auth/session.ts`
  - 会话 token 增加 `role` 与主体类型
- Create: `src/lib/auth/require-user.ts`
  - 通用登录鉴权（非 admin 专属）
- Create: `src/lib/auth/require-role.ts`
  - 角色鉴权守卫
- Create: `src/services/auth.service.ts`
  - 注册、密码登录、手机号验证码登录
- Create: `src/services/review.service.ts`
  - AI 审核决策、转人工队列、人工通过/拒绝
- Modify: `src/services/article.service.ts`
  - 增加“个人仅本人文章可见”逻辑
- Modify: `src/services/admin-article.service.ts`
  - 管理员可见全部文章；接入人工审核操作
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/password/route.ts`
- Create: `src/app/api/auth/login/phone/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/me/articles/route.ts`
- Create: `src/app/api/me/articles/[id]/route.ts`
- Create: `src/app/api/me/articles/[id]/submit/route.ts`
- Create: `src/app/api/admin/reviews/route.ts`
- Create: `src/app/api/admin/reviews/[articleId]/approve/route.ts`
- Create: `src/app/api/admin/reviews/[articleId]/reject/route.ts`
- Modify: `src/types/article.ts`
  - 扩展状态与审核字段类型
- Modify: `src/types/api.ts`
  - 扩展认证与审核响应结构
- Modify: `.env.example`
  - 增加手机号 OTP 与 AI 审核配置
- Modify: `README.md`
  - 补认证和审核流程说明
- Create: `tests/e2e/auth-role-review.spec.ts`
  - 覆盖个人提交审核、AI 拒绝转人工、管理员终审
- Modify: `tests/e2e/support/selectors.ts`
  - 登录与审核台 selector

## Task 1: Lock Behavior With Failing E2E

**Files:**
- Modify: `tests/e2e/support/selectors.ts`
- Create: `tests/e2e/auth-role-review.spec.ts`

- [x] **Step 1: Add selectors for dual-login and review queue**
- [x] **Step 2: Add failing E2E cases**
  - PERSONAL 登录后只能看到自己的文章
  - PERSONAL 点击提交发布后文章为 `PENDING_REVIEW`
  - AI 拒绝时文章进入管理员人工队列
  - ADMIN 审核通过后文章变为 `PUBLISHED`
- [x] **Step 3: Run focused spec and confirm initial FAIL**
Run:
```bash
source ~/.nvm/nvm.sh
nvm use
npm run test:e2e -- tests/e2e/auth-role-review.spec.ts --project=chromium
```
- [x] **Step 4: Commit baseline tests**
```bash
git add tests/e2e/support/selectors.ts tests/e2e/auth-role-review.spec.ts
git commit -m "test: lock dual-role auth and ai review flow"
```

## Task 2: Schema and Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_auth_ai_review/migration.sql`

- [x] **Step 1: Extend enums**
  - `UserRole`: `ADMIN | PERSONAL`
  - `ArticleStatus`: add `PENDING_REVIEW`, `REJECTED`
  - New `ReviewType`, `ReviewDecision`
- [x] **Step 2: Add models**
  - `PersonalUser` (or unified `User` per final migration strategy)
  - `ArticleReview`
  - `PhoneOtpCode` (for SMS OTP login)
- [x] **Step 3: Add indexes/constraints**
  - phone/email unique
  - `articleId + createdAt` for review timeline
  - `status + updatedAt` for review queue
- [x] **Step 4: Generate and review migration**
Run:
```bash
npx prisma migrate dev --name auth_ai_review
```
- [x] **Step 5: Commit schema migration**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add dual-role auth and review schema"
```

## Task 3: Auth APIs (Password + Phone OTP)

**Files:**
- Modify: `src/lib/auth/session.ts`
- Create: `src/lib/auth/require-user.ts`
- Create: `src/lib/auth/require-role.ts`
- Create: `src/services/auth.service.ts`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/password/route.ts`
- Create: `src/app/api/auth/login/phone/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

- [x] **Step 1: Extend session payload with role**
- [x] **Step 2: Implement register API**
  - Support `email + password` register
  - Support `phone + otp` register/login
- [x] **Step 3: Implement password login API**
  - Verify password hash
  - Set HttpOnly session cookie with role
- [x] **Step 4: Implement phone login API**
  - Verify OTP validity and rate limit
- [x] **Step 5: Add route-level guards**
  - `requireUser`
  - `requireRole(["ADMIN"])`
- [x] **Step 6: Run typecheck**
```bash
npm run typecheck
```
- [x] **Step 7: Commit auth APIs**
```bash
git add src/lib/auth src/services/auth.service.ts src/app/api/auth
git commit -m "feat: add dual-role auth with password and phone otp"
```

## Task 4: AI Review Service and Submit Workflow

**Files:**
- Create: `src/services/review.service.ts`
- Modify: `src/services/article.service.ts`
- Modify: `src/services/admin-article.service.ts`
- Create: `src/app/api/me/articles/route.ts`
- Create: `src/app/api/me/articles/[id]/route.ts`
- Create: `src/app/api/me/articles/[id]/submit/route.ts`
- Create: `src/app/api/admin/reviews/route.ts`
- Create: `src/app/api/admin/reviews/[articleId]/approve/route.ts`
- Create: `src/app/api/admin/reviews/[articleId]/reject/route.ts`

- [x] **Step 1: Implement personal article submit**
  - PERSONAL 只能操作本人文章
  - 提交后状态设为 `PENDING_REVIEW`
- [x] **Step 2: Integrate AI moderation**
  - 输入内容摘要 + 正文
  - 输出 `APPROVED | REJECTED | MANUAL_REQUIRED`
- [x] **Step 3: Apply decision policy**
  - `APPROVED` -> `PUBLISHED`
  - `REJECTED` or error -> 写 `ArticleReview` 并进入人工队列
- [x] **Step 4: Implement admin review actions**
  - approve -> `PUBLISHED`
  - reject -> `REJECTED`
- [x] **Step 5: Add idempotency guard for repeated submit**
- [x] **Step 6: Run typecheck + targeted API smoke**
```bash
npm run typecheck
```
- [x] **Step 7: Commit review workflow**
```bash
git add src/services/review.service.ts src/services/article.service.ts src/services/admin-article.service.ts src/app/api/me src/app/api/admin/reviews
git commit -m "feat: add ai-first review with manual fallback"
```

## Task 5: Security Hardening

**Files:**
- Modify: `src/services/auth.service.ts`
- Modify: `src/app/api/auth/login/password/route.ts`
- Modify: `src/app/api/auth/login/phone/route.ts`
- Modify: `.env.example`

- [x] **Step 1: Use strong password hash policy**
  - Keep compat for existing dev seed
  - New users use bcrypt/argon2 strategy
- [x] **Step 2: Add login rate limits**
  - per IP + account
- [x] **Step 3: OTP limits and expiry**
  - max attempts, TTL, resend cooldown
- [x] **Step 4: Cookie security flags audit**
  - HttpOnly, SameSite, secure in prod
- [x] **Step 5: Commit security updates**
```bash
git add src/services/auth.service.ts src/app/api/auth .env.example
git commit -m "feat: harden auth security and otp controls"
```

## Task 6: Docs and Regression

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-19-ai-knowledge-base.md`
- Modify: `docs/superpowers/plans/2026-05-20-auth-ai-review-implementation.md`

- [x] **Step 1: Update README**
  - role-based login
  - password + phone otp
  - AI review and manual fallback
- [x] **Step 2: Sync master plan progress**
- [ ] **Step 3: Run regression suite**
```bash
source ~/.nvm/nvm.sh
nvm use
npm run typecheck
npm run test:e2e -- tests/e2e/auth-role-review.spec.ts tests/e2e/admin-auth.spec.ts tests/e2e/admin-publish-cache.spec.ts --project=chromium
```
- [ ] **Step 4: Run diagnostics for touched files**
- [ ] **Step 5: Commit docs sync**
```bash
git add README.md docs/superpowers/plans/2026-05-19-ai-knowledge-base.md docs/superpowers/plans/2026-05-20-auth-ai-review-implementation.md
git commit -m "docs: sync auth and ai review rollout"
```

## Self-Check

- Coverage check:
  - 角色登录、文章可见范围、AI 审核、人工兜底、密码与 OTP 安全要求均已映射。
- Placeholder scan:
  - No `TBD`, `TODO`, `implement later`, or deferred placeholders.
- Type consistency:
  - `UserRole`, `ArticleStatus`, `ArticleReview`, `submit -> review -> publish` 全链路命名保持一致。
