/// <reference lib="webworker" />
/**
 * Service Worker do app de campo (comboista), compilado pelo Serwist no
 * `next build --webpack` (swSrc → public/sw.js). Substitui o SW manual antigo.
 *
 * Estratégias (defaultCache do @serwist/next):
 * - Navegação (HTML/RSC): NetworkFirst → cache (fresco online, abre offline).
 *   Rota nunca vista offline cai na página `/~offline` (precache).
 * - `_next/static/**` (hash imutável): CacheFirst.
 * - `_next/data`/RSC, imagens, fontes: estratégias dedicadas do defaultCache.
 * - API NestJS (cross-origin): não é interceptada — leitura offline fica no
 *   Dexie (camada de dados) e escrita no outbox.
 *
 * Atualização controlada: `skipWaiting: false` — o SW novo espera e só assume
 * quando o app manda `SKIP_WAITING` (prompt de atualização).
 *
 * Background Sync: ao `sync` (rede de volta, app em 2º plano), pede às telas
 * abertas para esvaziar a outbox — token e Dexie vivem na página.
 */
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injetado pelo Serwist no build com os assets a pré-cachear.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// O app pede para o SW novo assumir quando o usuário aceita atualizar.
self.addEventListener("message", (event) => {
  if ((event as ExtendableMessageEvent).data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

// Background Sync: a fila é esvaziada na página (token + Dexie + api client).
self.addEventListener("sync", (event) => {
  const e = event as ExtendableEvent & { tag?: string };
  if (e.tag !== "flush-outbox") return;
  e.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: "FLUSH_OUTBOX" });
        }
      }),
  );
});

serwist.addEventListeners();
