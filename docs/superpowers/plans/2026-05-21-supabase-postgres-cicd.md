# Supabase PostgreSQL Migration + CI/CD Execution Plan
> **For AI workers:** Use `superpowers:executing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 将项目数据库从 MySQL 迁移到 Supabase PostgreSQL，并把 CI/CD 固化为“云端构建 + 全检查门禁 + 手动生产发布”的流程。

**Architecture:** 采用 Supabase 作为 PostgreSQL 托管；Prisma datasource 切换为 postgresql；GitHub Actions 负责云端构建与质量门禁；Vercel 负责应用托管与环境变量；生产发布仅允许手动 workflow_dispatch 触发。

**Tech Stack:** Next.js App Router, Prisma, Supabase PostgreSQL, GitHub Actions, Vercel, Playwright

---

## File Structure Mapping

- Modify: `prisma/schema.prisma`
  - datasource 从 mysql 切换为 postgresql
- Modify: `.env.example`
  - 将数据库示例改为 PostgreSQL 连接串
- Modify: `docs/prompts/database.md`
  - 全局数据库 prompt 改为 PostgreSQL 版本
- Add/Modify: `.github/workflows/ci.yml`
  - 云端构建 + 全检查门禁
- Add/Modify: `.github/workflows/deploy-prod.yml`
  - 手动生产发布，云端构建 + migrate deploy + 可选 seed
- Delete: `.github/workflows/e2e.yml`
  - 避免与统一 CI 重复执行
- Modify: `docs/designs/2026-05-21-supabase-postgres-cicd-design.md`
  - 记录迁移与发布策略

## Task 1: PostgreSQL Data Layer Switch

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

- [x] **Step 1: Change Prisma datasource to postgresql**
- [x] **Step 2: Keep existing schema semantics aligned with PostgreSQL**
- [x] **Step 3: Re-generate migration baseline for Supabase**
- [x] **Step 4: Validate schema and local PostgreSQL startup**

## Task 2: Database Prompt Update

**Files:**
- Modify: `docs/prompts/database.md`

- [x] **Step 1: Rewrite prompt from MySQL to PostgreSQL**
- [x] **Step 2: Preserve Prisma + migration + seed + index requirements**
- [x] **Step 3: Add PostgreSQL-specific database guidance**

## Task 3: Cloud CI Workflow

**Files:**
- Add/Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Run Prisma validate/generate in CI**
- [x] **Step 2: Run Next.js build in cloud CI**
- [x] **Step 3: Run typecheck, ESLint, unit checks, and Playwright E2E**
- [x] **Step 4: Upload Playwright artifacts on failure**

## Task 4: Manual Production Deploy Workflow

**Files:**
- Add/Modify: `.github/workflows/deploy-prod.yml`

- [x] **Step 1: Gate production deploy behind workflow_dispatch**
- [x] **Step 2: Pull Vercel project settings in cloud**
- [x] **Step 3: Run prisma migrate deploy before production deploy**
- [x] **Step 4: Support optional first-time seed initialization**
- [x] **Step 5: Deploy to Vercel production only after manual trigger**

## Task 5: Workflow De-Duplication

**Files:**
- Delete: `.github/workflows/e2e.yml`

- [x] **Step 1: Remove duplicated standalone E2E workflow**
- [x] **Step 2: Keep a single CI entry point for push and PR**

## Task 6: Verification

**Files:**
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-prod.yml`
- `docs/prompts/database.md`
- `docs/designs/2026-05-21-supabase-postgres-cicd-design.md`

- [x] **Step 1: Parse workflow YAML syntax successfully**
- [x] **Step 2: Confirm CI uses cloud build instead of local build**
- [x] **Step 3: Confirm manual production deploy path is preserved**
- [x] **Step 4: Confirm database prompt now points to PostgreSQL**

## Next Operational Steps

- [x] Create Supabase project and production database
- [x] Fill Vercel production environment variables
- [x] Add GitHub secrets for deploy workflow
- [x] Run first `prisma migrate deploy`
- [x] Optionally run `npm run db:seed` with `seed_database: true`
- [x] Execute a smoke check on login, posting, review, and search