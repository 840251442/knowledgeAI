import { prisma } from "@/lib/db/prisma";

export async function listAdminTags() {
  const rows = await prisma.tag.findMany({
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
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

export async function createAdminTag(input: { name: string; slug: string }) {
  const created = await prisma.tag.create({
    data: {
      name: input.name,
      slug: input.slug,
    },
    select: { id: true },
  });
  return created;
}

export async function updateAdminTag(id: string, input: { name?: string; slug?: string }) {
  await prisma.tag.update({
    where: { id },
    data: {
      ...(typeof input.name === "string" ? { name: input.name } : undefined),
      ...(typeof input.slug === "string" ? { slug: input.slug } : undefined),
    },
    select: { id: true },
  });

  return { id };
}

export async function deleteAdminTag(id: string) {
  await prisma.tag.delete({ where: { id } });
  return { id };
}

