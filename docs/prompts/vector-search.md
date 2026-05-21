# 向量数据库与语义检索大 Prompt（切片 + Embedding + Vector Store + 混合搜索）

```text
你是 AI/搜索工程师，负责把“站内语义搜索”落地：文章切片、embedding 生成、向量写入/查询、与关键词搜索融合排序。要求不改变前端请求形态（仍用 GET /api/search?q=...）。

【首版目标】
- 仅基于知识库内部内容做语义搜索（不联网）
- 返回“文章 + 命中片段 + 分数 + 元信息”，不生成长答案
- 支持混合检索：keyword candidates + semantic candidates → 融合排序

【向量数据库选择策略（默认方案）】
- 默认选用托管型向量库（例如 Qdrant Cloud / Pinecone），通过 HTTP API 访问，适配 Vercel
- 但必须封装成 lib/ai/vector-store.ts 的 Adapter，后续可替换实现不影响上层
- 向量不强塞 MySQL：MySQL 存 chunk 元信息；向量库存 embedding 向量 + chunkId

【切片策略（必须实现）】
- heading-aware：尽量按 Markdown 标题层级切片
- 每片目标：300-800 字（或接近），避免过长
- 每个 chunk 存：articleId, chunkIndex, headingPath, content, contentHash, tokenCount, embeddingStatus
- 文章更新/发布：旧 chunk 全量重建（首版允许粗暴重建）

【Embedding 生成】
- 提供 services/embedding.service.ts：对 chunks 批量生成 embedding
- 支持任务表 EmbeddingTask 记录状态（PENDING/RUNNING/SUCCESS/FAILED）
- 发布后触发：chunking → embedding → upsert 向量库（可异步，但首版可以先同步+提示状态）

【检索融合】
- semantic：topK chunks by similarity（例如 K=20）
- keyword：沿用已有 keyword search（title/summary/tags/content）
- 融合：finalScore = 0.45*keyword + 0.45*semantic + 0.10*freshness
- 去重：同一 article 合并 chunk 命中，选最高分 chunk 作为 excerpt

【接口约束】
- GET /api/search 返回结构保持稳定（SearchResultItem[]）
- 语义检索增强只能改变排序/更多命中片段，不改请求参数

【交付物】
- lib/ai/chunking.ts（切片实现）
- lib/ai/vector-store.ts（向量库 adapter：upsert/query/deleteByArticle）
- services/embedding.service.ts（embedding 生成与落库）
- services/reindex.service.ts（发布后重建索引）
- scripts/backfill-embeddings.ts（历史文章回填）
- 在 services/search.service.ts 中接入混合排序（不改 /api/search 的请求形态）

【验证要求】
- 给出 3 个示例查询：自然语言能命中语义相关文章（不是纯关键词）
- 断言：搜索返回包含 excerpt（chunk 片段）与正确文章 slug

现在开始：先实现 chunking + vector-store adapter 的接口定义 + semantic retrieval 的最小闭环（可用 mock embedding 先跑通），然后再接入真实 embedding API。
```
