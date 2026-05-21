export const cacheVersionKeys = {
  homeLatest: "cache:version:home-latest",
  hotTags: "cache:version:hot-tags",
  searchResults: "cache:version:search-results",
} as const;

export const cacheKeys = {
  homeLatest(input: { version: string; page: number; pageSize: number }) {
    return `cache:home:latest:v${input.version}:page:${input.page}:size:${input.pageSize}`;
  },
  articleDetail(slug: string) {
    return `cache:article:detail:${encodeURIComponent(slug)}`;
  },
  searchResults(input: {
    version: string;
    query: string;
    page: number;
    pageSize: number;
  }) {
    return `cache:search:v${input.version}:q:${encodeURIComponent(input.query)}:page:${input.page}:size:${input.pageSize}`;
  },
  hotTags(input: { version: string; limit: number }) {
    return `cache:tags:hot:v${input.version}:limit:${input.limit}`;
  },
} as const;
