/** Dashboard do comboista — tanque (/tanks) + últimos lançamentos (/movimentacoes). */
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

/** Tanque do comboio da prefeitura (pega o primeiro/ativo). */
export async function getTanqueComboio(
  prefeituraId: string,
): Promise<TanqueComboio | null> {
  const r = await api.get<{ data: TanqueComboio[] }>(`/tanks/${prefeituraId}`);
  return r.data?.[0] ?? null;
}

/** Últimos lançamentos (abastecimento + lubrificação + reabastecimento). */
export async function getUltimosLancamentos(
  prefeituraId: string,
  limite = 6,
): Promise<LancamentoItem[]> {
  const r = await api.get<{ groups?: { items?: LancamentoItem[] }[] }>(
    `/movimentacoes/${prefeituraId}`,
  );
  const itens = (r.groups ?? []).flatMap((g) => g.items ?? []);
  return itens.slice(0, limite);
}
