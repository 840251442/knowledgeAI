type ProbeEvent = "delta" | "done" | "error";

function readArg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const exact = process.argv.find((arg) => arg.startsWith(prefix));
  if (exact) return exact.slice(prefix.length);

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];

  return fallback;
}

function parseSseBlock(raw: string): { event: ProbeEvent | ""; data: unknown } {
  const lines = raw.split("\n");
  const event = (lines.find((line) => line.startsWith("event:"))?.slice(6).trim() ?? "") as
    | ProbeEvent
    | "";
  const dataText = lines.find((line) => line.startsWith("data:"))?.slice(5).trim() ?? "{}";

  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: {} };
  }
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const text = await response.text();
  const setCookie = response.headers.getSetCookie();
  const cookie = setCookie.map((item) => item.split(";", 1)[0]).join("; ");

  if (!response.ok || !cookie) {
    throw new Error(`登录失败: status=${response.status}, body=${text}`);
  }

  return cookie;
}

async function probeStream(baseUrl: string, cookie: string, keyword: string) {
  const response = await fetch(`${baseUrl}/api/admin/ai/draft/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({ keyword }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`流式接口返回非200: status=${response.status}, body=${body}`);
  }

  if (!response.body) {
    throw new Error("流式接口没有返回可读流");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();

  let buffer = "";
  let deltaCount = 0;
  let doneCount = 0;
  let errorCount = 0;
  let finalText = "";
  let errorMessage = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const { event, data } = parseSseBlock(chunk);
      if (event === "delta") {
        deltaCount += 1;
        const content = typeof (data as { content?: unknown }).content === "string"
          ? (data as { content: string }).content
          : "";
        if (content) {
          finalText += content;
          process.stdout.write(content);
        }
      } else if (event === "done") {
        doneCount += 1;
      } else if (event === "error") {
        errorCount += 1;
        const message = typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : "生成失败";
        errorMessage = message;
      }
    }
  }

  return {
    deltaCount,
    doneCount,
    errorCount,
    finalText,
    errorMessage,
  };
}

async function main() {
  const baseUrl = readArg("base-url", process.env.PROBE_BASE_URL || "http://127.0.0.1:3000");
  const email = readArg("email", process.env.PROBE_ADMIN_EMAIL || "admin@knowledgeai.dev");
  const password = readArg("password", process.env.PROBE_ADMIN_PASSWORD || "dev");
  const keyword = readArg("keyword", process.env.PROBE_KEYWORD || "Redis 缓存一致性");

  console.log(`Probing stream endpoint at: ${baseUrl}`);
  console.log(`Keyword: ${keyword}`);

  const cookie = await login(baseUrl, email, password);
  console.log("Login OK, start streaming:");
  console.log("---");

  const result = await probeStream(baseUrl, cookie, keyword);

  console.log("\n---");
  console.log("Probe summary:");
  console.log(`delta events: ${result.deltaCount}`);
  console.log(`done events: ${result.doneCount}`);
  console.log(`error events: ${result.errorCount}`);
  console.log(`output length: ${result.finalText.length}`);

  if (result.errorCount > 0) {
    console.log(`error message: ${result.errorMessage}`);
    process.exitCode = 1;
    return;
  }

  if (result.doneCount === 0) {
    console.log("missing done event");
    process.exitCode = 1;
    return;
  }

  if (result.deltaCount === 0 || !result.finalText.trim()) {
    console.log("missing delta content");
    process.exitCode = 1;
    return;
  }

  console.log("probe passed");
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`probe failed: ${message}`);
  process.exit(1);
});
