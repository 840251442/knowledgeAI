# 搜索界面收尾设计文档

**产品：** knowledgeAI 搜索界面与结果展示
**日期：** 2026-05-20
**状态：** 待实现前确认

## 1. 目标

在不改变现有搜索 API 契约和混合检索行为的前提下，完成搜索界面的最后一轮收尾，使工作流 I 与当前实现状态一致。

本次设计聚焦以下三个目标：

- 将 `src/app/(public)/search/page.tsx` 中的搜索界面拆分为可复用的 `components/search/*`
- 为搜索结果补充稳定、可预测的关键词高亮展示
- 保持现有 E2E、缓存逻辑、搜索日志和 `HYBRID` 排序行为不变

## 2. 非目标

以下内容不在本次设计范围内：

- 不修改 `/api/search` 的请求和响应结构
- 不新增数据库字段或 Prisma migration
- 不引入新的真实筛选条件，例如分类、标签、时间范围
- 不改动关键词搜索与语义搜索的排序公式
- 不实现自然语言语义命中的强制高亮

## 3. 当前现状

当前搜索页已经具备以下能力：

- 服务端页面可直接调用 `searchArticles()`
- 页面可展示结果列表、搜索类型和结果数量
- 搜索日志会写入后台并已有后台查看页
- `HYBRID` 搜索、缓存失效和索引重建已完成并通过相关 E2E

当前仍缺少的部分：

- 搜索页 UI 仍全部内联在 `src/app/(public)/search/page.tsx`
- 计划文档中提到的 `components/search/search-box.tsx`、`search-filters.tsx`、`search-result-card.tsx` 尚未落地
- 结果摘要目前只显示纯文本，没有关键词高亮

## 4. 方案选型

### 方案 A：页面层轻量拆分并在展示层做高亮

做法：

- 保持 `search.service.ts` 输出不变
- 把页面拆成多个小组件
- 在组件内根据当前查询词对 `title` 和 `excerpt` 进行纯文本高亮

优点：

- 风险最低
- 不影响后端契约与已有缓存 key
- 对现有 E2E 影响小

缺点：

- 高亮逻辑位于展示层，前端会承担少量字符串处理

### 方案 B：在服务层直接生成高亮片段

做法：

- 由 `search.service.ts` 直接产出带高亮语义的信息或 HTML/片段数组
- 页面只负责渲染

优点：

- 前端更薄
- 后续多个终端可复用同一高亮策略

缺点：

- 需要扩展搜索返回结构
- 影响范围大，回归成本更高

### 方案 C：最小补丁，只做视觉层小改

做法：

- 仅提取极少量 JSX
- 高亮逻辑仍放在页面文件中

优点：

- 最快

缺点：

- 不能真正完成计划中的组件边界
- 后续维护收益较低

### 结论

采用 **方案 A**。

原因：

- 与用户当前“继续收尾”的诉求最匹配
- 能完成计划文档里组件化与摘要展示两项核心缺口
- 不引入新的 API 契约变化，能最大限度复用已通过的搜索回归测试

## 5. 组件设计

本次新增或重构以下组件：

### `src/components/search/SearchBox.tsx`

职责：

- 渲染搜索输入框与提交按钮
- 接收默认查询词
- 保持当前 `GET /search?q=...` 的提交方式

输入：

- `defaultValue: string`

### `src/components/search/SearchFilters.tsx`

职责：

- 承载当前搜索上下文信息
- 本期不做真实筛选请求，只作为计划中“filters”位置的轻量落地

输入：

- `queryType: "KEYWORD" | "HYBRID"`
- `total: number`

输出：

- 只渲染静态信息卡片，不触发新请求

### `src/components/search/SearchResultCard.tsx`

职责：

- 负责单条搜索结果展示
- 展示标题、摘要、高亮片段、分类、分数与跳转按钮

输入：

- `item: SearchResultItem`
- `query: string`

### `src/components/search/SearchResults.tsx`

职责：

- 统一处理空态、异常态、无结果态和结果列表
- 将页面中的条件分支从 `page.tsx` 中移出

输入：

- `query: string`
- `result: SearchResponse | null`

说明：

- 原计划没有要求该组件，但它能把页面中的状态分支与结果渲染拆开，降低 `page.tsx` 复杂度

## 6. 高亮设计

### 高亮原则

- 仅对 `title` 和 `excerpt` 进行纯文本高亮
- 仅在查询词可被拆成明确关键词时高亮
- 保留原始文本顺序，不截断现有服务层返回内容
- 不使用 `dangerouslySetInnerHTML`

### 关键词提取

沿用已有搜索词归一化思路：

- 将查询词转小写
- 按空白和常见分隔符切分
- 去除空字符串与重复项
- 忽略过短、没有展示价值的词

### 展示规则

- `title` 中命中的词使用 `<mark>` 或等价样式标出
- `excerpt` 中命中的词使用同样的高亮方式
- 如果自然语言查询没有形成有效直接词命中，则直接展示原文，不构造伪高亮

### 样式约束

- 复用现有页面视觉风格
- 高亮颜色需保证在深色背景下可读
- 不引入新的样式系统

## 7. 页面结构调整

调整后的 `src/app/(public)/search/page.tsx` 只保留：

- 读取 `searchParams`
- 调用 `searchArticles()`
- 组织主布局
- 组合 `SearchBox`、`SearchResults`、`SearchFilters`

这样页面文件只承担“取数据 + 组装”的职责，结果展示逻辑下沉到组件层。

## 8. 兼容性与风险控制

### 兼容性

- 不修改 `searchArticles()` 方法签名
- 不修改 `/api/search` 路由格式
- 不修改 Redis 搜索缓存键
- 不修改搜索日志写入逻辑

### 风险

- 高亮逻辑如果处理不当，可能破坏现有文本断言
- 组件拆分后若遗漏 `data-testid`，可能影响已有 E2E

### 控制措施

- 保留现有 `search-result-card`、`search-result-title` 等测试标识
- 高亮只包裹文本片段，不改变整体文本内容顺序
- 优先运行现有两条搜索相关 E2E 做回归

## 9. 验证计划

实施后至少完成以下验证：

- `npm run typecheck`
- `npm run test:e2e -- tests/e2e/admin-publish-cache.spec.ts tests/e2e/search-and-analytics.spec.ts --project=chromium`

如果页面结构改动较大，再补充：

- 后台搜索日志页手动检查
- 搜索页空态、无结果态和 `HYBRID` 查询展示检查

## 10. 文档同步要求

本次实现完成后，需要同步更新：

- 根 `README.md`
- `docs/superpowers/plans/2026-05-19-ai-knowledge-base.md`

同步内容至少包括：

- 搜索 UI 已拆分为独立组件
- 当前高亮片段的行为边界
- 对应验证命令
