/**
 * Banco local (IndexedDB via Dexie) do app do comboista — `hu360-comboio`.
 *
 * Fase 0/1 (offline-first): a fila de escrita (`outbox`) migra do IndexedDB puro
 * (legado v1, store sem índices) para este schema v2, com path/method por evento
 * e agendamento de retry (`nextAttemptAt`). A tabela `meta` guarda cursores de
 * sincronização (ex.: `lastSyncedAt:<entidade>`) — usada nas fases de leitura.
 *
 * As tabelas de cache de leitura (equipamentos, time-records, etc.) entram numa
 * versão futura (v3) — ver docs/OFFLINE_FIRST_SPEC.md.
 */
import Dexie, { type Table } from "dexie";

/** Tipos de evento de escrita enfileirável. */
export type OutboxKind =
  | "abastecimento"
  | "lubrificacao"
  | "reabastecimento"
  | "ponto"
  | "editar-ponto"
  | "solicitacao";

/** Um evento de escrita pendente de envio ao NestJS. */
export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  /** Endpoint resolvido (suporta path dinâmico, ex.: /time-records/update/:id). */
  path: string;
  method: "POST" | "PATCH";
  payload: unknown;
  createdAt: number;
  /** Tentativas de envio já feitas (alimenta o backoff). */
  attempts: number;
  /** Epoch ms da próxima tentativa elegível (backoff exponencial). */
  nextAttemptAt: number;
  /** Chave de idempotência estável entre reenvios (header Idempotency-Key). */
  idempotencyKey?: string;
  /** true = rejeitado em definitivo (4xx ou estouro de tentativas) → dead-letter. */
  failed?: boolean;
  /** Última mensagem de erro (exibida na UI de erros de sincronização). */
  lastError?: string;
}

/** Linha genérica de metadados (cursores de sync, flags internas). */
export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Paths estáticos por kind. `editar-ponto` é `null` porque o endpoint carrega o
 * id da batida (`/time-records/update/:id`) — o path é resolvido no enqueue.
 */
export const OUTBOX_PATHS: Record<OutboxKind, string | null> = {
  abastecimento: "/abastecimentos",
  lubrificacao: "/lubrificacoes",
  reabastecimento: "/reabastecimentos",
  ponto: "/time-records",
  solicitacao: "/solicitacoes-ponto",
  "editar-ponto": null,
};

/** Formato do item no outbox legado (v1, IndexedDB puro). */
interface LegacyOutboxItem {
  id: string;
  kind: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  idempotencyKey?: string;
  failed?: boolean;
}

/**
 * Converte um item do outbox legado (v1) para o evento v2: deriva path/method do
 * kind, zera o `nextAttemptAt` (elegível já) e preserva idempotência/estado.
 * Função pura — testável sem o banco.
 */
export function legacyToEvent(it: LegacyOutboxItem): OutboxItem {
  const kind = (it.kind as OutboxKind) ?? "abastecimento";
  return {
    id: it.id,
    kind,
    path: OUTBOX_PATHS[kind] ?? "/abastecimentos",
    method: "POST",
    payload: it.payload,
    createdAt: it.createdAt ?? 0,
    attempts: it.attempts ?? 0,
    nextAttemptAt: 0,
    idempotencyKey: it.idempotencyKey,
    failed: it.failed,
  };
}

class HU360Db extends Dexie {
  outbox!: Table<OutboxItem, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("hu360-comboio");
    // v1 — store legado criado pelo IndexedDB puro (keyPath "id", sem índices).
    this.version(1).stores({ outbox: "id" });
    // v2 — índices p/ a fila + tabela meta; migra itens legados ao novo formato.
    // (não indexamos `failed`: boolean não é chave válida no IndexedDB.)
    this.version(2)
      .stores({ outbox: "id, createdAt", meta: "key" })
      .upgrade(async (tx) => {
        const itens = (await tx
          .table("outbox")
          .toArray()) as LegacyOutboxItem[];
        await Promise.all(
          itens.map((it) => tx.table("outbox").put(legacyToEvent(it))),
        );
      });
  }
}

export const db = new HU360Db();
