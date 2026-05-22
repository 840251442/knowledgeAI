# Admin Auth Unification Design

**Problem:** 前台与后台存在两套登录入口与交互，造成体验分裂；同时需要在统一权限体系下支持个人注册并明确高低权限边界。
**Solution:** 移除前台登录入口，统一在后台登录页提供登录/注册 Tab（当前先开放邮箱），并基于单一权限体系实现“低权限可写作与发布、不可审核”。
**Out of scope:** 手机号注册/登录回归、权限模型重构（仅做现有角色能力映射）、审核流程业务规则改版。

## Technical Approach

1. Frontend entry consolidation
- 从公开站顶栏移除登录入口按钮。
- 下线前台登录弹窗挂载链路（不再在公开布局中加载认证弹窗）。
- 前台保持匿名可访问，不再主动引导登录。

2. Admin auth page as the single entry
- 后台登录页改为登录/注册同页切换结构（不切路由，使用表单底部文案链接切换）。
- 样式沿用后台登录框视觉体系。
- 当前只开放邮箱字段（邮箱 + 密码）。
- 登录成功反馈文案与后台现有成功语义保持一致。

3. Shared auth/permission model
- 前后台使用同一套权限体系（角色分级，不分系统）。
- 默认系统账号：高权限。
- 后台页注册账号：低权限。

4. Permission enforcement
- 低权限账号可：写文章、发布文章。
- 低权限账号不可：审核文章（approve/reject）。
- 审核接口与审核页面入口仅对高权限可见/可调用。

5. Compatibility and sessions
- 保留当前会话隔离实现，避免管理员与个人会话互相覆盖。
- 不新增独立认证域，继续基于统一认证能力扩展角色判断。

## Interface / Data Structures

1. UI routes/components
- Public layout: 移除登录按钮与认证弹窗组件引用。
- Admin login page: 新增 `authMode`（`"login" | "register"`）的 Tab 状态。
- Admin login form:
  - 登录态：`email`, `password`
  - 注册态：`email`, `password`（可按需要加入确认密码，但不要求必须）

2. API expectations
- `POST /api/admin/login`
  - 输入：`email`, `password`
  - 成功：返回现有登录成功响应，设置后台会话 cookie。
- `POST /api/admin/register`（新增或复用现有注册逻辑的后台入口封装）
  - 输入：`email`, `password`
  - 行为：创建低权限账号，返回可直接登录或自动登录成功结果（实现阶段二选一）。

3. Permission checks
- 审核相关 API（如 approve/reject/list review queue）增加角色门禁校验。
- 导航菜单按角色控制展示：低权限默认不显示审核入口。

## Edge Cases

1. 邮箱已存在
- 注册返回明确错误（如“账号已存在”），不泄露额外用户信息。

2. 低权限用户访问审核 URL
- 服务端返回 403（或重定向到无权限页），前端显示“无权限”提示。

3. 已登录状态访问后台登录页
- 可直接重定向到默认允许页面（文章列表），避免重复登录。

4. 前台遗留认证链接被直接访问
- 允许返回兼容提示页或重定向到后台登录页，不再提供前台认证流程。

## Acceptance Criteria

- [ ] 公开站顶栏不再出现登录入口，且不弹出登录框。
- [ ] 后台登录页为同页登录/注册切换模式（表单底部文案切换），无路由切换。
- [ ] 当前仅开放邮箱注册/登录字段。
- [ ] 登录成功提示与后台现有成功口径一致。
- [ ] 低权限账号可新建/编辑/发布文章。
- [ ] 低权限账号无法审核文章，审核接口受服务端权限保护。
- [ ] 高权限账号可继续使用审核能力。
- [ ] 前台匿名浏览链路不受影响。
