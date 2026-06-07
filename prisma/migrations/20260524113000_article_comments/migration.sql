-- CreateEnum
CREATE TYPE "ArticleCommentStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CommentAuthorType" AS ENUM ('GUEST', 'PERSONAL');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "commentStatus" "ArticleCommentStatus" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorType" "CommentAuthorType" NOT NULL,
    "personalUserId" TEXT,
    "guestName" VARCHAR(80),
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_articleId_createdAt_idx" ON "Comment"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_personalUserId_createdAt_idx" ON "Comment"("personalUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_personalUserId_fkey" FOREIGN KEY ("personalUserId") REFERENCES "PersonalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
