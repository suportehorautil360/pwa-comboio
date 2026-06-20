"use client";

import { useEffect } from "react";

import { syncAll } from "@/lib/data/sync";
import { getSessionUser } from "@/lib/session";

/**
 * Sincronização em background do app inteiro. Montado uma vez no layout, mantém
 * os caches frescos sem depender de a tela estar aberta:
 * - ao abrir o app e a cada 5 min (foreground) → revalida o que venceu;
 * - ao reconectar (`online`) e ao voltar o foco → revalida tudo (force).
 * O `syncAll` também esvazia a outbox. Sem operador logado, é no-op.
 */
export function SyncManager() {
  useEffect(() => {
    const run = (force = false) => void syncAll(getSessionUser(), { force });
    run();

    const onOnline = () => run(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") run(true);
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => run(), 5 * 60_000);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
