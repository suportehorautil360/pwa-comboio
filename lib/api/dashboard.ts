/** Dashboard do comboista — tanque (/tanks) + histórico de lançamentos (/historico). */
import { api } from "./client";

export interface TanqueComboio {
  name: string;
  fuelType: string;
  capacity: number;
  currentVolume: number;
  percentage: number;
  status: string;
  veiculoModelo: string;
  veiculoPlaca: string;
}

export type MovimentacaoTipo =
  | "abastecimento"
  | "lubrificacao"
  | "reabastecimento";

export interface LancamentoItem {
  id: string;
  tipo: MovimentacaoTipo;
  plate: string;
  equipmentLabel: string;
  rightLabel: string;
  time: string;
}

/** Tanque de um comboio específico (GET /tanks/by-comboio/:comboioId). */
export async function getTanqueComboio(
  comboioId: string,
): Promise<TanqueComboio | null> {
  const r = await api.get<{ data: TanqueComboio | null }>(
    `/tanks/by-comboio/${comboioId}`,
  );
  return r.data ?? null;
}

export interface HistoricoSummary {
  totalLitersToday: number;
  totalAbastecimentosToday: number;
  totalEngraxeToday: number;
}

export interface HistoricoGroup {
  dateLabel: string;
  items: LancamentoItem[];
}

export interface HistoricoData {
  summary: HistoricoSummary;
  groups: HistoricoGroup[];
}

const RESUMO_VAZIO: HistoricoSummary = {
  totalLitersToday: 0,
  totalAbastecimentosToday: 0,
  totalEngraxeToday: 0,
};

/** Histórico completo (resumo do dia + lançamentos agrupados por data). */
export async function getHistorico(
  prefeituraId: string,
): Promise<HistoricoData> {
  const r = await api.get<{
    summary?: HistoricoSummary;
    groups?: HistoricoGroup[];
  }>(`/historico/${prefeituraId}`);
  return { summary: r.summary ?? RESUMO_VAZIO, groups: r.groups ?? [] };
}

/** Últimos lançamentos (abastecimento + lubrificação + reabastecimento). */
export async function getUltimosLancamentos(
  prefeituraId: string,
  limite = 6,
): Promise<LancamentoItem[]> {
  const r = await api.get<{ groups?: { items?: LancamentoItem[] }[] }>(
    `/historico/${prefeituraId}`,
  );
  const itens = (r.groups ?? []).flatMap((g) => g.items ?? []);
  return itens.slice(0, limite);
}
