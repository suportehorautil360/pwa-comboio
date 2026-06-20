import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do PWA de campo. O service worker do Serwist só é gerado/registrado no
 * build de produção (`next build --webpack` + `next start`), então o webServer
 * sobe a app de produção sozinho. Os testes validam o app-shell offline:
 * qualquer tela abre offline mesmo sem ter sido acessada online (precache).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
