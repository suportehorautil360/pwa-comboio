/**
 * Solicitações de ajuste de ponto (módulo solicitacoes-ponto do back-360-).
 * Um recurso atende incluir / cancelar / abono / mensagem.
 */
import { api } from "./client";

export type TipoSolicitacao = "incluir" | "cancelar" | "abono" | "mensagem";
export type StatusSolicitacao = "pendente" | "aprovado" | "reprovado";

export interface SolicitacaoPonto {
  id: string;
  tipo: TipoSolicitacao;
  status: StatusSolicitacao;
  prefeituraId: string;
  name: string;
  cpf?: string | null;
  batidaId?: string | null;
  data?: string | null;
  timestampOriginal?: string | null;
  observacao?: string | null;
  anexoDataUrl?: string | null;
  anexoNome?: string | null;
  motivoReprovacao?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CriarSolicitacaoInput {
  tipo: TipoSolicitacao;
  prefeituraId: string;
  name: string;
  cpf?: string;
  batidaId?: string;
  data?: string;
  timestampOriginal?: string;
  observacao?: string;
  anexoDataUrl?: string;
  anexoNome?: string;
}

export const solicitacoesPontoApi = {
  async criar(input: CriarSolicitacaoInput): Promise<SolicitacaoPonto> {
    const r = await api.post<{ data: SolicitacaoPonto }>(
      "/solicitacoes-ponto",
      input,
    );
    return r.data;
  },

  async listar(prefeituraId: string): Promise<SolicitacaoPonto[]> {
    const r = await api.get<{ data: SolicitacaoPonto[] }>(
      `/solicitacoes-ponto/${prefeituraId}`,
    );
    return r.data ?? [];
  },
};
