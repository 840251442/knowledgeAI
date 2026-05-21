import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.adminUser.findUniqueOrThrow({
    where: { email: "admin@knowledgeai.dev" },
    select: { id: true },
  });

  const category = await prisma.category.findUniqueOrThrow({
    where: { slug: "database" },
    select: { id: true },
  });

  await prisma.article.upsert({
    where: { slug: "redis-cache-consistency-e2e" },
    update: {
      title: "Redis 缓存一致性与失效顺序",
      summary: "用于 E2E 搜索与缓存验收的固定文章。",
      contentMarkdown: `# Redis 缓存一致性与失效顺序

## 更新数据库后先删缓存
如果数据库中的内容发生变化，必须及时失效 Redis 缓存，避免脏读。

## 自然语言检索提示
当用户搜索“数据库改完后怎么让缓存别脏”时，应该命中这篇文章。`,
      categoryId: category.id,
      adminAuthorId: admin.id,
      status: "PUBLISHED",
      publishedAt: new Date("2026-05-19T09:30:00.000Z"),
    },
    create: {
      title: "Redis 缓存一致性与失效顺序",
      slug: "redis-cache-consistency-e2e",
      summary: "用于 E2E 搜索与缓存验收的固定文章。",
      contentMarkdown: `# Redis 缓存一致性与失效顺序

## 更新数据库后先删缓存
如果数据库中的内容发生变化，必须及时失效 Redis 缓存，避免脏读。

## 自然语言检索提示
当用户搜索“数据库改完后怎么让缓存别脏”时，应该命中这篇文章。`,
      categoryId: category.id,
      adminAuthorId: admin.id,
      status: "PUBLISHED",
      publishedAt: new Date("2026-05-19T09:30:00.000Z"),
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
