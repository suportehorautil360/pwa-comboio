/** Reabastecimento do comboio — POST /reabastecimentos (NestJS). */
import { api } from "./client";

export type ReabastecimentoSource = "gasStation" | "farmTank" | "distributor";

/** Origens da carga (valores do back) + rótulo PT. */
export const ORIGENS_CARGA: { value: ReabastecimentoSource; label: string }[] = [
  { value: "gasStation", label: "Posto de combustível" },
  { value: "farmTank", label: "Tanque da fazenda" },
  { value: "distributor", label: "Distribuidora" },
];

export interface CriarReabastecimentoPayload {
  prefeituraId: string;
  sourceType: ReabastecimentoSource;
  receivedLiters: number;
  invoiceNumber?: string;
}

export async function criarReabastecimento(
  payload: CriarReabastecimentoPayload,
): Promise<void> {
  await api.post("/reabastecimentos", payload);
}
