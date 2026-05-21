import type { CategorySummary, TagSummary } from "./article";

export type SearchQueryType = "KEYWORD" | "SEMANTIC" | "HYBRID";

export type SearchFilters = {
  categorySlug?: string;
  tagSlug?: string;
  page?: number;
  pageSize?: number;
};

export type SearchResultItem = {
  articleId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  score: number;
  category: CategorySummary;
  tags: TagSummary[];
};

export type SearchResponse = {
  query: string;
  queryType: SearchQueryType;
  items: SearchResultItem[];
  total: number;
};
