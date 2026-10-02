/**
 * Ponto do comboísta (Portaria 671).
 *
 * O módulo `time-records` saiu do back: `/time-records` responde 404. As três
 * operações passaram para as rotas que o ponto do operador (PWA do checklist)
 * e o do mecânico já usam:
 *
 * - **bater**: `POST /checklist/bater-ponto` (mesmo corpo de antes; a
 *   `Idempotency-Key` é obrigatória e vira a identidade da batida);
 * - **ler a folha**: `GET /ponto/registros?de&ate` — só as batidas da pessoa
 *   do token, já com o ledger resolvido pelo servidor;
 * - **pedir correção**: `POST /solicitacoes-ponto` com `tipo: "corrigir"`.
 *
 * A batida é gravada na outbox (offline-first) e sobe sozinha.
 */
import { submit, type SubmitResult } from "../offline/outbox";
import { getSessionUser } from "../session";
import { api } from "./client";

export type TipoPonto = "entrada" | "almoco" | "volta" | "saida";

/** Ordem e rótulos da folha do dia. */
export const TIPOS_PONTO: { tipo: TipoPonto; label: string }[] = [
  { tipo: "entrada", label: "Entrada" },
  { tipo: "almoco", label: "Saída p/ almoço" },
  { tipo: "volta", label: "Volta do almoço" },
  { tipo: "saida", label: "Saída" },
];

/** Corpo do POST /checklist/bater-ponto (BaterPontoDto). */
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
  /** PK do registro no servidor (ou o id do item da fila, enquanto pendente). */
  id: string;
  /** O id que o aparelho mandou ao bater (`Idempotency-Key`). */
  legacyId?: string | null;
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
  /** Correção aprovada pelo RH trocou o horário: este é o batido (ISO). */
  horarioAnterior?: string;
}

/** A batida efetiva como `GET /ponto/registros` devolve. */
export interface RegistroDaApi {
  id: string;
  legacyId?: string | null;
  nsr?: number | null;
  hash?: string | null;
  tipo: string;
  timestampOriginal: string;
  operatorNome?: string | null;
  operatorCpf?: string | null;
  registro?: string | null;
  refNsr?: number | null;
  refId?: string | null;
  aplicado?: boolean | null;
  motivo?: string | null;
  motivoReprovacao?: string | null;
  createdAt?: string | null;
  horarioAnterior?: string | null;
}

const TIPOS = new Set<string>(TIPOS_PONTO.map((t) => t.tipo));

/** Traduz a batida do servidor para o formato que as telas usam. Pura. */
export function paraPontoRegistro(
  r: RegistroDaApi,
  prefeituraId: string,
): PontoRegistro {
  const registro =
    r.registro === "ajuste" || r.registro === "cancelamento"
      ? r.registro
      : "original";
  return {
    id: r.id,
    legacyId: r.legacyId ?? null,
    name: r.operatorNome ?? "",
    prefeituraId,
    timestampOriginal: r.timestampOriginal,
    tipo: (TIPOS.has(r.tipo) ? r.tipo : "entrada") as TipoPonto,
    cpf: r.operatorCpf ?? null,
    registro,
    refNsr: r.refNsr ?? null,
    ...(r.nsr != null ? { nsr: r.nsr } : {}),
    ...(r.hash ? { hash: r.hash } : {}),
    ...(r.refId ? { refId: r.refId } : {}),
    ...(r.aplicado != null ? { aplicado: r.aplicado } : {}),
    ...(r.motivo ? { motivo: r.motivo } : {}),
    ...(r.motivoReprovacao ? { motivoReprovacao: r.motivoReprovacao } : {}),
    ...(r.createdAt ? { createdAt: r.createdAt } : {}),
    ...(r.horarioAnterior ? { horarioAnterior: r.horarioAnterior } : {}),
  };
}

/**
 * Quantos meses (o corrente e os anteriores) a folha traz do servidor. É o que
 * o histórico e o espelho alcançam; mês mais antigo é com o RH.
 */
export const MESES_DE_HISTORICO = 6;

/** "YYYY-MM" do mês mais antigo que o app carrega. */
export function mesMaisAntigo(agora: Date, meses = MESES_DE_HISTORICO): string {
  const d = new Date(agora.getFullYear(), agora.getMonth() - (meses - 1), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Uma janela por mês, em instantes ISO, com a virada no fuso do APARELHO (é
 * assim que a rota espera: o aparelho resolve a fronteira do dia local).
 *
 * Um pedido por mês, e não um só para tudo: a rota corta em 500 registros
 * pelos mais antigos, e num período longo quem ficaria de fora são justamente
 * as batidas de hoje.
 */
export function janelasDeMeses(
  agora: Date,
  meses = MESES_DE_HISTORICO,
): { de: string; ate: string }[] {
  const janelas: { de: string; ate: string }[] = [];
  for (let i = 0; i < meses; i += 1) {
    const de = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const ate = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
    janelas.push({ de: de.toISOString(), ate: ate.toISOString() });
  }
  return janelas;
}

interface RespostaLista {
  data: RegistroDaApi[] | null;
  message?: string;
}

export const pontoApi = {
  /**
   * As batidas efetivas da PESSOA LOGADA nos últimos meses. A identidade vem do
   * token: a rota não aceita CPF, então o aparelho recebe só o próprio ponto.
   */
  async listar(prefeituraId: string, agora = new Date()): Promise<PontoRegistro[]> {
    const respostas = await Promise.all(
      janelasDeMeses(agora).map(({ de, ate }) =>
        api.get<RespostaLista>(
          `/ponto/registros?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`,
        ),
      ),
    );
    const porId = new Map<string, PontoRegistro>();
    for (const r of respostas) {
      for (const linha of r.data ?? []) {
        porId.set(linha.id, paraPontoRegistro(linha, prefeituraId));
      }
    }
    return [...porId.values()].sort((a, b) =>
      a.timestampOriginal.localeCompare(b.timestampOriginal),
    );
  },

  /**
   * Pede a correção do horário de uma batida. Vira uma solicitação
   * (`tipo: "corrigir"`) para o RH aprovar — a batida original não muda, e até
   * a aprovação vale o horário batido. Offline-first: passa pelo outbox, então
   * funciona sem rede e sobe sozinho.
   */
  async editarHorario(
    batidaId: string,
    timestampOriginal: string,
    motivo?: string,
  ): Promise<SubmitResult> {
    const user = getSessionUser();
    if (!user) throw new Error("Sessão encerrada. Entre de novo para pedir a correção.");
    return submit("solicitacao", {
      tipo: "corrigir",
      prefeituraId: user.prefeituraId,
      name: user.nome,
      ...(user.cpf ? { cpf: user.cpf } : {}),
      batidaId,
      timestampOriginal,
      ...(motivo?.trim() ? { observacao: motivo.trim() } : {}),
    });
  },
};
