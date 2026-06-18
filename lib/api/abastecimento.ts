/** Abastecimento — /abastecimentos, /equipamentos, /postos (NestJS). */
import { api } from "./client";

export type MeasurementType = "horimetro" | "hodometro";

export interface EquipamentoApi {
  id: string;
  descricao?: string;
  modelo?: string;
  chassis?: string;
  placa?: string;
  tipo?: string;
  status?: string;
  /** Capacidade do tanque (L); 0/ausente = sem limite. */
  capacidadeTanque?: number;
}

export interface PostoApi {
  id: string;
  name: string;
  code?: string;
  cidadeUf?: string;
}

export interface CriarAbastecimentoPayload {
  prefeituraId: string;
  plateOrChassis: string;
  liters: number;
  measurementType: MeasurementType;
  currentReading: number;
  meterPhoto?: string;
  pricePerLiter?: number;
  total?: number;
  postoId?: string;
  latitude: number;
  longitude: number;
}

export async function listarEquipamentos(
  prefeituraId: string,
): Promise<EquipamentoApi[]> {
  const r = await api.get<{ data: EquipamentoApi[] }>(
    `/equipamentos/${prefeituraId}`,
  );
  return r.data ?? [];
}

export async function listarPostos(prefeituraId: string): Promise<PostoApi[]> {
  const r = await api.get<{ data: PostoApi[] }>(`/postos/${prefeituraId}`);
  return r.data ?? [];
}

export async function criarAbastecimento(
  payload: CriarAbastecimentoPayload,
): Promise<void> {
  await api.post("/abastecimentos", payload);
}

/**
 * Maior leitura (horímetro/km) já registrada para o equipamento — para validar a
 * próxima antes de enviar. `null` = sem registro anterior (qualquer valor vale)
 * ou equipamento fora do cadastro.
 */
export async function ultimaLeituraAbastecimento(
  prefeituraId: string,
  plateOrChassis: string,
  measurementType: MeasurementType,
): Promise<number | null> {
  const qs = new URLSearchParams({ plateOrChassis, measurementType });
  const r = await api.get<{ data: { ultimaLeitura: number | null } }>(
    `/abastecimentos/ultima-leitura/${prefeituraId}?${qs.toString()}`,
  );
  return r.data?.ultimaLeitura ?? null;
}
