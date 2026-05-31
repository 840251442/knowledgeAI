-- AlterTable: store raw file bytes in DB to avoid serverless filesystem dependency
ALTER TABLE "ArticleImportTask" ADD COLUMN "fileContent" BYTEA;
