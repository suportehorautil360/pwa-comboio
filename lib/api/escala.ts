/** Escala (jornada) por prefeitura — módulo `escala` do back-360-. */
import { api } from "./client";

export interface Escala {
  prefeituraId: string;
  /** Início da jornada "HH:MM". */
  inicio: string;
  /** Fim da jornada "HH:MM". */
  fim: string;
  /** Dias trabalhados (0=domingo … 6=sábado). */
  diasSemana: number[];
  /** Duração do almoço em minutos. */
  almocoMinutos: number;
}

export const escalaApi = {
  /** Escala da prefeitura; null quando não configurada ou indisponível. */
  async obter(prefeituraId: string): Promise<Escala | null> {
    try {
      const r = await api.get<{ data: Escala | null }>(`/escala/${prefeituraId}`);
      return r.data ?? null;
    } catch {
      return null;
    }
  },
};
