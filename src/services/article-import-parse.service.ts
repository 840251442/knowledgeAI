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

function isWordFile(fileType: string) {
  return (
    fileType === "application/msword" ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isTextLike(fileType: string) {
  return fileType === "text/plain" || fileType === "text/markdown" || isWordFile(fileType);
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
  if (isTextLike(fileType)) return aiConfig.importTextModel;
  throw new Error("UNSUPPORTED_FILE_TYPE");
}

async function callModelExtract(input: { model: string; fileType: string; base64: string }) {
  const client = buildExtractClient();
  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "你是导入解析助手。请提取文件正文并只输出 markdown，不要输出解释、不要输出代码块围栏。",
      },
      {
        role: "user",
        content: JSON.stringify({
          fileType: input.fileType,
          fileBase64: input.base64,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new Error("IMPORT_PARSE_EMPTY");
  }

  return normalizeText(raw);
}

export async function parseImportFile(input: ParseImportInput): Promise<ParseImportOutput> {
  const model = selectImportModel(input.fileType);
  const title = stripFileExt(input.fileName).trim() || "未命名导入";

  let contentMarkdown = "";
  if (isTextLike(input.fileType)) {
    contentMarkdown = normalizeText(input.fileBuffer.toString("utf8"));
  }

  if (!contentMarkdown) {
    const base64 = input.fileBuffer.toString("base64");
    contentMarkdown = await callModelExtract({ model, fileType: input.fileType, base64 });
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
