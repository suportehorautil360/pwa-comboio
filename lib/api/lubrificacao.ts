/** Lubrificação (engraxe) — POST /lubrificacoes (NestJS). */
import { api } from "./client";

export type ReadingUnit = "h" | "km";

/** Pontos engraxáveis (valores aceitos pelo back) + rótulo PT. */
export const PONTOS_ENGRAXE: { value: string; label: string }[] = [
  { value: "boomPins", label: "Pinos da lança" },
  { value: "bucket", label: "Caçamba / concha" },
  { value: "articulation", label: "Articulação" },
  { value: "axles", label: "Eixos" },
  { value: "driveshaft", label: "Cardã" },
  { value: "bearings", label: "Rolamentos" },
];

export interface CriarLubrificacaoPayload {
  prefeituraId: string;
  plateOrChassis: string;
  comboistaNome: string;
  reading: number;
  readingUnit: ReadingUnit;
  greasedPoints: string[];
  observation?: string;
  latitude: number;
  longitude: number;
}

export async function criarLubrificacao(
  payload: CriarLubrificacaoPayload,
): Promise<void> {
  await api.post("/lubrificacoes", payload);
}
