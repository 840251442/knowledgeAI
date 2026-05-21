import type { CategorySummary } from "@/types/article";

import { prisma } from "@/lib/db/prisma";

export async function listPublicCategories(): Promise<CategorySummary[]> {
  const rows = await prisma.category.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
  return rows;
}

