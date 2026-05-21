# Qdrant Cloud + Vercel 向量检索接入设计文档

**产品：** knowledgeAI 语义检索层
**日期：** 2026-05-20
**状态：** 待实现前确认

## 1. 目标

把当前基于本地 mock 向量签名的语义检索方案，升级为适合 `Vercel` 部署的真实向量检索方案，同时尽量少改动已经稳定的内容管理、搜索融合、缓存和 E2E 主链路。

本次设计目标如下：

- 保留 `MySQL + Prisma` 作为主业务数据源
- 为语义检索接入真实向量存储服务
- 保持现有 `GET /api/search` 请求格式和 `SearchResultItem` 输出结构不变
- 保持 `reindex` / `backfill` / `HYBRID` 搜索整体流程不变
- 方案需适合 `Vercel` 无状态、HTTP 优先的部署模型

## 2. 选型结论

### 推荐方案

采用 **Qdrant Cloud** 作为向量数据库。

### 选择原因

- `Qdrant` 提供托管服务和 HTTP API，适合 `Vercel` 的 Serverless / Node Runtime 场景
- 不要求把当前主库从 `MySQL` 迁移到 `Postgres`
- 与当前项目已经抽象出来的 `src/lib/ai/vector-store.ts` 边界天然契合
- 现有 `ArticleChunk`、`EmbeddingTask`、`reindex.service.ts` 都可以继续复用，只替换“向量写入”和“语义召回来源”

### 不采用的方案

#### `pgvector + Neon/Supabase`

- 优点是生态成熟、SQL 查询能力强
- 但当前项目主库是 `MySQL`，接入 `pgvector` 意味着引入第二个数据库或迁移主库，超出“最省事接入”的范围

#### `Pinecone`

- 也适合 `Vercel`
- 但对当前项目而言，Qdrant 的 payload / collection 模型更贴近现有 `chunk + metadata` 设计

## 3. 当前现状

当前语义检索实现如下：

- 切块后把 `ArticleChunk` 写入 MySQL
- `embeddingVectorRef` 存储的是 `mock:` 前缀的本地签名字符串
- `vector-store.ts` 通过解析签名并做词项重叠计算来得到 `semanticScore`

这意味着当前系统已经有完整的语义检索工作流边界，但没有真实向量数据库：

- `chunking.ts` 负责切块
- `embedding.service.ts` 负责 embedding 生成
- `reindex.service.ts` 负责重建索引
- `search.service.ts` 负责关键词与语义结果融合

## 4. 设计范围

### 本次范围内

- 在 `Qdrant Cloud` 建立文章切片 collection
- 将 `embedding.service.ts` 从 mock embedding 升级为真实 embedding 生成
- 将 `vector-store.ts` 从本地 overlap score 切换为查询 `Qdrant`
- 保持 MySQL 中 `ArticleChunk` 继续作为内容切片与索引状态来源
- 保持 `search.service.ts` 的 `HYBRID` 融合结构
- 补充本地 / Vercel 所需环境变量说明

### 本次范围外

- 不迁移主库到 `Postgres`
- 不修改公开搜索 API 契约
- 不新增向量检索后台管理界面
- 不引入复杂的 rerank 模型
- 不在本轮实现多租户、命名空间隔离或跨 collection 路由

## 5. 总体架构

接入后的数据流如下：

1. 管理员发布或更新文章
2. `reindex.service.ts` 读取文章正文
3. `chunking.ts` 产出切片
4. `embedding.service.ts` 调用真实 embedding 提供方生成向量
5. 系统在 MySQL 中更新 `ArticleChunk`
6. 系统把切片向量 upsert 到 `Qdrant`
7. 搜索时，`vector-store.ts` 用查询向量向 `Qdrant` 做 top-K 检索
8. 系统把 `Qdrant` 命中结果转换为现有 `SimilarArticleHit`
9. `search.service.ts` 继续按当前权重与关键词结果融合

核心原则是：

- MySQL 是业务事实来源
- Qdrant 是语义检索索引
- 搜索 API 对前端保持透明

## 6. 数据建模

### MySQL 侧

现有 `ArticleChunk` 继续保留，职责不变：

- 存储切片内容
- 存储切片所属文章
- 存储索引状态与 embedding 模型信息
- 为重建、补偿、排障提供事实依据

`embeddingVectorRef` 字段的语义调整为：

- 不再存 `mock:` 签名
- 存储与 Qdrant point 的可追踪引用信息
- 推荐格式：`qdrant:<collection>:<pointId>`

这样即使不在 MySQL 中存真实向量，也能把业务记录和向量索引建立可追踪关系。

### Qdrant 侧

为文章切片建立单一 collection，例如：

- `knowledgeai-article-chunks`

每个 point 包含：

- `id`: 稳定 pointId，建议由 `articleId + chunkIndex` 派生
- `vector`: embedding 向量
- `payload`:
  - `articleId`
  - `slug`
  - `chunkIndex`
  - `headingPath`
  - `excerpt`
  - `categorySlug`
  - `tagSlugs`
  - `publishedAt`

payload 的作用是减少检索后额外回查次数，但不把它当成唯一事实来源。

## 7. Embedding 方案

### 推荐

使用 **OpenAI embedding API**，模型优先选：

- `text-embedding-3-small`

原因：

- HTTP API 直接可用，适合 `Vercel`
- 集成简单
- 成本相对可控
- 对当前 MVP 规模足够

### 约束

- `embedding.service.ts` 输出从 mock 签名改为真实向量生成结果
- 不在前端或浏览器侧调用 embedding
- 所有 embedding 调用只发生在服务端脚本和后台重建流程中

## 8. 索引写入策略

### 重建索引

`reindex.service.ts` 在单篇文章重建时需要执行：

1. 读取文章
2. 切块
3. 生成 embedding
4. 在 MySQL 事务中替换旧 `ArticleChunk`
5. 在 `Qdrant` 中删除该文章旧 points
6. 将新 points 批量 upsert 到 `Qdrant`
7. 成功后标记 `EmbeddingTask.SUCCESS`

### 失败处理

如果 `Qdrant` 写入失败：

- `EmbeddingTask` 标记为 `FAILED`
- 不把该次索引视为成功
- 保留错误信息用于排查

### 一致性取舍

由于 MySQL 事务无法覆盖外部向量库，采用以下策略：

- MySQL 是主记录
- Qdrant 写入失败即视为本次重建失败
- 后续通过 `reindex:all` 或单篇重建进行补偿

本次不引入分布式事务。

## 9. 检索策略

### `vector-store.ts`

当前职责保留，但实现替换为：

1. 对用户查询生成 embedding
2. 调用 `Qdrant` 搜索 top-K points
3. 读取 payload 并必要时回查 MySQL
4. 聚合同一文章的最高语义分数
5. 返回与当前 `findSimilarArticles()` 一致的结构

### `search.service.ts`

保持不变的部分：

- 关键词召回
- `queryType` 判定逻辑
- 分数融合
- 缓存
- 搜索日志

只替换“语义召回来源”，不改前端协议。

## 10. Vercel 部署约束

为了适配 `Vercel`，需要遵守以下约束：

- 只使用可通过 HTTP 访问的外部向量服务
- 不依赖本地常驻进程
- 不依赖同机内存状态
- 所有 client 连接按请求初始化或做轻量复用

推荐环境变量：

- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION`
- `OPENAI_API_KEY`
- `EMBEDDING_MODEL=text-embedding-3-small`

## 11. 测试与验证

### 自动化验证

至少保留并通过：

- `npm run typecheck`
- 搜索相关 E2E
- 发布后重建索引相关 E2E

### 补充验证

建议新增：

- 针对 `vector-store.ts` 的集成测试，验证 `Qdrant` 返回结果能被正确聚合
- 针对 `embedding.service.ts` 的错误处理测试
- 针对 `reindex.service.ts` 的失败回滚 / 补偿路径测试

## 12. 迁移策略

迁移顺序建议如下：

1. 增加 `Qdrant` client 与环境变量配置
2. 保留 mock 路径作为 fallback
3. 接入真实 embedding
4. 改造 `reindex` 写入 `Qdrant`
5. 改造 `vector-store.ts` 查询 `Qdrant`
6. 跑 `reindex:all`
7. 回归搜索与发布链路

这样可以把变更控制在向量层，不影响现有内容系统。

## 13. 风险与缓解

### 风险 1：外部依赖增加

- 影响：部署依赖更多环境变量和外部服务状态
- 缓解：保留清晰的错误提示，并提供 `reindex:all` 补偿路径

### 风险 2：embedding 成本与延迟上升

- 影响：发布和重建链路可能变慢
- 缓解：优先选 `text-embedding-3-small`，并保留批量重建脚本

### 风险 3：MySQL 与 Qdrant 数据短暂不一致

- 影响：检索结果可能暂时缺失新内容
- 缓解：失败即标记 `EmbeddingTask.FAILED`，由脚本补偿，不假装成功

## 14. 最终结论

对于当前 `knowledgeAI` 项目，**Qdrant Cloud + OpenAI embeddings + MySQL 主库保留** 是最适合 `Vercel` 的最省事接入方案。

它满足以下要求：

- 不迁主库
- 不改搜索 API
- 不推翻现有 `HYBRID` 搜索实现
- 只替换当前 mock 向量层
- 部署上符合 `Vercel` 的托管模型
