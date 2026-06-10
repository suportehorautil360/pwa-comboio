/**
 * Resolve o ledger imutável de ponto (Portaria 671) numa visão "efetiva" para
 * exibição, SEM alterar os registros de origem. Aplica correções/cancelamentos
 * aprovados pelo RH e marca correções pendentes. Portado do app de checklist.
 */
import type { PontoRegistro } from "../api/ponto";

export interface BatidaEfetiva extends PontoRegistro {
  /** Há uma correção ainda não aprovada pelo RH para esta batida. */
  ajustePendente?: boolean;
  ajustePendenteId?: string;
  /** Horário corrigido aguardando aprovação (ISO) — só para exibir o aviso. */
  horarioAjustePendente?: string;
  motivoAjustePendente?: string | null;
  /** Quando uma correção aplicada trocou o horário, o horário original (ISO). */
  horarioAnterior?: string;
}

function natureza(r: PontoRegistro): NonNullable<PontoRegistro["registro"]> {
  return r.registro ?? "original";
}

function mira(ref: PontoRegistro, alvo: PontoRegistro): boolean {
  if (ref.refNsr != null && alvo.nsr != null) return ref.refNsr === alvo.nsr;
  if (ref.refId) return ref.refId === alvo.id;
  return false;
}

function ehInclusao(r: PontoRegistro): boolean {
  return natureza(r) === "ajuste" && r.refNsr == null && !r.refId;
}

export function resolverLedger(registros: PontoRegistro[]): BatidaEfetiva[] {
  const originais: PontoRegistro[] = [];
  const correcoes: PontoRegistro[] = [];
  const cancelamentos: PontoRegistro[] = [];
  const inclusoes: PontoRegistro[] = [];

  for (const r of registros) {
    const nat = natureza(r);
    if (nat === "cancelamento") cancelamentos.push(r);
    else if (ehInclusao(r)) inclusoes.push(r);
    else if (nat === "ajuste") correcoes.push(r);
    else originais.push(r);
  }

  const efetivas: BatidaEfetiva[] = [];

  for (const o of originais) {
    if (o.status === "cancelado") continue;
    const cancelada = cancelamentos.some(
      (c) => c.aplicado !== false && mira(c, o),
    );
    if (cancelada) continue;

    const meus = correcoes.filter((a) => mira(a, o));
    const aplicadas = meus.filter((a) => a.aplicado === true).sort(ordenar);
    const pendentes = meus.filter(
      (a) => a.aplicado !== true && !a.motivoReprovacao,
    );

    if (aplicadas.length) {
      const corr = aplicadas[aplicadas.length - 1];
      efetivas.push({
        ...o,
        timestampOriginal: corr.timestampOriginal,
        horarioAnterior: o.timestampOriginal,
      });
    } else if (pendentes.length) {
      const corr = pendentes.sort(ordenar)[pendentes.length - 1];
      efetivas.push({
        ...o,
        ajustePendente: true,
        ajustePendenteId: corr.id,
        horarioAjustePendente: corr.timestampOriginal,
        motivoAjustePendente: corr.motivo ?? null,
      });
    } else {
      efetivas.push({ ...o });
    }
  }

  for (const inc of inclusoes) {
    if (inc.aplicado === false) continue;
    efetivas.push({ ...inc });
  }

  return efetivas;
}

function ordenar(a: PontoRegistro, b: PontoRegistro): number {
  if (a.nsr != null && b.nsr != null) return a.nsr - b.nsr;
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}
