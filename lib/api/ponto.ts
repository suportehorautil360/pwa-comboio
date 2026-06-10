/**
 * Ponto do operador (módulo time-records do back-360-, Portaria 671).
 * A batida é gravada na outbox (offline-first) e enviada para POST /time-records.
 * A leitura (folha/histórico/comprovante) usa GET /time-records/:prefeituraId.
 */
import { api } from "./client";

export type TipoPonto = "entrada" | "almoco" | "volta" | "saida";

/** Ordem e rótulos da folha do dia. */
export const TIPOS_PONTO: { tipo: TipoPonto; label: string }[] = [
  { tipo: "entrada", label: "Entrada" },
  { tipo: "almoco", label: "Saída p/ almoço" },
  { tipo: "volta", label: "Volta do almoço" },
  { tipo: "saida", label: "Saída" },
];

/** Corpo do POST /time-records (CreateTimeRecordDto). */
export interface BaterPontoPayload {
  name: string;
  /** Selfie no momento da batida, como data URL base64. */
  photo: string;
  prefeituraId: string;
  /** Horário da batida no dispositivo (ISO 8601). */
  timestampOriginal: string;
  tipo: TipoPonto;
  /** CPF do trabalhador — compõe o identificador no ledger. */
  cpf?: string;
}

/** Natureza do registro no ledger imutável (Portaria 671). */
export type RegistroLedger = "original" | "ajuste" | "cancelamento";

export interface PontoRegistro {
  id: string;
  name: string;
  prefeituraId: string;
  timestampOriginal: string;
  tipo: TipoPonto;
  photo?: string;
  status?: "pendente" | "aprovado" | "reprovado" | "cancelado";
  motivoReprovacao?: string;
  createdAt?: string;
  cpf?: string | null;
  // --- Ledger (Portaria 671) ---
  /** Número Sequencial de Registro (por prefeitura). */
  nsr?: number;
  /** Hash SHA-256 encadeado ao registro anterior. */
  hash?: string;
  hashAnterior?: string;
  registro?: RegistroLedger;
  refNsr?: number | null;
  refId?: string;
  aplicado?: boolean;
  motivo?: string | null;
}

interface RespostaLista {
  data: PontoRegistro[];
  message?: string;
}

export const pontoApi = {
  /** Todas as batidas da prefeitura (o front filtra pelo operador). */
  async listar(prefeituraId: string): Promise<PontoRegistro[]> {
    const r = await api.get<RespostaLista>(`/time-records/${prefeituraId}`);
    return r.data ?? [];
  },
};
