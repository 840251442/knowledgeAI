import path from "node:path";

import OpenAI from "openai";

import { aiConfig, requireAiConfig } from "@/config/ai";

export type ParseImportInput = {
  fileName: string;
  fileType: string;
  fileBuffer: Buffer;
};

export type ParseImportOutput = {
  model: string;
  title: string;
  summary: string;
  contentMarkdown: string;
};

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function stripFileExt(fileName: string) {
  const ext = path.extname(fileName);
  if (!ext) return fileName;
  return fileName.slice(0, -ext.length) || fileName;
}

function summarizeText(text: string, maxLen = 120) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length <= maxLen ? compact : `${compact.slice(0, maxLen)}...`;
}

function isDocx(fileType: string) {
  return fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function isDoc(fileType: string) {
  return fileType === "application/msword";
}

function isPlainText(fileType: string) {
  return fileType === "text/plain" || fileType === "text/markdown";
}

function buildExtractClient() {
  const config = requireAiConfig();
  return new OpenAI({
    apiKey: config.embeddingApiKey,
    baseURL: config.embeddingBaseUrl ?? undefined,
  });
}

export function selectImportModel(fileType: string) {
  if (fileType === "application/pdf") return aiConfig.importPdfModel;
  if (fileType.startsWith("image/")) return aiConfig.importVisionModel;
  if (isPlainText(fileType) || isDocx(fileType) || isDoc(fileType)) return aiConfig.importTextModel;
  throw new Error("UNSUPPORTED_FILE_TYPE");
}

async function callTextModel(input: { model: string; text: string }) {
  const client = buildExtractClient();
  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "你是导入解析助手。请将下方文本整理为规范的 Markdown，保留所有内容，不要添加解释或代码块围栏。",
      },
      {
        role: "user",
        content: input.text,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("IMPORT_PARSE_EMPTY");
  return normalizeText(raw);
}

async function callVisionModel(input: { model: string; fileType: string; base64: string }) {
  const client = buildExtractClient();
  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "你是导入解析助手。请提取图片中的文字内容并只输出 markdown，不要输出解释、不要输出代码块围栏。",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${input.fileType};base64,${input.base64}` },
          },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("IMPORT_PARSE_EMPTY");
  return normalizeText(raw);
}

/**
 * 懒加载 pdf-parse，避免顶层 require 在 Next.js 构建阶段读取测试文件导致崩溃。
 * pdf-parse 是 CJS 模块，dynamic import 返回 { default: fn }。
 */
async function parsePdf(buffer: Buffer): Promise<string> {
  // Polyfill DOM APIs required by pdfjs-dist in Node.js/serverless environments.
  // pdfjs-dist references DOMMatrix and Path2D even during text-only extraction.
  if (typeof globalThis.DOMMatrix === "undefined") {
    const stub = class {};
    Object.assign(globalThis, { DOMMatrix: stub, Path2D: stub });
  }
  type PdfParseFn = (buf: Buffer) => Promise<{ text: string }>;
  const mod = (await import("pdf-parse")) as unknown as { default: PdfParseFn } | PdfParseFn;
  const fn: PdfParseFn =
    typeof mod === "function" ? mod : (mod as { default: PdfParseFn }).default;
  const data = await fn(buffer);
  return normalizeText(data.text);
}

/**
 * 懒加载 mammoth，用 extractRawText 提取纯文本，再由 AI 整理为 Markdown。
 * mammoth 没有 convertToMarkdown API，正确方法是 extractRawText。
 */
async function parseWordDoc(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value);
}

export async function parseImportFile(input: ParseImportInput): Promise<ParseImportOutput> {
  const model = selectImportModel(input.fileType);
  const title = stripFileExt(input.fileName).trim() || "未命名导入";

  let contentMarkdown = "";

  if (isPlainText(input.fileType)) {
    // txt / md：直接读 UTF-8
    contentMarkdown = normalizeText(input.fileBuffer.toString("utf8"));
  } else if (isDocx(input.fileType) || isDoc(input.fileType)) {
    // docx / doc：提取纯文本后送 AI 整理为 Markdown
    try {
      const rawText = await parseWordDoc(input.fileBuffer);
      if (rawText) {
        contentMarkdown = await callTextModel({ model, text: rawText });
      }
    } catch {
      contentMarkdown = "";
    }
  } else if (input.fileType === "application/pdf") {
    // PDF：提取纯文本后送 AI 整理为 Markdown
    const rawText = await parsePdf(input.fileBuffer);
    if (rawText) {
      contentMarkdown = await callTextModel({ model, text: rawText });
    }
  } else if (input.fileType.startsWith("image/")) {
    // 图片：base64 送 vision model
    const base64 = input.fileBuffer.toString("base64");
    contentMarkdown = await callVisionModel({ model, fileType: input.fileType, base64 });
  }

  if (!contentMarkdown) {
    throw new Error("IMPORT_PARSE_EMPTY");
  }

  return {
    model,
    title,
    summary: summarizeText(contentMarkdown, 120),
    contentMarkdown,
  };
}
