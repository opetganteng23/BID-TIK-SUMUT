import { defineConfig, devices } from "@playwright/test";

// Menguji server yang sudah berjalan (BASE_URL) dengan database uji. Lihat README bagian Pengujian.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
