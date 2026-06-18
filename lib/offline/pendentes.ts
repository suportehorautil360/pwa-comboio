/**
 * Otimismo de UI: traduz os itens ainda na fila (outbox) para o que as telas
 * mostram localmente, antes de sincronizar. Assim o operador vê o lançamento
 * "na hora" — a batida na folha, o saldo do tanque já descontado. Tudo puro.
 */
import type { PontoRegistro, TipoPonto } from "../api/ponto";
import type { OutboxItem } from "../db";

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Batidas de ponto ainda na fila → `PontoRegistro` sintéticos (id = id do item
 * do outbox), marcadas como `pendente`. Não inclui as em erro (dead-letter).
 */
export function batidasPendentes(itens: OutboxItem[]): PontoRegistro[] {
  return itens
    .filter((i) => i.kind === "ponto" && !i.failed)
    .map((i) => {
      const p = (i.payload ?? {}) as Record<string, unknown>;
      return {
        id: i.id,
        name: str(p.name),
        prefeituraId: str(p.prefeituraId),
        timestampOriginal:
          str(p.timestampOriginal) || new Date(i.createdAt).toISOString(),
        tipo: (str(p.tipo) || "entrada") as TipoPonto,
        cpf: str(p.cpf) || undefined,
        status: "pendente",
      };
    });
}

/**
 * Mescla as batidas pendentes às do servidor sem duplicar: descarta a pendente
 * se o servidor já tem aquele tipo no mesmo dia (a do servidor é a verdade).
 */
export function mesclarBatidas(
  servidor: PontoRegistro[],
  pendentes: PontoRegistro[],
): PontoRegistro[] {
  const chave = (r: PontoRegistro) =>
    `${r.tipo}:${(r.timestampOriginal ?? "").slice(0, 10)}`;
  const noServidor = new Set(servidor.map(chave));
  const extras = pendentes.filter((p) => !noServidor.has(chave(p)));
  return [...servidor, ...extras];
}

/**
 * Delta (litros) a aplicar no saldo do comboio pelas operações ainda na fila:
 * reabastecimento soma; abastecimento que sai do tanque (sem posto) subtrai.
 * Abastecimento de posto não mexe no tanque do comboio.
 */
export function saldoPendenteDelta(itens: OutboxItem[]): number {
  let delta = 0;
  for (const i of itens) {
    if (i.failed) continue;
    const p = (i.payload ?? {}) as Record<string, unknown>;
    if (i.kind === "reabastecimento") delta += num(p.receivedLiters);
    else if (i.kind === "abastecimento" && !p.postoId) delta -= num(p.liters);
  }
  return delta;
}

/**
 * Saldo otimista do tanque: o saldo do servidor mais o delta da fila ainda não
 * sincronizada. Nunca negativo. É o que as telas devem usar para limitar — assim
 * vários lançamentos offline seguidos já contam uns com os outros.
 */
export function saldoOtimista(
  currentVolume: number,
  itens: OutboxItem[],
): number {
  return Math.max(0, num(currentVolume) + saldoPendenteDelta(itens));
}

/**
 * Quanto ainda cabe no tanque: capacidade − saldo otimista (nunca negativo).
 * Capacidade ausente/0 ⇒ `Infinity` (sem limite configurado), espelhando o back.
 */
export function capacidadeDisponivel(
  capacity: number,
  currentVolume: number,
  itens: OutboxItem[],
): number {
  const cap = num(capacity);
  if (cap <= 0) return Infinity;
  return Math.max(0, cap - saldoOtimista(currentVolume, itens));
}
