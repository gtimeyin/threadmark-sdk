import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "line",
  outputDir: "test-results",
  use: {
    browserName: "chromium",
    headless: true,
    viewport: { width: 600, height: 400 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
