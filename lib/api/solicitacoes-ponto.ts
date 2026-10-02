/**
 * Solicitações de ajuste de ponto (módulo solicitacoes-ponto do back-360-).
 * Um recurso atende incluir / cancelar / corrigir / abono / mensagem.
 */
import { submit, type SubmitResult } from "../offline/outbox";
import { api } from "./client";
import type { TipoPonto } from "./ponto";

export type TipoSolicitacao =
  | "incluir"
  | "cancelar"
  /** Corrigir o horário de uma batida: `batidaId` + `timestampOriginal` (o novo). */
  | "corrigir"
  | "abono"
  | "mensagem";
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
  /** Para tipo "incluir": qual batida do dia (default "entrada"). */
  tipoBatida?: TipoPonto | null;
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
  /** Para tipo "incluir": qual batida do dia (default "entrada"). */
  tipoBatida?: TipoPonto;
  observacao?: string;
  anexoDataUrl?: string;
  anexoNome?: string;
}

export const solicitacoesPontoApi = {
  /**
   * Cria uma solicitação de ajuste de ponto. Offline-first: passa pelo outbox,
   * então funciona sem rede e sincroniza sozinho. Devolve `{ synced }` — a tela
   * mostra a mensagem certa ("enviada ao gestor" vs "salva no aparelho").
   */
  async criar(input: CriarSolicitacaoInput): Promise<SubmitResult> {
    return submit("solicitacao", input);
  },

  /**
   * As solicitações de QUEM está logado. O recorte vai na consulta (`?cpf=` ou,
   * sem CPF, `?nome=`): sem ele a rota devolve as da empresa inteira — nome,
   * CPF e atestado dos colegas — e isso ficaria guardado neste aparelho.
   */
  async listar(
    prefeituraId: string,
    quem: { cpf?: string; nome?: string },
  ): Promise<SolicitacaoPonto[]> {
    const cpf = (quem.cpf ?? "").replace(/\D/g, "");
    const recorte = cpf
      ? `cpf=${cpf}`
      : `nome=${encodeURIComponent((quem.nome ?? "").trim())}`;
    const r = await api.get<{ data: SolicitacaoPonto[] }>(
      `/solicitacoes-ponto/${prefeituraId}?${recorte}`,
    );
    return r.data ?? [];
  },
};
