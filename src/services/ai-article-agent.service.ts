import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { requireAiConfig } from "@/config/ai";

export async function* streamArticleDraft(input: { keyword: string }) {
  if (process.env.E2E_FAST_REVIEW === "1" || process.env.NODE_ENV === "test") {
    const draft = [
      `# ${input.keyword} 实践指南`,
      "",
      "## 背景",
      `围绕 ${input.keyword} 展开一套可落地的技术方案。`,
      "",
      "## 方案",
      "- 分析问题边界",
      "- 给出实施步骤",
      "- 补充验证方式",
    ].join("\n");

    yield draft;
    return;
  }

  const config = requireAiConfig();

  const model = new ChatOpenAI({
    model: config.writerModel,
    apiKey: config.embeddingApiKey,
    configuration: {
      baseURL: config.embeddingBaseUrl ?? undefined,
    },
    temperature: 0.7,
    streaming: true,
  });

  const stream = await model.stream([
    new SystemMessage(
      `你是技术文章写作助手。请只输出 Markdown 正文，不要输出标题、摘要、slug、标签。正文必须是中文，结构清晰，最大 ${config.writerMaxChars} 字。`,
    ),
    new HumanMessage(`关键词：${input.keyword}`),
  ]);

  let total = 0;
  for await (const chunk of stream) {
    const text = typeof chunk.content === "string" ? chunk.content : chunk.content?.toString() ?? "";
    if (!text) continue;
    if (total >= config.writerMaxChars) break;

    const rest = config.writerMaxChars - total;
    const emit = text.slice(0, rest);
    total += emit.length;
    yield emit;
  }
}
