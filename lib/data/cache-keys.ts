/**
 * Construtores das chaves do cache de leitura — FONTE ÚNICA, usada tanto pelos
 * hooks ({@link ../data/queries}) quanto pelo orquestrador ({@link ./sync}).
 * Centralizar aqui garante que o pré-aquecimento grava na mesma chave que a tela
 * lê (senão o orquestrar encheria uma chave e a tela leria outra, vazia).
 */

/**
 * Prefixos de chaves que não são mais gravadas. Guardavam a EMPRESA inteira
 * (batidas e solicitações de todos, com CPF e anexo) e a rota das batidas nem
 * existe mais — `limparCachesAntigos` as apaga do aparelho.
 */
export const PREFIXOS_ANTIGOS = ["time-records:", "solicitacoes:"];

/** Quem é a pessoa logada, para as chaves por pessoa. */
export function quemDaSessao(u: {
  funcionarioId?: string;
  cpf?: string;
  usuario?: string;
}): string | undefined {
  return u.funcionarioId || u.cpf || u.usuario || undefined;
}

export const cacheKeys = {
  comboios: (p?: string, f?: string) =>
    p && f ? `comboios:${p}:${f}` : null,
  equipamentos: (p?: string) => (p ? `equipamentos:${p}` : null),
  postos: (p?: string) => (p ? `postos:${p}` : null),
  ultimos: (p?: string, n = 6) => (p ? `ultimos:${p}:${n}` : null),
  historico: (p?: string) => (p ? `historico:${p}` : null),
  /**
   * Batidas de ponto — por PESSOA (`q` = funcionarioId/cpf/login), não por
   * empresa: a rota devolve só as de quem está logado, e num aparelho com mais
   * de um login a folha de um não pode aparecer para o outro.
   */
  ponto: (p?: string, q?: string) => (p && q ? `ponto:${p}:${q}` : null),
  escala: (p?: string) => (p ? `escala:${p}` : null),
  abonos: (p?: string) => (p ? `abonos:${p}` : null),
  empresa: (p?: string) => (p ? `empresa:${p}` : null),
  /** Solicitações de ponto — também por pessoa (ver `ponto`). */
  solicitacoes: (p?: string, q?: string) =>
    p && q ? `minhas-solicitacoes:${p}:${q}` : null,
};
