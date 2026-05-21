import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@knowledgeai.dev" },
    update: {
      username: "admin",
      isActive: true,
    },
    create: {
      username: "admin",
      email: "admin@knowledgeai.dev",
      passwordHash: "dev",
      role: "ADMIN",
      isActive: true,
    },
  });

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "backend" },
      update: { name: "后端", isVisible: true, sortOrder: 10 },
      create: { name: "后端", slug: "backend", description: "API、缓存、性能与工程化", sortOrder: 10, isVisible: true },
    }),
    prisma.category.upsert({
      where: { slug: "database" },
      update: { name: "数据库", isVisible: true, sortOrder: 20 },
      create: { name: "数据库", slug: "database", description: "MySQL、索引与事务", sortOrder: 20, isVisible: true },
    }),
    prisma.category.upsert({
      where: { slug: "frontend" },
      update: { name: "前端", isVisible: true, sortOrder: 30 },
      create: { name: "前端", slug: "frontend", description: "React、Next.js 与性能优化", sortOrder: 30, isVisible: true },
    }),
  ]);

  const [backendCategory, databaseCategory, frontendCategory] = categories;

  const tags = await Promise.all([
    prisma.tag.upsert({ where: { slug: "redis" }, update: { name: "Redis" }, create: { name: "Redis", slug: "redis" } }),
    prisma.tag.upsert({ where: { slug: "mysql" }, update: { name: "MySQL" }, create: { name: "MySQL", slug: "mysql" } }),
    prisma.tag.upsert({ where: { slug: "nextjs" }, update: { name: "Next.js" }, create: { name: "Next.js", slug: "nextjs" } }),
    prisma.tag.upsert({ where: { slug: "react" }, update: { name: "React" }, create: { name: "React", slug: "react" } }),
    prisma.tag.upsert({ where: { slug: "performance" }, update: { name: "性能" }, create: { name: "性能", slug: "performance" } }),
    prisma.tag.upsert({ where: { slug: "architecture" }, update: { name: "架构" }, create: { name: "架构", slug: "architecture" } }),
  ]);

  const tagBySlug = new Map(tags.map((t) => [t.slug, t]));

  const articles = [
    {
      title: "Redis 缓存策略实践指南",
      slug: "redis-cache-strategy",
      summary: "从穿透/击穿/雪崩到一致性与监控，给出可落地的工程方案。",
      contentMarkdown: `# Redis 缓存策略实践指南

## 1. 问题背景
缓存用于降低延迟与削峰，但也会引入一致性风险。

## 2. 核心策略
- Cache Aside
- TTL 分层
- 热点保护

## 3. 失效与一致性
按业务链路评估可接受的最终一致性窗口。`,
      categoryId: databaseCategory.id,
      tagSlugs: ["redis", "performance", "architecture"],
      status: "PUBLISHED" as const,
    },
    {
      title: "MySQL 索引设计：从原则到实战",
      slug: "mysql-index-design",
      summary: "索引选择、覆盖索引与常见坑，兼顾可解释与可复用。",
      contentMarkdown: `# MySQL 索引设计：从原则到实战

## 1. 什么时候需要索引
高选择性、常过滤、常排序、常 join 的字段优先考虑。

## 2. 常见策略
- 组合索引
- 覆盖索引
- 避免函数导致索引失效

## 3. 验证与观测
通过 EXPLAIN 与慢查询日志持续优化。`,
      categoryId: databaseCategory.id,
      tagSlugs: ["mysql", "performance"],
      status: "PUBLISHED" as const,
    },
    {
      title: "Next.js 全栈路由与数据获取模式",
      slug: "nextjs-data-fetching",
      summary: "在 App Router 下组织页面、组件与服务端数据获取。",
      contentMarkdown: `# Next.js 全栈路由与数据获取模式

## 1. 路由分组
通过 (public)/(admin) 将公开站与后台隔离，但不影响 URL。

## 2. 数据获取
优先在服务端获取数据，配合缓存策略提升性能与一致性。

## 3. API 与服务层
Route Handler 负责参数与响应，services 负责业务编排。`,
      categoryId: backendCategory.id,
      tagSlugs: ["nextjs", "react", "architecture"],
      status: "DRAFT" as const,
    },
  ];

  for (const a of articles) {
    const article = await prisma.article.upsert({
      where: { slug: a.slug },
      update: {
        title: a.title,
        summary: a.summary,
        contentMarkdown: a.contentMarkdown,
        status: a.status,
        categoryId: a.categoryId,
        adminAuthorId: admin.id,
        publishedAt: a.status === "PUBLISHED" ? new Date() : null,
      },
      create: {
        title: a.title,
        slug: a.slug,
        summary: a.summary,
        contentMarkdown: a.contentMarkdown,
        status: a.status,
        categoryId: a.categoryId,
        adminAuthorId: admin.id,
        publishedAt: a.status === "PUBLISHED" ? new Date() : null,
      },
    });

    const tagIds = a.tagSlugs
      .map((s) => tagBySlug.get(s))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((t) => t.id);

    await prisma.articleTag.deleteMany({ where: { articleId: article.id } });
    if (tagIds.length > 0) {
      await prisma.articleTag.createMany({
        data: tagIds.map((tagId) => ({ articleId: article.id, tagId })),
        skipDuplicates: true,
      });
    }
  }

  const _ = frontendCategory;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    await prisma.$disconnect();
    throw err;
  });

