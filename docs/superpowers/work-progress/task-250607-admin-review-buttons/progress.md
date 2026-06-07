# 后台待审核文章审核按钮

## 目标

为后台 `/admin/reviews` 列表补充人工审核按钮，支持管理员对待审核文章执行通过 / 驳回操作，并在操作后刷新列表。

## 当前阶段

实现完成，正在进行提交前归档与记录同步。

## 已完成项

- 新增行内审核操作组件 `AdminReviewActions`。
- 在 `/admin/reviews` 页面增加操作列，并补充稳定 `data-testid`。
- 新增 E2E 用例，覆盖审核列表按钮可见性。
- 完成 `npm run typecheck` 验证。
- 完成 `npm run lint` 验证。
- 完成 `npm run test:e2e -- tests/e2e/admin-comments.spec.ts --grep "review"` 验证。

## 进行中

- 归档本次行为变更记录并提交到当前子分支。

## 阻塞项

- 无。

## 下一步

- 生成 commit，记录 commit hash，并推送到远端子分支。

## 验证证据

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run test:e2e -- tests/e2e/admin-comments.spec.ts --grep "review"`：通过，1 个用例通过。