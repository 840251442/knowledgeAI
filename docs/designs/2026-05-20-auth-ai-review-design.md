# Auth And AI Review Publish Design

**Problem:** 需要支持管理员与个人用户分级登录，并实现个人文章发布时由 AI 先审、拒绝后转人工管理员审核。
**Solution:** 引入统一用户体系（ADMIN/PERSONAL）与发布审核状态机，个人文章提交发布时先走 AI 合规审核，AI 拒绝或异常一律转人工审核，管理员拥有全量文章可见与最终发布权限。
**Out of scope:** 第三方 OAuth 登录、复杂内容质量评分体系、多级组织权限、申诉流程自动化。

## Technical Approach

### Option A: MVP (recommended now)
- 核心思路：在当前 Cookie Session 体系上扩展用户角色和文章审核状态，不引入额外身份系统。
- 发布链路：PERSONAL 点击“提交发布” -> AI 审核合规 -> 通过则直接 PUBLISHED；拒绝/异常则进入人工队列待管理员处理。
- 优点：改动集中、上线快、和现有架构一致。
- 缺点：登录能力主要是账号密码，手机号登录是验证码方案（无密码）而不是全功能身份平台。
- 适用：当前单项目快速迭代，优先落地功能。

### Option B: Complete
- 核心思路：引入独立审核中心（review service + queue），AI 审核、人工审核、审计日志都事件化。
- 优点：流程清晰、可扩展多模型与策略，审计能力强。
- 缺点：复杂度和成本明显提高。
- 适用：内容规模大、审核 SLA 严格、后续要多租户。

### Option C: Off-the-shelf
- 核心思路：认证使用 Auth.js（Credentials + Phone OTP provider），审核接第三方内容风控 API。
- 优点：省认证细节，安全基线更成熟。
- 缺点：需要迁移现有会话逻辑，外部服务绑定度高。
- 适用：团队希望减少认证自研。

### Chosen Direction
选择 Option A（MVP）作为第一阶段：
- 和现有 `session.ts`、`/api/admin/*` 风格一致；
- 能覆盖你要求的管理员可见全部文章、个人发文需审核、AI 拒绝转人工；
- 后续可平滑升级到 Option B。

## Interface / Data Structures

### Role and Account Model
- `User`
  - `id`
  - `email` (nullable, unique)
  - `phone` (nullable, unique)
  - `passwordHash` (nullable)
  - `role` enum: `ADMIN | PERSONAL`
  - `isActive`
  - `createdAt/updatedAt`
- 兼容策略：
  - 保留现有 `AdminUser` 读取路径，逐步迁移到统一 `User`，或新增 `PersonalUser` 并在会话层统一 `AuthPrincipal`。

### Article and Review Status
- `ArticleStatus` 扩展：
  - `DRAFT`
  - `PENDING_REVIEW`
  - `PUBLISHED`
  - `REJECTED`
  - `ARCHIVED`
- `ReviewDecision`:
  - `APPROVED`
  - `REJECTED`
  - `MANUAL_REQUIRED`

### Review Records
- `ArticleReview`
  - `id`
  - `articleId`
  - `reviewType` enum: `AI | HUMAN`
  - `decision` enum: `APPROVED | REJECTED | MANUAL_REQUIRED`
  - `reason` (text)
  - `riskTags` (json)
  - `reviewedByUserId` (nullable, human only)
  - `modelName` (nullable, AI only)
  - `createdAt`

### API Surface (MVP)
- Auth
  - `POST /api/auth/register`
    - 支持 `email+password` 或 `phone+otp` 注册
  - `POST /api/auth/login/password`
  - `POST /api/auth/login/phone`
  - `POST /api/auth/logout`
- Personal Article
  - `POST /api/me/articles` (创建草稿)
  - `PUT /api/me/articles/:id` (更新草稿)
  - `POST /api/me/articles/:id/submit` (提交审核)
  - `GET /api/me/articles` (仅本人)
- Admin Review
  - `GET /api/admin/reviews` (人工待审队列)
  - `POST /api/admin/reviews/:articleId/approve`
  - `POST /api/admin/reviews/:articleId/reject`
  - `GET /api/admin/articles` (全部文章)

### Permission Rules
- ADMIN
  - 可查看所有文章；可人工通过/拒绝；可直接发布。
- PERSONAL
  - 仅可查看与编辑自己文章；不可直接把文章状态改为 `PUBLISHED`。

## Publish Workflow

1. PERSONAL 在编辑器点击“提交发布”。
2. 服务端将文章置为 `PENDING_REVIEW`，写入审核任务。
3. 触发 AI 合规审核（同步短超时 + 异步重试）。
4. AI 返回：
   - `APPROVED` -> 文章 `PUBLISHED`，记录 AI 审核结果。
   - `REJECTED` -> 文章保持 `PENDING_REVIEW`，创建人工待审记录。
   - 异常/超时 -> 文章保持 `PENDING_REVIEW`，创建人工待审记录（fail-safe）。
5. 管理员在审核台处理：
   - 通过 -> `PUBLISHED`
   - 拒绝 -> `REJECTED`（可附原因）。

## Security Design (Password and Transport)

- 传输层
  - 强制 HTTPS（生产环境）；禁止明文 HTTP。
  - 密码不做前端“自定义加密传输”作为替代，避免伪安全；TLS 即传输保密基础。
- 存储层
  - 服务端只保存 `passwordHash`（建议 Argon2id 或 bcrypt，含盐）。
  - 登录接口做速率限制和失败锁定（IP + account 维度）。
- 会话层
  - 继续使用 HttpOnly + SameSite cookie。
  - 为不同角色附带 `role` claim，服务端鉴权中间件统一校验。
- 手机号登录
  - OTP 验证码短时有效（例如 5 分钟），次数限制。
  - OTP 验证通过后建立同等会话。

## Edge Cases

- AI 审核超时/模型不可用：自动转人工，不阻断用户提交。
- AI 返回不确定结论：标记 `MANUAL_REQUIRED`，进入人工队列。
- 并发提交：同一文章只允许一个进行中的审核任务（幂等锁）。
- 用户在待审期间修改文章：新版本需重新提交审核，旧审核结果作废。
- 管理员误操作发布：保留审核日志与手动下线能力。
- 手机号重复注册：统一提示并引导登录，避免暴露账户存在性。

## Acceptance Criteria
- [ ] 支持 `ADMIN` 与 `PERSONAL` 两类登录会话。
- [ ] 管理员能查看所有文章，个人仅查看自己的文章。
- [ ] 个人点击“提交发布”后，不能直接变更到 `PUBLISHED`。
- [ ] AI 合规审核通过时自动发布。
- [ ] AI 拒绝或异常时自动转人工审核队列。
- [ ] 管理员可在人工审核台进行通过/拒绝。
- [ ] 审核日志可追溯（至少包含决策、原因、时间、执行者/模型）。
- [ ] 密码仅以哈希形式存储，登录与注册在 HTTPS 下工作。
- [ ] 登录接口具备基础限流与失败保护。

## Incremental Rollout

### Phase 1
- 账号密码注册登录 + 角色鉴权 + 文章状态机 + AI 审核 + 人工审核台。

### Phase 2
- 手机 OTP 登录与注册、审核规则可配置化、更多风控标签。

### Phase 3
- 审核中心事件化（消息队列）、策略灰度、模型 A/B。
