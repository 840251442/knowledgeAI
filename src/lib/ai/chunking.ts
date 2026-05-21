import crypto from "node:crypto";

export type ChunkDraft = {
  chunkIndex: number;
  headingPath: string | null;
  content: string;
  contentHash: string;
  tokenCount: number;
};

const MAX_CHARS_PER_CHUNK = 420;

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function tokenCountOf(input: string) {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeChunk(input: string) {
  return input.replace(/\r/g, "").trim();
}

function pushChunk(chunks: ChunkDraft[], headingPath: string[], buffer: string[]) {
  const content = normalizeChunk(buffer.join("\n\n"));
  if (!content) return;

  chunks.push({
    chunkIndex: chunks.length,
    headingPath: headingPath.length > 0 ? headingPath.join(" / ") : null,
    content,
    contentHash: sha256(content),
    tokenCount: tokenCountOf(content),
  });
}

export function chunkMarkdownByHeading(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const chunks: ChunkDraft[] = [];
  let headingPath: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;

    let current = "";
    for (const part of buffer) {
      const next = current ? `${current}\n\n${part}` : part;
      if (current && next.length > MAX_CHARS_PER_CHUNK) {
        pushChunk(chunks, headingPath, [current]);
        current = part;
        continue;
      }

      current = next;
    }

    if (current) {
      pushChunk(chunks, headingPath, [current]);
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const match = /^(#{1,6})\s+(.*)$/.exec(line.trim());

    if (match) {
      flushBuffer();
      const level = match[1].length;
      const title = match[2].trim();
      headingPath = [...headingPath.slice(0, level - 1), title];
      buffer.push(`${"#".repeat(level)} ${title}`);
      continue;
    }

    if (!line.trim()) {
      if (buffer.length > 0 && buffer[buffer.length - 1] !== "") {
        buffer.push("");
      }
      continue;
    }

    const previous = buffer.length > 0 ? buffer[buffer.length - 1] : "";
    const next = previous ? `${previous}\n${line}` : line;
    if (previous && next.length > MAX_CHARS_PER_CHUNK) {
      flushBuffer();
      buffer.push(line);
      continue;
    }

    if (buffer.length === 0) {
      buffer.push(line);
    } else if (buffer[buffer.length - 1] === "") {
      buffer[buffer.length - 1] = line;
    } else {
      buffer[buffer.length - 1] = `${buffer[buffer.length - 1]}\n${line}`;
    }
  }

  flushBuffer();
  return chunks;
}
