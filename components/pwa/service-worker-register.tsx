"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (/sw.js) — só em produção, pra não atrapalhar o
 * HMR do `next dev`. Habilita o app-shell offline.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => undefined);
  }, []);

  return null;
}
