import { defineConfig, devices } from "@playwright/test";

const PORT = 4399;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  // Tests run against a real static build (with internal pages) served by `astro preview`.
  // `--ignore-lock` keeps preview in the foreground: Astro 7 otherwise detaches it into a
  // background daemon when it detects an automated/agent shell, and Playwright would lose it.
  webServer: {
    command: `npm run build:internal && npm run preview -- --host 127.0.0.1 --port ${PORT} --ignore-lock`,
    url: `${BASE_URL}/_styleguide/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-mobile",
      testMatch: "e2e/**/*.spec.ts",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
    {
      name: "webkit-mobile",
      testMatch: "e2e/**/*.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "chromium-desktop",
      testMatch: "e2e/**/*.spec.ts",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      // Not part of `npm run test:e2e`; run with `npm run shots`.
      name: "screenshots",
      testMatch: "visual/**/*.spec.ts",
      use: { browserName: "chromium", deviceScaleFactor: 1 },
    },
  ],
});
