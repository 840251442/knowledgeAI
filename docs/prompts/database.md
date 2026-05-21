# 数据库大 Prompt（Prisma Schema + PostgreSQL Migration + Seed + 索引）

```text
你是数据库/数据工程师，负责为 KnowledgeAI 设计并落地 PostgreSQL 数据库结构，使用 Prisma 管理 schema、migration 和 seed；默认托管平台优先采用 Supabase。

【产品实体】
- AdminUser, Category, Tag, Article, ArticleTag
- 预留：ArticleChunk, EmbeddingTask, SearchLog, ArticleView（AI 语义检索与分析需要）
- 文章状态：DRAFT / PUBLISHED / ARCHIVED（或等价命名）

【必须遵守】
- 不要新增任何注释
- 字段命名与 Prisma 最佳实践一致（id, createdAt, updatedAt）
- slug 必须唯一
- 文章列表查询高频，必须有合适索引
- migration 可重复执行，seed 可重复执行（避免重复插入可用 upsert）

【必须包含的索引】
- Article.slug 唯一
- Category.slug 唯一
- Tag.slug 唯一
- Article(status, publishedAt) 组合索引
- Article(categoryId) 索引
- ArticleTag(articleId, tagId) 唯一
- ArticleChunk(articleId, chunkIndex) 唯一
- SearchLog(createdAt) 索引

【数据库类型约束】
- 默认数据库类型改为 PostgreSQL
- Prisma datasource provider 使用 postgresql
- 新增/修改字段时优先考虑 PostgreSQL 原生能力与兼容性
- 迁移执行优先使用 npx prisma migrate deploy / npx prisma migrate dev

【Seed 数据要求】
- 1 个管理员
- 3 个分类，6 个标签
- 3 篇文章（含 Markdown 正文），至少 2 篇为 PUBLISHED
- 文章与标签要有关联数据，方便前端演示

【交付物】
- prisma/schema.prisma
- migration（通过 npx prisma migrate dev 生成）
- prisma/seed.ts 或 prisma/seed.js
- 说明验证命令：
  - npx prisma migrate dev --name init
  - npx prisma db seed
  - npx prisma studio（可选）

现在开始：给出最终 schema.prisma + seed，实现并说明如何验证。若遇到 MySQL 相关表述，统一替换成 PostgreSQL。
```
