"use client";

import { useEffect, useState } from "react";

/**
 * Relógio grande do ponto (hora local, atualiza a cada segundo), no mesmo
 * formato do PWA do checklist: mostrador redondo com os segundos e, na folha,
 * a data por extenso logo abaixo.
 *
 * Começa vazio e só lê o relógio no cliente — a hora do servidor no HTML
 * pré-renderizado divergiria da do aparelho e quebraria a hidratação.
 */
export function RelogioAoVivo({ comData = false }: { comData?: boolean }) {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setAgora(new Date());
    queueMicrotask(tick);
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div
        role="timer"
        aria-live="off"
        className="grid size-44 place-items-center rounded-full border-2 border-border text-3xl font-bold tabular-nums tracking-tight"
      >
        {agora ? agora.toLocaleTimeString("pt-BR") : "--:--:--"}
      </div>
      {comData ? (
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {agora
            ? agora.toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : " "}
        </p>
      ) : null}
    </div>
  );
}
