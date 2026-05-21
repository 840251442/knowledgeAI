import { defineConfig, devices } from "@playwright/test";

const webHost = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const webPort = Number(process.env.PLAYWRIGHT_PORT ?? "3000");
const baseURL = `http://${webHost}:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global.setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `NODE_ENV=test E2E_FAST_REVIEW=1 npm run dev -- --hostname ${webHost} --port ${webPort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
