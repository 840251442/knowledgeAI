# Admin Role Menu and Token Session Design

**Problem:** 后台需要按登录状态和角色控制菜单与数据可见范围，同时改为 accessToken + refreshToken 的会话机制并支持 30 天续期。
**Solution:** 使用 accessToken（localStorage）+ refreshToken（HttpOnly Cookie）方案，结合角色化菜单渲染与服务端权限校验，保障普通账号仅可见/可操作本人文章，管理员可见全部。
**Out of scope:** OAuth 第三方登录、多设备会话管理、refresh token 轮换与撤销黑名单体系、前台站点导航视觉重构。

## Technical Approach

1. Session model
- accessToken:
  - 保存位置：localStorage
  - 生命周期：短期（建议 15 分钟）
  - 用途：请求 API 时放入 Authorization Bearer
- refreshToken:
  - 保存位置：HttpOnly + Secure + SameSite Cookie
  - 生命周期：30 天
  - 用途：accessToken 将过期或已过期时刷新

2. Auth endpoints
- POST /api/admin/login:
  - 校验账号密码
  - 返回 accessToken（JSON）
  - 下发 refreshToken（HttpOnly Cookie）
- POST /api/admin/register:
  - 创建普通账号（PERSONAL 角色）
  - 返回 accessToken（JSON）
  - 下发 refreshToken（HttpOnly Cookie）
- POST /api/auth/refresh:
  - 校验 refreshToken
  - 返回新 accessToken
  - 可选刷新 refreshToken 过期时间
- POST /api/auth/logout:
  - 清除 refreshToken Cookie
  - 客户端清除 localStorage 中 accessToken

3. Frontend auth flow
- 登录页仅保留登录卡片，不显示左侧菜单。
- 登录成功后将 accessToken 写入 localStorage。
- 客户端 API 请求层加拦截器：
  - accessToken 即将过期时先调用 /api/auth/refresh
  - 收到 401 时重试一次 refresh，再重放原请求
  - refresh 失败则清空本地会话并跳转登录页

4. Role-based menu visibility
- 未登录：后台菜单全部隐藏（仅显示登录卡片）。
- 普通账号（PERSONAL）：只显示“文章管理”“退出”。
- 管理员账号（ADMIN）：显示全部菜单。

5. Data access and permission enforcement
- 文章管理：
  - PERSONAL 仅能读取/编辑/发布自己的文章
  - ADMIN 可读取/编辑/发布所有文章
- 审核能力：
  - PERSONAL 不可访问审核接口（服务端返回 403）
  - ADMIN 可访问审核相关接口
- 服务端权限校验为最终边界，前端菜单仅做可见性控制。

## Interface / Data Structures

1. JWT claims
- accessToken claims:
  - sub: userId
  - role: ADMIN | PERSONAL
  - exp: 过期时间
  - iat: 签发时间
- refreshToken claims:
  - sub: userId
  - role: ADMIN | PERSONAL
  - exp: 30 天
  - iat: 签发时间
  - jti: 可选唯一标识（后续支持撤销）

2. Frontend auth state
- localStorage key:
  - auth.accessToken
  - auth.accessTokenExp（可选，便于前端预刷新）
- runtime state:
  - isAuthenticated
  - role
  - userId

3. Menu config (conceptual)
- ADMIN: [文章管理, 分类管理, 标签管理, 搜索日志, 退出]
- PERSONAL: [文章管理, 退出]
- ANONYMOUS: []

## Edge Cases

1. accessToken 过期但 refreshToken 有效
- 自动 refresh，页面无感知继续操作。

2. refreshToken 过期或无效
- 清空 accessToken，跳转登录页。

3. 普通账号手动访问管理员审核 API
- 返回 403，不暴露额外敏感信息。

4. 普通账号通过 URL 访问他人文章编辑页
- 服务端返回 403 或 404，前端展示无权限提示。

5. 登录页回退行为
- 已登录用户访问登录页时，跳转到文章管理页。

## Acceptance Criteria
- [ ] 登录页仅显示登录卡片，不显示左侧菜单。
- [ ] 未登录状态下后台菜单不可见。
- [ ] 普通账号仅显示“文章管理、退出”。
- [ ] 管理员账号显示全部后台菜单。
- [ ] 普通账号只能看到并操作自己的文章。
- [ ] 管理员账号可看到并操作所有文章。
- [ ] 审核接口对普通账号返回 403。
- [ ] accessToken 存于 localStorage 并用于 Bearer 鉴权。
- [ ] refreshToken 以 HttpOnly Cookie 保存，30 天有效。
- [ ] accessToken 过期可通过 refreshToken 自动刷新。
- [ ] typecheck/lint 和核心 E2E 回归通过。
