# Personal Auth UI Implementation Plan
> **For AI workers:** Use `superpowers:executing-plans` to execute this plan task by task.
> Track progress with checkbox (`- [ ]`) syntax.

**Goal:** 为公开站补齐个人用户登录/注册入口，提供邮箱密码与手机号验证码两种认证方式，并在登录成功后进入个人文章页查看自己的文章状态。

**Architecture:** 在现有公开站导航中增加个人认证入口；新增一个个人认证页面承载登录/注册双模式；新增个人文章页作为登录后的落地页，直接复用现有 `/api/auth/*` 与 `/api/me/articles` 接口。

**Tech Stack:** Next.js App Router, React, TypeScript, existing public CSS, Cookie Session, existing auth APIs

---

## File Structure Mapping

- Modify: `src/app/(public)/layout.tsx`
  - 在顶部导航增加个人登录/注册入口
- Modify: `src/app/(public)/page.tsx`
  - 在首页入口区域增加个人认证入口
- Create: `src/app/(public)/auth/page.tsx`
  - 个人登录/注册页
- Create: `src/app/(public)/me/articles/page.tsx`
  - 个人文章页（登录后落地页）
- Modify: `src/app/(public)/public.css`
  - 复用并扩展公开站样式，支持认证页与个人文章页布局

## Task 1: Entry Wiring

**Files:**
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/app/(public)/page.tsx`

- [x] **Step 1: Add top-nav personal auth entry**
- [x] **Step 2: Add home-page auth CTA**
- [x] **Step 3: Keep existing public/admin entry layout consistent**

## Task 2: Personal Auth Page

**Files:**
- Create: `src/app/(public)/auth/page.tsx`
- Modify: `src/app/(public)/public.css`

- [x] **Step 1: Build password auth mode**
  - register by `email + password`
  - login by `identifier + password`
- [x] **Step 2: Build phone OTP auth mode**
  - request OTP with `REGISTER` / `LOGIN`
  - submit `phone + code`
- [x] **Step 3: Surface success/error/loading states**
- [x] **Step 4: Redirect authenticated personal users to `/me/articles`**

## Task 3: Personal Articles Landing Page

**Files:**
- Create: `src/app/(public)/me/articles/page.tsx`
- Modify: `src/app/(public)/public.css`

- [x] **Step 1: Require PERSONAL session at page level**
- [x] **Step 2: Render current user's article list**
- [x] **Step 3: Show empty-state and status badges**
- [x] **Step 4: Provide return navigation to public site**

## Task 4: Validation

**Files:**
- Modify: `src/app/(public)/layout.tsx`
- Modify: `src/app/(public)/page.tsx`
- Create: `src/app/(public)/auth/page.tsx`
- Create: `src/app/(public)/me/articles/page.tsx`
- Modify: `src/app/(public)/public.css`

- [x] **Step 1: Run typecheck**
```bash
npm run typecheck
```
- [x] **Step 2: Manually smoke key flows**
  - public home can see auth entry
  - personal register/login can submit
  - success lands on `/me/articles`
