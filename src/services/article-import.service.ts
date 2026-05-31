import path from "node:path";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import type { ArticleImportTaskStatus } from "@prisma/client";

import type { AuthRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseImportFile } from "@/services/article-import-parse.service";
import type { ArticleImportTaskItem } from "@/types/article";

type ImportActor = {
  id: string;
  role: AuthRole;
};

type ImportTaskRow = {
  id: string;
  uploaderRole: "ADMIN" | "PERSONAL";
  uploaderId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  fileContent: Buffer | null;
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
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const MAX_IMPORT_FILES = 5;
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;
const UNSUPPORTED_STORAGE_PATH_PLACEHOLDER_PREFIX = "unsupported://not-stored";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function whereForActor(actor: ImportActor) {
  if (actor.role === "ADMIN") return {};
  return { uploaderRole: "PERSONAL" as const, uploaderId: actor.id };
}

function mapTask(task: ImportTaskRow): ArticleImportTaskItem {
  return {
    id: task.id,
    uploaderRole: task.uploaderRole,
    uploaderId: task.uploaderId,
    fileName: task.fileName,
    fileType: task.fileType,
    fileSize: task.fileSize,
    storagePath: task.storagePath,
    status: task.status,
    parseModel: task.parseModel,
    parsedTitle: task.parsedTitle,
    parsedSummary: task.parsedSummary,
    parsedContent: task.parsedContent,
    articleId: task.articleId,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function stripUnsafeFileName(fileName: string) {
  const base = path.basename(fileName || "upload");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-") || "upload";
}

function detectFileType(file: File) {
  const direct = file.type?.trim();
  if (direct) return direct;

  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function normalizeSlug(input: string) {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "imported-article";
}

function trimErrorMessage(raw: unknown) {
  const message = raw instanceof Error ? raw.message : "导入解析失败";
  return message.trim().slice(0, 500) || "导入解析失败";
}

async function resolveDraftCategoryId() {
  const preferred = await prisma.category.findFirst({
    where: { slug: "backend" },
    select: { id: true },
  });
  if (preferred) return preferred.id;

  const fallback = await prisma.category.findFirst({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (fallback) return fallback.id;

  const anyCategory = await prisma.category.findFirst({ select: { id: true } });
  if (anyCategory) return anyCategory.id;

  throw new Error("IMPORT_CATEGORY_NOT_FOUND");
}

async function buildUniqueSlug(base: string, suffix: string) {
  const maxLen = 220;
  const shortSuffix = suffix.slice(0, 8);
  const trimmedBase = base.slice(0, Math.max(1, maxLen - shortSuffix.length - 1));

  let candidate = `${trimmedBase}-${shortSuffix}`;
  let index = 1;
  while (true) {
    const hit = await prisma.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;

    const tail = `-${index}`;
    const nextBase = trimmedBase.slice(0, Math.max(1, maxLen - shortSuffix.length - tail.length - 1));
    candidate = `${nextBase}-${shortSuffix}${tail}`;
    index += 1;
  }
}

export async function createImportTasks(input: { files: File[]; actor: ImportActor }) {
  if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > MAX_IMPORT_FILES) {
    throw new Error("IMPORT_FILE_COUNT_INVALID");
  }

  const created: ArticleImportTaskItem[] = [];
  for (const file of input.files) {
    const fileType = detectFileType(file);
    const safeName = stripUnsafeFileName(file.name);

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      const storagePath = `${UNSUPPORTED_STORAGE_PATH_PLACEHOLDER_PREFIX}/${randomUUID()}`;
      const failedTask = (await prisma.articleImportTask.create({
        data: {
          uploaderRole: input.actor.role,
          uploaderId: input.actor.id,
          fileName: safeName,
          fileType,
          fileSize: file.size,
          storagePath,
          status: "FAILED",
          errorCode: "UNSUPPORTED_FILE_TYPE",
          errorMessage: "文件类型不受支持",
          finishedAt: new Date(),
        },
        select: {
          id: true,
          uploaderRole: true,
          uploaderId: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          storagePath: true,
          status: true,
          parseModel: true,
          parsedTitle: true,
          parsedSummary: true,
          parsedContent: true,
          articleId: true,
          errorCode: true,
          errorMessage: true,
          retryCount: true,
          maxRetries: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })) as ImportTaskRow;

      created.push(mapTask(failedTask));
      continue;
    }

    if (file.size <= 0 || file.size > MAX_IMPORT_FILE_SIZE) {
      throw new Error("IMPORT_FILE_SIZE_INVALID");
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(arrayBuffer);
    const storagePath = `db:${safeName}`;

    const task = (await prisma.articleImportTask.create({
      data: {
        uploaderRole: input.actor.role,
        uploaderId: input.actor.id,
        fileName: safeName,
        fileType,
        fileSize: file.size,
        storagePath,
        fileContent,
        status: "QUEUED",
      },
      select: {
        id: true,
        uploaderRole: true,
        uploaderId: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        storagePath: true,
        status: true,
        parseModel: true,
        parsedTitle: true,
        parsedSummary: true,
        parsedContent: true,
        articleId: true,
        errorCode: true,
        errorMessage: true,
        retryCount: true,
        maxRetries: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as ImportTaskRow;

    created.push(mapTask(task));
  }

  return {
    total: created.length,
    items: created,
  };
}

export async function listImportTasks(input: {
  actor: ImportActor;
  page: number;
  pageSize: number;
  status?: ArticleImportTaskStatus;
}) {
  const where = {
    ...whereForActor(input.actor),
    ...(input.status ? { status: input.status } : undefined),
  };

  const [total, rows] = await Promise.all([
    prisma.articleImportTask.count({ where }),
    prisma.articleImportTask.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        uploaderRole: true,
        uploaderId: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        storagePath: true,
        status: true,
        parseModel: true,
        parsedTitle: true,
        parsedSummary: true,
        parsedContent: true,
        articleId: true,
        errorCode: true,
        errorMessage: true,
        retryCount: true,
        maxRetries: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    total,
    items: (rows as ImportTaskRow[]).map(mapTask),
  };
}

export async function retryImportTask(input: { taskId: string; actor: ImportActor }) {
  const task = await prisma.articleImportTask.findFirst({
    where: {
      id: input.taskId,
      ...whereForActor(input.actor),
    },
    select: {
      id: true,
      uploaderRole: true,
      uploaderId: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      storagePath: true,
      status: true,
      parseModel: true,
      parsedTitle: true,
      parsedSummary: true,
      parsedContent: true,
      articleId: true,
      errorCode: true,
      errorMessage: true,
      retryCount: true,
      maxRetries: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!task) throw new Error("IMPORT_TASK_NOT_FOUND");
  if (task.status !== "FAILED") throw new Error("IMPORT_TASK_NOT_RETRYABLE");
  if (task.retryCount >= task.maxRetries) throw new Error("IMPORT_TASK_RETRY_LIMIT");

  const updated = (await prisma.articleImportTask.update({
    where: { id: task.id },
    data: {
      status: "RETRYING",
      retryCount: { increment: 1 },
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    },
    select: {
      id: true,
      uploaderRole: true,
      uploaderId: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      storagePath: true,
      status: true,
      parseModel: true,
      parsedTitle: true,
      parsedSummary: true,
      parsedContent: true,
      articleId: true,
      errorCode: true,
      errorMessage: true,
      retryCount: true,
      maxRetries: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as ImportTaskRow;

  return mapTask(updated);
}

async function processTaskById(taskId: string) {
  const task = await prisma.articleImportTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      uploaderRole: true,
      uploaderId: true,
      fileName: true,
      fileType: true,
      storagePath: true,
      fileContent: true,
      retryCount: true,
      maxRetries: true,
    },
  });

  if (!task) return null;

  try {
    const fileBuffer = task.fileContent
      ? Buffer.from(task.fileContent)
      : await readFile(task.storagePath);
    const parsed = await parseImportFile({
      fileName: task.fileName,
      fileType: task.fileType,
      fileBuffer,
    });

    const categoryId = await resolveDraftCategoryId();
    const slugBase = normalizeSlug(parsed.title);
    const slug = await buildUniqueSlug(slugBase, task.id);

    const article = await prisma.article.create({
      data: {
        title: parsed.title,
        slug,
        summary: parsed.summary || null,
        contentMarkdown: parsed.contentMarkdown,
        status: "DRAFT",
        categoryId,
        ...(task.uploaderRole === "ADMIN"
          ? { adminAuthorId: task.uploaderId }
          : { personalAuthorId: task.uploaderId }),
      },
      select: { id: true },
    });

    await prisma.articleImportTask.update({
      where: { id: task.id },
      data: {
        status: "SUCCEEDED",
        parseModel: parsed.model,
        parsedTitle: parsed.title,
        parsedSummary: parsed.summary || null,
        parsedContent: parsed.contentMarkdown,
        articleId: article.id,
        errorCode: null,
        errorMessage: null,
        finishedAt: new Date(),
      },
    });

    return { taskId: task.id, status: "SUCCEEDED" as const, articleId: article.id };
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : "";
    const errorCode =
      rawCode === "IMPORT_AI_CONFIG_MISSING" ||
      rawCode === "UNSUPPORTED_FILE_TYPE" ||
      rawCode === "IMPORT_PARSE_EMPTY"
        ? rawCode
        : "IMPORT_PROCESS_FAILED";

    await prisma.articleImportTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        errorCode,
        errorMessage: trimErrorMessage(error),
        finishedAt: new Date(),
      },
    });

    return { taskId: task.id, status: "FAILED" as const, articleId: null };
  }
}

export async function processNextImportTask() {
  const candidate = await prisma.articleImportTask.findFirst({
    where: { status: { in: ["QUEUED", "RETRYING"] } },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, status: true },
  });

  if (!candidate) return null;

  const claimed = await prisma.articleImportTask.updateMany({
    where: {
      id: candidate.id,
      status: { in: ["QUEUED", "RETRYING"] },
    },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });

  if (claimed.count === 0) return null;

  return processTaskById(candidate.id);
}

export async function processImportTasksBatch(input?: { limit?: number }) {
  const limit = Math.max(1, Math.min(50, input?.limit ?? 10));

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < limit; i += 1) {
    const result = await processNextImportTask();
    if (!result) break;

    processed += 1;
    if (result.status === "SUCCEEDED") succeeded += 1;
    if (result.status === "FAILED") failed += 1;
  }

  return {
    processed,
    succeeded,
    failed,
  };
}
