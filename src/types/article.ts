export type ArticleStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";

export type ArticleCommentStatus = "OPEN" | "CLOSED";
export type CommentAuthorType = "GUEST" | "PERSONAL";

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
  commentStatus: ArticleCommentStatus;
};

export type CommentAuthor = {
  type: CommentAuthorType;
  userId: string | null;
  displayName: string;
};

export type CommentView = {
  id: string;
  articleId: string;
  author: CommentAuthor;
  body: string;
  createdAt: string;
};

export type ArticleCommentSummary = {
  articleId: string;
  commentStatus: ArticleCommentStatus;
  items: CommentView[];
};

export type AdminCommentItem = CommentView & {
  article: {
    id: string;
    title: string;
    slug: string;
  };
};
