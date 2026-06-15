/**
 * Comboios do comboista — equipamentos `tipo: Comboio` em que o funcionário é
 * condutor responsável, com o tanque resolvido. Alimenta o seletor de comboio
 * (home/abastecer/reabastecer): cada turno escolhe qual comboio opera.
 */
import { api } from "./client";
import type { TanqueComboio } from "./dashboard";

export interface ComboioItem {
  id: string;
  descricao: string;
  placa: string;
  chassis: string;
  tank: TanqueComboio;
}

/** Comboios em que o motorista é condutor (GET /equipamentos/comboios/:pref/:motorista). */
export async function listarComboiosDoMotorista(
  prefeituraId: string,
  funcionarioId: string,
): Promise<ComboioItem[]> {
  const r = await api.get<{ data: ComboioItem[] }>(
    `/equipamentos/comboios/${prefeituraId}/${funcionarioId}`,
  );
  return r.data ?? [];
}
