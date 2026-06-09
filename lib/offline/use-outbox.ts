"use client";

import { useEffect, useState } from "react";

import {
  flushOutbox,
  getCounts,
  subscribe,
  type OutboxCounts,
} from "./outbox";

const VAZIO: OutboxCounts = { pendentes: 0, falhos: 0 };

/**
 * Contadores do outbox (pendentes/falhos) e disparo da sincronização —
 * ao montar, quando a rede volta e a cada 30s.
 */
export function useOutbox(): OutboxCounts {
  const [counts, setCounts] = useState<OutboxCounts>(VAZIO);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      void getCounts().then((c) => {
        if (ativo) setCounts(c);
      });
    };

    const unsub = subscribe(atualizar);
    atualizar();
    void flushOutbox();

    const aoVoltarRede = () => void flushOutbox();
    window.addEventListener("online", aoVoltarRede);
    const intervalo = window.setInterval(() => void flushOutbox(), 30_000);

    return () => {
      ativo = false;
      unsub();
      window.removeEventListener("online", aoVoltarRede);
      window.clearInterval(intervalo);
    };
  }, []);

  return counts;
}
