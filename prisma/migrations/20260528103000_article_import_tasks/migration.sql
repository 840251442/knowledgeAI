-- CreateEnum
CREATE TYPE "ArticleImportTaskStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "ArticleImportTask" (
    "id" TEXT NOT NULL,
    "uploaderRole" "UserRole" NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "status" "ArticleImportTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "parseModel" VARCHAR(100),
    "parsedTitle" VARCHAR(200),
    "parsedSummary" VARCHAR(500),
    "parsedContent" TEXT,
    "articleId" TEXT,
    "errorCode" VARCHAR(100),
    "errorMessage" VARCHAR(500),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleImportTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleImportTask_uploaderRole_uploaderId_createdAt_idx" ON "ArticleImportTask"("uploaderRole", "uploaderId", "createdAt");

-- CreateIndex
CREATE INDEX "ArticleImportTask_status_updatedAt_idx" ON "ArticleImportTask"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ArticleImportTask_articleId_idx" ON "ArticleImportTask"("articleId");

-- AddForeignKey
ALTER TABLE "ArticleImportTask" ADD CONSTRAINT "ArticleImportTask_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
