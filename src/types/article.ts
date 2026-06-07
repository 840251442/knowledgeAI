import type {
  ArticleCommentStatus as PrismaArticleCommentStatus,
  ArticleImportTaskStatus as PrismaArticleImportTaskStatus,
  ArticleStatus as PrismaArticleStatus,
  CommentAuthorType as PrismaCommentAuthorType,
  UserRole as PrismaUserRole,
} from "@prisma/client";

export type ArticleStatus = PrismaArticleStatus;

export type ArticleCommentStatus = PrismaArticleCommentStatus;
export type CommentAuthorType = PrismaCommentAuthorType;
export type ArticleImportTaskStatus = PrismaArticleImportTaskStatus;
export type UserRole = PrismaUserRole;

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

export type ArticleImportTaskItem = {
  id: string;
  uploaderRole: UserRole;
  uploaderId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  status: ArticleImportTaskStatus;
  parseModel: string | null;
  parsedTitle: string | null;
  parsedSummary: string | null;
  parsedContent: string | null;
  articleId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
