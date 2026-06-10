/** Abonos por prefeitura — módulo `abonos` do back-360-. */
import { api } from "./client";

export interface Abono {
  id: string;
  prefeituraId: string;
  /** CPF do funcionário, só dígitos. */
  funcionarioCpf: string;
  funcionarioNome: string;
  /** Data abonada no formato YYYY-MM-DD (local). */
  data: string;
  motivo?: string | null;
  createdAt?: string;
}

export const abonosApi = {
  /** Abonos da prefeitura; lista vazia quando indisponível. */
  async listar(prefeituraId: string): Promise<Abono[]> {
    try {
      const r = await api.get<{ data: Abono[] }>(`/abonos/${prefeituraId}`);
      return r.data ?? [];
    } catch {
      return [];
    }
  },
};
