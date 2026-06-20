import { expect, test, type Page } from "@playwright/test";

/**
 * Regressão do app-shell offline: o SW precisa pré-cachear o documento de TODAS
 * as telas no 1º acesso online, para que qualquer tela abra offline mesmo sem
 * ter sido acessada individualmente. Antes do fix, uma rota nunca vista caía na
 * página `/~offline` ("Sem conexão").
 */

const NAV = { name: "Navegação principal" } as const;
const OFFLINE_MARKER = "Sem conexão";

/** Telas do app (todas devem abrir offline mesmo sem visita prévia). */
const ROUTES = [
  "/",
  "/dashboard",
  "/abastecer",
  "/reabastecer",
  "/engraxar",
  "/historico",
  "/espelho",
  "/meu-ponto",
  "/minhas-solicitacoes",
  "/perfil",
  "/ponto",
];

/** Semeia sessão + "bateu o ponto hoje" no localStorage para as telas (gate do
 * ponto) renderizarem offline sem depender de rede. */
async function seedSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const user = {
      nome: "E2E Comboista",
      usuario: "e2e",
      perfil: "comboista",
      vinculo: "comboio",
      prefeituraId: "pref-e2e",
    };
    localStorage.setItem("hu360_token", "e2e-token");
    localStorage.setItem("hu360_user", JSON.stringify(user));
    localStorage.setItem(
      "hu360_trusted_until",
      String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`hu360-ponto:${today}:e2e`, "1");
  });
}

/**
 * Aguarda o SW assumir o controle e o precache conter os documentos das rotas.
 * Polling no lado do Node (page.evaluate aguarda funções async de verdade —
 * waitForFunction com predicado async resolveria no 1º tick com o Promise
 * truthy, sem esperar o SW).
 */
async function waitForPrecacheReady(page: Page): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const ready = await page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) return false;
      for (const key of await caches.keys()) {
        const cache = await caches.open(key);
        const paths = new Set(
          (await cache.keys()).map((r) => new URL(r.url).pathname),
        );
        if (paths.has("/historico") && paths.has("/abastecer")) return true;
      }
      return false;
    });
    if (ready) return;
    await page.waitForTimeout(1000);
  }
  throw new Error("SW/precache não ficou pronto a tempo");
}

test.beforeEach(async ({ page }) => {
  await seedSession(page);
});

test("o SW serve o documento de TODAS as telas offline (sem visita prévia)", async ({
  page,
  context,
}) => {
  // 1º acesso online → instala o SW e pré-cacheia todas as rotas.
  await page.goto("/");
  await waitForPrecacheReady(page);

  // Offline: nenhuma resposta pode vir da rede — só do SW/precache.
  await context.setOffline(true);

  const results = await page.evaluate(async (routes) => {
    const out: Record<string, { status?: number; offline?: boolean; err?: string }> = {};
    for (const r of routes) {
      try {
        const res = await fetch(r, { cache: "no-store" });
        const body = await res.text();
        out[r] = { status: res.status, offline: body.includes("Sem conexão") };
      } catch (e) {
        out[r] = { err: String(e) };
      }
    }
    return out;
  }, ROUTES);

  for (const r of ROUTES) {
    expect(results[r], `rota ${r}`).toEqual({ status: 200, offline: false });
  }
});

test("navegação (hard) offline para tela nunca vista abre a tela, não o /~offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await waitForPrecacheReady(page);
  await context.setOffline(true);

  // waitUntil:'commit' evita corrida com navigationPreload/redirect client-side:
  // resolve assim que o documento (do precache) é recebido.
  const resp = await page.goto("/abastecer", { waitUntil: "commit" });
  expect(resp?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/abastecer");

  // É a tela (casca do MobileShell), não o fallback offline.
  await expect(page.getByRole("navigation", NAV)).toBeVisible();
  await expect(page.getByRole("heading", { name: OFFLINE_MARKER })).toHaveCount(
    0,
  );
});
