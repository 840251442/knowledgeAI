import { PrismaClient } from "@prisma/client";
import { reindexAllArticles } from "../src/services/reindex.service";

async function main() {
  const prisma = new PrismaClient();

  await prisma.embeddingTask.deleteMany({
    where: { taskType: "BACKFILL" },
  });

  const results = await reindexAllArticles("BACKFILL");
  const totalChunks = results.reduce((sum, item) => sum + item.chunkCount, 0);

  for (const item of results) {
    console.log(`backfilled ${item.slug}: ${item.chunkCount} chunks`);
  }

  console.log(`done: ${results.length} articles, ${totalChunks} chunks`);
  await prisma.$disconnect();
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  });
