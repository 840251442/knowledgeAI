# 2026-05-22 Admin Role Menu and Token Session Implementation Plan

关联设计文档：[docs/designs/2026-05-22-admin-role-menu-token-session-design.md](docs/designs/2026-05-22-admin-role-menu-token-session-design.md)

## 目标
- 登录页仅显示登录卡片，不显示后台左侧菜单。
- 未登录时后台菜单不可见。
- 普通账号仅显示文章管理、退出；管理员显示全部菜单。
- 普通账号仅能看到和操作自己的文章，管理员可见全部。
- 采用 accessToken + refreshToken 会话机制：
  - accessToken 存 localStorage。
  - refreshToken 存 HttpOnly Cookie，30 天过期。

## 范围
- 包含：认证接口改造、客户端鉴权状态、菜单按角色渲染、接口权限兜底、E2E 回归。
- 不包含：OAuth、多设备会话管理、refresh token 撤销黑名单、权限模型重构。

## 实施步骤

### Phase 1 - 认证模型改造（Token 双通道）
- [x] 抽象 token 生成与校验工具（accessToken / refreshToken）。
- [x] 登录接口返回 accessToken 并写 refreshToken Cookie。
- [x] 注册接口返回 accessToken 并写 refreshToken Cookie。
- [x] 新增刷新接口：基于 refreshToken 刷新 accessToken。
- [x] 登出接口：清 refreshToken Cookie，并定义前端清理 accessToken 行为（前端执行动作在 Phase 2 鉴权状态中统一实现）。

完成判定：登录后客户端可拿到 accessToken；refresh 接口可续期；登出可清理会话。

### Phase 2 - 前端鉴权状态与请求拦截
- [x] 建立统一 auth 客户端状态（token、role、过期时间）。
- [x] accessToken 写入 localStorage 并在初始化时恢复。
- [x] 请求层增加 Authorization Bearer 注入。
- [x] 接近过期或 401 时自动调用 refresh，再重放请求一次。
- [x] refresh 失败时清理会话并跳转登录页。

完成判定：用户长会话下可自动续期，过期时可自动回退登录。

### Phase 3 - 菜单与页面可见性按角色控制
- [x] 登录页隐藏后台侧栏，仅显示登录卡片。
- [x] 未登录状态隐藏后台菜单。
- [x] 普通账号菜单固定为文章管理、退出。
- [x] 管理员菜单显示全部（文章、分类、标签、日志、退出）。
- [x] 普通账号隐藏返回公开站入口。

完成判定：不同登录状态与角色下，菜单显示与需求严格一致。

### Phase 4 - 数据权限与接口权限兜底
- [x] 文章列表接口按角色范围返回（PERSONAL 仅本人、ADMIN 全部）。
- [x] 文章编辑/发布/下线接口按角色+归属校验。
- [x] 审核接口仅 ADMIN 可用，PERSONAL 返回 403。
- [x] 页面层对 403 做友好提示或跳转。

完成判定：即使用户手动构造 URL/请求，也无法越权访问或操作。

### Phase 5 - 测试与回归
- [x] 更新 E2E：登录页仅卡片显示（无侧栏菜单）。
- [x] 更新 E2E：普通账号仅 2 个菜单项。
- [x] 更新 E2E：管理员可见全部菜单。
- [x] 更新 E2E：普通账号仅可见本人文章。
- [x] 更新 E2E：普通账号访问审核接口返回 403。
- [x] 更新 E2E：accessToken 过期触发 refresh 成功续期（可通过 mock 时间或短 TTL）。
- [x] 执行 typecheck、lint 与关键 E2E 组合回归。

完成判定：关键场景全通过，无新增类型或 lint 问题。

## 增量同步记录
- [x] 2026-05-22：优化后台文章管理空列表态，避免大面积空白区域，增加空态卡片与“去新建文章”主引导按钮。
  - 页面改动：[src/app/admin/articles/page.tsx](src/app/admin/articles/page.tsx)
  - 样式改动：[src/app/admin/admin.css](src/app/admin/admin.css)
- [x] 2026-05-22：修复新建文章页首屏样式抖动。原因是后台角色信息在客户端挂载后才恢复，导致侧栏结构二次切换；改为首屏侧栏骨架占位，待角色恢复后无缝替换菜单。
  - 布局改动：[src/app/admin/layout.tsx](src/app/admin/layout.tsx)
  - 样式改动：[src/app/admin/admin.css](src/app/admin/admin.css)
- [x] 2026-05-22：后台新增文章详情页，文章列表“查看”改为进入后台详情，不再跳转前台公开页。
  - 列表改动：[src/app/admin/articles/page.tsx](src/app/admin/articles/page.tsx)
  - 新增页面：[src/app/admin/articles/[id]/page.tsx](src/app/admin/articles/[id]/page.tsx)
- [x] 2026-05-22：后台登录页增加已登录自动跳转逻辑（本地 accessToken 有效或 refresh 成功时直接进入文章管理）。
  - 页面改动：[src/app/admin/login/page.tsx](src/app/admin/login/page.tsx)
- [x] 2026-05-22：后台路由新增统一加载过渡骨架，页面切换时使用一致的进度条 + 骨架屏，减少跳转突兀感。
  - 新增页面级 loading：[src/app/admin/loading.tsx](src/app/admin/loading.tsx)
  - 新增可复用组件：[src/components/admin/AdminRouteLoading.tsx](src/components/admin/AdminRouteLoading.tsx)
  - 样式改动：[src/app/admin/admin.css](src/app/admin/admin.css)
- [x] 2026-05-22：文章管理列表区改为“默认撑满剩余高度，超出内部滚动”，避免下半区空置与整体滚动突兀。
  - 页面改动：[src/app/admin/articles/page.tsx](src/app/admin/articles/page.tsx)
  - 样式改动：[src/app/admin/admin.css](src/app/admin/admin.css)
- [x] 2026-05-22：后台面板高度策略调整为固定高度 `calc(100dvh - 24px)`，统一容器高度表现。
  - 样式改动：[src/app/admin/admin.css](src/app/admin/admin.css)

## 风险与应对
- 风险：accessToken 存 localStorage 存在 XSS 风险。
  - 应对：保持 refreshToken 为 HttpOnly；严格输入输出转义与 CSP；缩短 accessToken TTL。
- 风险：刷新逻辑导致循环重试。
  - 应对：请求重放最多一次，失败直接清会话并跳登录。
- 风险：角色菜单与服务端权限不一致。
  - 应对：服务端权限为最终边界；前端仅作展示控制。

## 验收清单
- [x] 登录页无侧栏，仅登录卡片。
- [x] 普通账号仅显示文章管理、退出。
- [x] 管理员显示全部菜单。
- [x] 普通账号只能查看和操作自己的文章。
- [x] 审核接口对普通账号返回 403。
- [x] accessToken 在 localStorage，refreshToken 在 HttpOnly Cookie（30 天）。
- [x] 自动 refresh 生效，失败可回退登录。
- [x] typecheck、lint、关键 E2E 通过。
