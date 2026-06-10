/**
 * Dados da empresa por prefeitura (módulo configuracoes do back-360-).
 * Aqui só o que o comprovante de ponto (CRPT) precisa. Best-effort: se falhar,
 * o comprovante sai com "Não informado".
 */
import { api } from "./client";

export interface EmpresaConfig {
  razaoSocial?: string;
  cnpj?: string;
  /** CAEPF/CEI — inscrição alternativa para empregador sem CNPJ. */
  caepf?: string;
  cidade?: string;
  estado?: string;
}

export const configuracoesApi = {
  /** Dados da empresa para o CRPT; null quando indisponível. */
  async obterEmpresa(prefeituraId: string): Promise<EmpresaConfig | null> {
    try {
      const r = await api.get<{ data: { empresa?: EmpresaConfig } }>(
        `/configuracoes/${prefeituraId}`,
      );
      return r.data?.empresa ?? null;
    } catch {
      return null;
    }
  },
};
