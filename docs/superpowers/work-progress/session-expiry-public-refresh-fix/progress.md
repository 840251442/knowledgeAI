# 进度跟踪：session-expiry-public-refresh-fix

## 目标
- 修复前台列表从后台返回后不刷新的问题。
- 修复登录态过期后首页与自动登录反复跳转的问题。
- 过期时清理完整登录态，避免残留状态导致重复重定向。

## 当前阶段
- 阶段 5/5：收尾完成

## 已完成项
- 前台首页设置为动态渲染（force-dynamic），避免返回时命中旧缓存。
- refresh 失败时服务端主动清空 ADMIN/PERSONAL/LEGACY 的 session 与 refresh cookies。
- 客户端 refresh 失败时增加服务端注销调用，并清理本地 localStorage 会话。
- `/api/auth/logout` 与 `/api/admin/logout` 统一为“全量清理”模式，避免跨角色残留。
- 登录页自动登录策略增加保护：无本地会话或本地会话已过期时，直接停留登录页，不触发自动刷新链路。
- 新增并同步本任务计划文档。

## 进行中
- 更新 changelog 并提交。

## 阻塞项
- 无。

## 下一步
- 追加非升级变更记录。
- 提交并推送本次修复。

## 验证证据
- `npm run lint`：通过（0 errors, 0 warnings）。
- `npm run typecheck`：通过（无类型错误）。
