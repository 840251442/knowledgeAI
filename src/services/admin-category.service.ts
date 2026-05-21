import { prisma } from "@/lib/db/prisma";

export async function listAdminCategories() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      isVisible: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createAdminCategory(input: {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
}) {
  const created = await prisma.category.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
      isVisible: input.isVisible ?? true,
    },
    select: { id: true },
  });
  return created;
}

export async function updateAdminCategory(
  id: string,
  input: {
    name?: string;
    slug?: string;
    description?: string | null;
    sortOrder?: number;
    isVisible?: boolean;
  },
) {
  await prisma.category.update({
    where: { id },
    data: {
      ...(typeof input.name === "string" ? { name: input.name } : undefined),
      ...(typeof input.slug === "string" ? { slug: input.slug } : undefined),
      ...(input.description !== undefined ? { description: input.description } : undefined),
      ...(typeof input.sortOrder === "number" ? { sortOrder: input.sortOrder } : undefined),
      ...(typeof input.isVisible === "boolean" ? { isVisible: input.isVisible } : undefined),
    },
    select: { id: true },
  });

  return { id };
}

export async function deleteAdminCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  return { id };
}

