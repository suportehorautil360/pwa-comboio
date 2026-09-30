/**
 * Lógica pura do espelho de ponto por período (intervalo de datas).
 * Reaproveita os cálculos de horas. Sem React/DOM. Portado do checklist.
 */
import type { Abono } from "../api/abonos";
import type { Escala } from "../api/escala";
import type { PontoRegistro } from "../api/ponto";
import { limparCpf } from "./cpf";
import { fmtMin, minutosPrevistos, minutosTrabalhados } from "./horas";

export const ESPELHO_COLUNAS = [
  "Dia",
  "Entrada",
  "Almoço",
  "Volta",
  "Saída",
  "Trab.",
  "Prev.",
  "Saldo",
];
export const ESPELHO_PESOS = [3, 2, 2, 2, 2, 2, 2, 2];

function diaLocal(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isoData(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

/** Datas (yyyy-mm-dd) abonadas do funcionário dentro do intervalo [de, ate]. */
export function abonosNoPeriodo(
  abonos: Abono[] | undefined,
  cpfRaw: string | undefined,
  de: string,
  ate: string,
): Map<string, string | null | undefined> {
  const out = new Map<string, string | null | undefined>();
  const cpf = limparCpf(cpfRaw ?? "");
  if (!cpf || !abonos?.length) return out;
  for (const a of abonos) {
    if (limparCpf(a.funcionarioCpf) !== cpf) continue;
    if (a.data >= de && a.data <= ate) out.set(a.data, a.motivo);
  }
  return out;
}

/**
 * Agrupa as batidas (já filtradas pelo funcionário) por dia dentro do
 * intervalo, incluindo dias só com abono e — se `hoje` for informado — as
 * faltas (dias sem batida até hoje).
 */
export function diasNoPeriodo(
  batidas: PontoRegistro[],
  abonosDias: Map<string, unknown>,
  de: string,
  ate: string,
  hoje?: string,
): [string, PontoRegistro[]][] {
  const map = new Map<string, PontoRegistro[]>();
  if (hoje) {
    const fim = hoje < ate ? hoje : ate;
    const cur = new Date(`${de}T00:00:00`);
    const end = new Date(`${fim}T00:00:00`);
    while (cur <= end) {
      map.set(isoData(cur), []);
      cur.setDate(cur.getDate() + 1);
    }
  }
  for (const b of batidas) {
    const dia = diaLocal(b.timestampOriginal);
    if (dia < de || dia > ate) continue;
    const arr = map.get(dia) ?? [];
    arr.push(b);
    map.set(dia, arr);
  }
  for (const data of abonosDias.keys()) {
    if (data >= de && data <= ate && !map.has(data)) map.set(data, []);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Monta as linhas + a linha de totais do espelho a partir dos dias. */
export function construirEspelho(
  dias: [string, PontoRegistro[]][],
  abonosDias: Map<string, unknown>,
  escala: Escala | null,
): { linhas: (string | number)[][]; totais: (string | number)[] } {
  let trabTotal = 0;
  let prevTotal = 0;
  const linhas = dias.map(([dia, bs]) => {
    const tipos: Record<string, string> = {};
    for (const b of bs) tipos[b.tipo] = horaDe(b.timestampOriginal);
    const trabBruto = minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
    const prev = minutosPrevistos(escala, dia);
    const ehAbonado = bs.length === 0 && abonosDias.has(dia);
    const trab = ehAbonado ? prev : trabBruto;
    const saldo = trab - prev;
    trabTotal += trab;
    prevTotal += prev;
    return [
      dia.split("-").reverse().join("/") + (ehAbonado ? " (Abonado)" : ""),
      tipos.entrada ?? "—",
      tipos.almoco ?? "—",
      tipos.volta ?? "—",
      tipos.saida ?? "—",
      fmtMin(trab),
      fmtMin(prev),
      (saldo >= 0 ? "+" : "") + fmtMin(saldo),
    ];
  });
  const saldoTotal = trabTotal - prevTotal;
  const totais = [
    "TOTAIS",
    "",
    "",
    "",
    "",
    fmtMin(trabTotal),
    fmtMin(prevTotal),
    (saldoTotal >= 0 ? "+" : "") + fmtMin(saldoTotal),
  ];
  return { linhas, totais };
}

/** yyyy-mm-dd → dd/mm/yyyy (para exibição). */
export function dataBr(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso.split("-").reverse().join("/")
    : iso;
}

export type PeriodoPreset = "hoje" | "semana" | "mes" | "mes-anterior";

/** Intervalo [de, ate] (yyyy-mm-dd) de um atalho, relativo a `hoje`. */
export function intervaloPreset(
  preset: PeriodoPreset,
  hoje: Date,
): { de: string; ate: string } {
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const d = hoje.getDate();
  switch (preset) {
    case "hoje": {
      const s = isoData(hoje);
      return { de: s, ate: s };
    }
    case "semana": {
      const dow = (hoje.getDay() + 6) % 7; // 0 = segunda
      return {
        de: isoData(new Date(y, m, d - dow)),
        ate: isoData(new Date(y, m, d - dow + 6)),
      };
    }
    case "mes":
      return {
        de: isoData(new Date(y, m, 1)),
        ate: isoData(new Date(y, m + 1, 0)),
      };
    case "mes-anterior":
      return {
        de: isoData(new Date(y, m - 1, 1)),
        ate: isoData(new Date(y, m, 0)),
      };
  }
}

/** Quantidade de dias no intervalo [de, ate] inclusivo (0 se inválido). */
export function diasNoIntervalo(de: string, ate: string): number {
  if (!de || !ate || de > ate) return 0;
  const a = new Date(`${de}T00:00:00`);
  const b = new Date(`${ate}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/** Abonos do funcionário (por CPF) no mês `yyyy-mm`: data → motivo. */
export function abonosDoMes(
  abonos: Abono[] | undefined,
  cpfRaw: string | undefined,
  mes: string,
): Map<string, string | null | undefined> {
  const out = new Map<string, string | null | undefined>();
  const cpf = limparCpf(cpfRaw ?? "");
  if (!cpf || !abonos?.length) return out;
  for (const a of abonos) {
    if (limparCpf(a.funcionarioCpf) !== cpf) continue;
    if (!a.data.startsWith(mes)) continue;
    out.set(a.data, a.motivo);
  }
  return out;
}

/**
 * Dias do mês `yyyy-mm` até `agora` (mês futuro: nenhum; mês passado: todos),
 * com as batidas de cada um e os dias só com abono. Mais recente primeiro — é
 * a ordem da lista do espelho.
 */
export function diasDoMes<T extends PontoRegistro>(
  batidas: T[],
  abonosDias: Map<string, unknown>,
  mes: string,
  agora: Date,
): [string, T[]][] {
  const map = new Map<string, T[]>();
  const [ano, mesNum] = mes.split("-").map(Number);
  const ehFuturo =
    ano > agora.getFullYear() ||
    (ano === agora.getFullYear() && mesNum > agora.getMonth() + 1);
  const ehMesAtual =
    ano === agora.getFullYear() && mesNum === agora.getMonth() + 1;
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  const diaLimite = ehFuturo ? 0 : ehMesAtual ? agora.getDate() : ultimoDia;
  for (let d = 1; d <= diaLimite; d++) {
    map.set(`${mes}-${String(d).padStart(2, "0")}`, []);
  }
  for (const b of batidas) {
    const dia = diaLocal(b.timestampOriginal);
    if (!dia.startsWith(mes)) continue;
    const arr = map.get(dia) ?? [];
    arr.push(b);
    map.set(dia, arr);
  }
  for (const data of abonosDias.keys()) {
    if (!map.has(data)) map.set(data, []);
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
}

/**
 * Trabalhado, previsto e saldo (minutos) de uma lista de dias. Dia abonado com
 * menos horas que o previsto conta como previsto. É o card de totais do
 * espelho e o "Saldo do mês" do Meu ponto — o mesmo número nas duas telas.
 */
export function totaisDosDias(
  dias: [string, PontoRegistro[]][],
  abonosDias: Map<string, unknown>,
  escala: Escala | null,
): { trab: number; prev: number; saldo: number } {
  let trab = 0;
  let prev = 0;
  for (const [dia, bs] of dias) {
    const trabBruto = minutosTrabalhados(bs, escala?.almocoMinutos ?? 0);
    const previsto = minutosPrevistos(escala, dia);
    const abonado = abonosDias.has(dia) && trabBruto < previsto;
    trab += abonado ? previsto : trabBruto;
    prev += previsto;
  }
  return { trab, prev, saldo: trab - prev };
}
