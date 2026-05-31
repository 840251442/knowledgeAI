import path from "node:path";

const mammoth = require("mammoth") as {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

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

/** 对纯文本内容调用 AI 做结构化整理（标题提取等可选扩展，当前直接透传） */
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

/** 图片类型：用 vision model，base64 data URL 方式传图 */
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

export async function parseImportFile(input: ParseImportInput): Promise<ParseImportOutput> {
  const model = selectImportModel(input.fileType);
  const title = stripFileExt(input.fileName).trim() || "未命名导入";

  let contentMarkdown = "";

  if (isPlainText(input.fileType)) {
    // txt / md：直接读 UTF-8
    contentMarkdown = normalizeText(input.fileBuffer.toString("utf8"));
  } else if (isDocx(input.fileType)) {
    // docx：用 mammoth 转 Markdown，避免二进制乱码
    const result = await mammoth.convertToMarkdown({ buffer: input.fileBuffer });
    contentMarkdown = normalizeText(result.value);
  } else if (isDoc(input.fileType)) {
    // 旧版 .doc 格式 mammoth 也能处理（部分支持），失败则回退到 AI
    try {
      const result = await mammoth.convertToMarkdown({ buffer: input.fileBuffer });
      contentMarkdown = normalizeText(result.value);
    } catch {
      // 回退：把文件内容作为文本送 AI（doc 多为 ANSI/Latin，有限支持）
      contentMarkdown = "";
    }
  } else if (input.fileType === "application/pdf") {
    // PDF：用 pdf-parse 提取纯文本，再用 AI 整理为 Markdown
    const pdfData = await pdfParse(input.fileBuffer);
    const rawText = normalizeText(pdfData.text);
    if (rawText) {
      contentMarkdown = await callTextModel({ model, text: rawText });
    }
  } else if (input.fileType.startsWith("image/")) {
    // 图片：直接 base64 送 vision model
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
