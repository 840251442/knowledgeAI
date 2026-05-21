import { execSync } from "node:child_process";

import { getRequiredEnv, loadEnvFiles } from "./support/env";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(command: string, retries = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      execSync(command, {
        stdio: "inherit",
        env: {
          ...process.env,
          NODE_ENV: "test",
        },
      });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isDatabaseReachabilityIssue = message.includes("P1001") || message.includes("Can't reach database server");
      if (!isDatabaseReachabilityIssue || attempt === retries) {
        throw error;
      }
      await sleep(3000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export default async function globalSetup() {
  loadEnvFiles();
  getRequiredEnv("DATABASE_URL");
  getRequiredEnv("AUTH_SECRET");

  await run("npx prisma migrate reset --force --skip-generate");
  await run("npm run db:seed");
  await run("node --import tsx tests/e2e/support/seed-e2e.ts");
  await run("npm run embeddings:backfill");
}
