import { defineConfig, devices } from "@playwright/test";

// The app runs against a MOCKED API (tests/e2e/mock-api.ts): no backend or database needed.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5199",
    // In a sandbox without Playwright's browsers, point at an existing Chromium
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH, args: ["--no-sandbox"] } : {},
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5199 --strictPort",
    url: "http://127.0.0.1:5199",
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: "http://api.test", VITE_PAYSTACK_PUBLIC_KEY: "pk_test_e2e" },
    timeout: 120_000,
  },
});
