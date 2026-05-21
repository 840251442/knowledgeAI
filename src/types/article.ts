export type ArticleStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
};

export type TagSummary = {
  id: string;
  name: string;
  slug: string;
};

export type ArticleListItem = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: ArticleStatus;
  publishedAt: string | null;
  updatedAt: string;
  category: CategorySummary;
  tags: TagSummary[];
};

export type ArticleDetail = ArticleListItem & {
  contentMarkdown: string;
};
