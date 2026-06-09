/*
 * Service worker do app de campo (comboista) — offline app-shell.
 * - Navegações (HTML): network-first → cache (fresco online, abre offline).
 * - Demais GET same-origin (_next, ícones, RSC): stale-while-revalidate.
 * - Cross-origin (API NestJS) não é interceptado — quem trata o offline de
 *   escrita é o outbox (IndexedDB).
 */
const CACHE = "hu360-comboio-v1";
const FALLBACK = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(FALLBACK))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API e externos passam direto

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || (await caches.match(FALLBACK)) || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const rede = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || rede;
    }),
  );
});
