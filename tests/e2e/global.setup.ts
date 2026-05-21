import { execSync } from "node:child_process";

import { getRequiredEnv, loadEnvFiles } from "./support/env";

function run(command: string) {
  execSync(command, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });
}

export default async function globalSetup() {
  loadEnvFiles();
  getRequiredEnv("DATABASE_URL");
  getRequiredEnv("AUTH_SECRET");

  run("npx prisma migrate reset --force --skip-generate");
  run("npm run db:seed");
  run("node --import tsx tests/e2e/support/seed-e2e.ts");
  run("npm run embeddings:backfill");
}
