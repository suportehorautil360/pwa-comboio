/**
 * Ponto do operador (módulo time-records do back-360-, Portaria 671).
 * A batida é gravada na outbox (offline-first) e enviada para POST /time-records.
 */

export type TipoPonto = "entrada" | "almoco" | "volta" | "saida";

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
