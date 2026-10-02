/**
 * Correção de horário aguardando o RH.
 *
 * `GET /ponto/registros` devolve a folha já resolvida: horário corrigido quando
 * o RH aprovou, o batido enquanto não. O que ele NÃO diz é que há um pedido em
 * aberto — o pedido é uma solicitação (`tipo: "corrigir"`), e só vira registro
 * no ledger na aprovação. Aqui as duas listas se encontram: a batida com
 * pedido pendente ganha o selo "Ajuste pendente" e o horário pedido.
 *
 * Vale também para o pedido que ainda nem saiu do aparelho (está na fila).
 */
import type { SolicitacaoPonto } from "../api/solicitacoes-ponto";
import type { OutboxItem } from "../db";
import type { BatidaEfetiva } from "./resolver-ledger";

/** O que basta de uma solicitação para marcar a batida. */
export type PedidoDeCorrecao = Pick<
  SolicitacaoPonto,
  "id" | "tipo" | "status" | "batidaId" | "timestampOriginal" | "observacao" | "createdAt"
>;

/** Pedidos de correção ainda na fila do aparelho, como solicitações pendentes. */
export function correcoesNaFila(itens: OutboxItem[]): PedidoDeCorrecao[] {
  const pedidos: PedidoDeCorrecao[] = [];
  for (const i of itens) {
    if (i.kind !== "solicitacao" || i.failed) continue;
    const p = (i.payload ?? {}) as Record<string, unknown>;
    if (p.tipo !== "corrigir" || typeof p.batidaId !== "string") continue;
    pedidos.push({
      id: i.id,
      tipo: "corrigir",
      status: "pendente",
      batidaId: p.batidaId,
      timestampOriginal:
        typeof p.timestampOriginal === "string" ? p.timestampOriginal : null,
      observacao: typeof p.observacao === "string" ? p.observacao : null,
      createdAt: new Date(i.createdAt).toISOString(),
    });
  }
  return pedidos;
}

/**
 * Marca as batidas que têm correção pendente. O pedido aponta a batida pelo id
 * do servidor ou pelo id do aparelho (`legacyId`) — o back aceita os dois.
 * Havendo mais de um pedido em aberto para a mesma batida, vale o mais novo.
 */
export function aplicarCorrecoesPendentes(
  batidas: BatidaEfetiva[],
  pedidos: PedidoDeCorrecao[],
): BatidaEfetiva[] {
  const abertos = pedidos.filter(
    (s) =>
      s.tipo === "corrigir" &&
      s.status === "pendente" &&
      !!s.batidaId &&
      !!s.timestampOriginal,
  );
  if (abertos.length === 0) return batidas;

  return batidas.map((b) => {
    const meus = abertos
      .filter((s) => s.batidaId === b.id || (!!b.legacyId && s.batidaId === b.legacyId))
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    const pedido = meus.at(-1);
    if (!pedido) return b;
    return {
      ...b,
      ajustePendente: true,
      ajustePendenteId: pedido.id,
      horarioAjustePendente: pedido.timestampOriginal ?? undefined,
      motivoAjustePendente: pedido.observacao ?? null,
    };
  });
}
