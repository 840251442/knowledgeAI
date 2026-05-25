# Progress

## 目标
- 完成公开文章详情页评论展示、提交与删除入口，并补齐公开页评论 E2E 覆盖。

## 当前阶段
- 验证中

## 已完成项
- [x] 新增公开评论区组件与样式结构。
- [x] 公开文章详情页接入评论区与用户上下文。
- [x] 补齐公开评论 E2E 用例（空态、关闭态、身份展示）。

## 进行中
- 处理 Playwright 未安装导致的验证失败。

## 阻塞项
- `playwright` CLI 未安装（缺少 node_modules）。

## 下一步
- 安装依赖后重试 `npm run test:e2e -- tests/e2e/public-article-comments.spec.ts`。
- 如有需要，补充 README 更新说明。

## 验证证据
- 命令：`npm run test:e2e -- tests/e2e/public-article-comments.spec.ts`
- 结果：失败，`playwright` CLI 未找到（缺少 node_modules）。

## 变更文件
- src/app/(public)/articles/[slug]/page.tsx
- src/components/home/ArticleCommentSection.tsx
- src/app/(public)/public.css
- tests/e2e/public-article-comments.spec.ts
- docs/superpowers/work-progress/comments-public-ui-20260524/progress.md
