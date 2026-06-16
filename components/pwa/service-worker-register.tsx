"use client";

import { useEffect } from "react";

import { flushOutbox } from "@/lib/offline/outbox";

/**
 * Registra o service worker (/sw.js) — só em produção, pra não atrapalhar o
 * HMR do `next dev` (que usa Turbopack, sem o SW do Serwist). Habilita o
 * app-shell offline.
 *
 * Atualização AUTOMÁTICA: o SW usa `skipWaiting: true` + `clientsClaim: true`,
 * então o SW novo assume sozinho. Aqui, quando ele assume (`controllerchange`),
 * recarregamos a página UMA vez pra usar os assets novos — exceto na 1ª
 * instalação (não havia controlador antes). Sem prompt: assim ninguém fica
 * preso num SW antigo/quebrado (que no iOS standalone "escapa" pro Safari).
 *
 * Também ouve `FLUSH_OUTBOX` do SW (Background Sync) e esvazia a fila na página,
 * onde token + Dexie + api client estão disponíveis.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const sw = navigator.serviceWorker;
    // Havia um SW controlando ao carregar? Então um controllerchange depois é
    // ATUALIZAÇÃO (recarrega). Sem controlador = 1ª instalação (não recarrega).
    const tinhaControlador = !!sw.controller;
    let recarregando = false;

    sw.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(
      () => undefined,
    );

    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === "FLUSH_OUTBOX") {
        void flushOutbox();
      }
    };
    sw.addEventListener("message", onMessage);

    const onControllerChange = () => {
      if (recarregando || !tinhaControlador) return;
      recarregando = true;
      window.location.reload();
    };
    sw.addEventListener("controllerchange", onControllerChange);

    return () => {
      sw.removeEventListener("message", onMessage);
      sw.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
