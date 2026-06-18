"use client";

import { useEffect, useMemo, useState } from "react";

import {
  flushOutbox,
  getCounts,
  itemParaLancamento,
  listItems,
  subscribe,
  type LancamentoPendente,
  type OutboxCounts,
  type OutboxItem,
} from "./outbox";
import { saldoOtimista } from "./pendentes";

const VAZIO: OutboxCounts = { pendentes: 0, falhos: 0 };

/** Kinds de ponto — sincronizam pela outbox mas não são lançamentos de frota. */
const PONTO_KINDS = new Set<string>(["ponto", "editar-ponto", "solicitacao"]);

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

/**
 * Itens da fila (pendentes/erro) para exibir nas listas. Só leitura — o
 * disparo da sincronização fica no useOutbox (montado no FieldHeader).
 */
export function useOutboxItems(): LancamentoPendente[] {
  const [items, setItems] = useState<LancamentoPendente[]>([]);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      void listItems().then((its) => {
        // Ponto (batida/ajuste/solicitação) sincroniza pela mesma outbox, mas
        // não é um lançamento de frota — fica fora deste feed.
        if (ativo)
          setItems(
            its
              .filter((i) => !PONTO_KINDS.has(i.kind))
              .map(itemParaLancamento),
          );
      });
    };
    const unsub = subscribe(atualizar);
    atualizar();
    return () => {
      ativo = false;
      unsub();
    };
  }, []);

  return items;
}

/**
 * Itens crus da fila (com payload), reativos. Para o otimismo de UI — mesclar
 * batidas pendentes na folha do ponto, descontar o saldo do tanque, etc.
 */
export function useOutboxRaw(): OutboxItem[] {
  const [items, setItems] = useState<OutboxItem[]>([]);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      void listItems().then((its) => {
        if (ativo) setItems(its);
      });
    };
    const unsub = subscribe(atualizar);
    atualizar();
    return () => {
      ativo = false;
      unsub();
    };
  }, []);

  return items;
}

/**
 * Saldo otimista do tanque (servidor + fila pendente), reativo. Use para mostrar
 * o saldo "na hora" e para limitar os lançamentos antes da sincronização.
 */
export function useSaldoOtimista(currentVolume: number): number {
  const raw = useOutboxRaw();
  return useMemo(() => saldoOtimista(currentVolume, raw), [currentVolume, raw]);
}

/**
 * Itens em erro definitivo (dead-letter), de qualquer tipo (frota e ponto) —
 * para a UI de reprocesso/descarte. Reage às mudanças da fila.
 */
export function useOutboxFailed(): LancamentoPendente[] {
  const [items, setItems] = useState<LancamentoPendente[]>([]);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      void listItems().then((its) => {
        if (ativo) setItems(its.filter((i) => i.failed).map(itemParaLancamento));
      });
    };
    const unsub = subscribe(atualizar);
    atualizar();
    return () => {
      ativo = false;
      unsub();
    };
  }, []);

  return items;
}
