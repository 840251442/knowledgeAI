import { slugifyHeading } from "./slug";

export type MarkdownHeading = {
  depth: number;
  text: string;
  id: string;
};

export function extractHeadings(markdown: string): MarkdownHeading[] {
  const lines = markdown.split(/\r?\n/);
  const raw: Array<{ depth: number; text: string }> = [];

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const depth = m[1].length;
    const text = m[2].trim().replaceAll(/\s+#+\s*$/g, "");
    if (!text) continue;
    raw.push({ depth, text });
  }

  const used = new Map<string, number>();
  return raw.map((h) => {
    const base = slugifyHeading(h.text) || "section";
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return { depth: h.depth, text: h.text, id };
  });
}

