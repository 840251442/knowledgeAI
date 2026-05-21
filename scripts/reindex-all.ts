import { reindexAllArticles } from "../src/services/reindex.service";

async function main() {
  const results = await reindexAllArticles("REINDEX_ALL");
  const totalChunks = results.reduce((sum, item) => sum + item.chunkCount, 0);

  for (const item of results) {
    console.log(`reindexed ${item.slug}: ${item.chunkCount} chunks`);
  }

  console.log(`done: ${results.length} articles, ${totalChunks} chunks`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
