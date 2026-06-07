# 评论管理后台进度

## 目标
- [ ] 增加管理员评论管理页面，支持按文章筛选、分页与删除，并补齐最小 E2E 覆盖。

## 当前阶段
- [ ] 验证

## 已完成
- [x] 同步评论域前置提交到独立 worktree。
- [x] 增加后台菜单“评论管理”入口（管理员可见）。
- [x] 新建评论管理页面与客户端表格组件。
- [x] 新增后台评论筛选、分页与删除交互。
- [x] 新增后台评论管理 E2E 用例（筛选与删除）。

## 进行中
- [ ] 执行质量检查与 E2E 验证（依赖本地工具）。

## 阻塞项
- [ ] 无。

## 下一步
- [ ] 安装依赖后重新运行 `npm run lint`。
- [ ] 启动 E2E 依赖后运行 `npm run test:e2e -- tests/e2e/admin-comments.spec.ts`。
- [ ] 更新验证证据并准备提交。

## 验证证据
- `npm run lint` 失败：`sh: eslint: command not found`。
- `npm run test:e2e -- tests/e2e/admin-comments.spec.ts` 失败：`sh: playwright: command not found`。
