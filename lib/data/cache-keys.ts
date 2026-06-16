/**
 * Construtores das chaves do cache de leitura — FONTE ÚNICA, usada tanto pelos
 * hooks ({@link ../data/queries}) quanto pelo orquestrador ({@link ./sync}).
 * Centralizar aqui garante que o pré-aquecimento grava na mesma chave que a tela
 * lê (senão o orquestrar encheria uma chave e a tela leria outra, vazia).
 */
export const cacheKeys = {
  comboios: (p?: string, f?: string) =>
    p && f ? `comboios:${p}:${f}` : null,
  equipamentos: (p?: string) => (p ? `equipamentos:${p}` : null),
  postos: (p?: string) => (p ? `postos:${p}` : null),
  ultimos: (p?: string, n = 6) => (p ? `ultimos:${p}:${n}` : null),
  historico: (p?: string) => (p ? `historico:${p}` : null),
  timeRecords: (p?: string) => (p ? `time-records:${p}` : null),
  escala: (p?: string) => (p ? `escala:${p}` : null),
  abonos: (p?: string) => (p ? `abonos:${p}` : null),
  empresa: (p?: string) => (p ? `empresa:${p}` : null),
  solicitacoes: (p?: string) => (p ? `solicitacoes:${p}` : null),
};
