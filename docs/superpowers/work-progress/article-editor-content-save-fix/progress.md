# 文章编辑正文保存修复 Progress

## 目标
- 修复后台文章编辑正文保存失败问题（全量复现）。
- 采用路由层兼容历史正文入参，保持改动最小。
- 增加 1 条最小 e2e 回归，覆盖编辑页保存后再次读取最新内容。

## 当前阶段
- 阶段 4/4：验收完成，待合并。

## 已完成项
- 已确认服务层 `updateAdminArticle` 仅接收统一正文字段，无需改签名。
- 已在 `/api/admin/articles/[id]` 的 PUT 路由中兼容 `content` / `body` / `contentMarkdown`。
- 已新增 1 条 e2e 回归，改为真实后台编辑页保存并重载查看最新正文。
- 已补充全局 Node 22 执行门禁到编排入口 Prompt 与 orchestrator Agent 规则。
- 已在 Node 22 环境执行关键验证并通过。

## 进行中
- 无。

## 阻塞项
- 仓库级 `npm run lint` 仍存在与本次改动无关的历史 warning（`src/app/admin/layout.tsx` 的 `@next/next/no-html-link-for-pages`），导致 `--max-warnings 0` 门禁未过。

## 下一步
1. 输出验收结论与合并建议。
2. 选择是否在本次或后续修复仓库级 lint 历史 warning。

## 验证证据
- `node -v`（nvm use 22） -> `v22.22.3`。
- `npm run typecheck` -> 通过。
- `npx eslint src/app/api/admin/articles/[id]/route.ts tests/e2e/admin-publish-cache.spec.ts --max-warnings 0` -> 通过。
- `npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts`（Node 22） -> 2 passed。
- `npm run lint`（Node 22） -> 因 `src/app/admin/layout.tsx` 既有 warning 未通过（与本次改动无关）。
