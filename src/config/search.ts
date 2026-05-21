export const searchConfig = {
  keywordWeight: 0.45,
  semanticWeight: 0.45,
  freshnessWeight: 0.1,
  searchCacheTtlSeconds: 600,
  semanticTopK: 20,
  semanticMinScore: Number(process.env.SEARCH_SEMANTIC_MIN_SCORE ?? "0.30"),
} as const;

