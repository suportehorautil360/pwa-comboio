/**
 * Outbox offline-first: os lançamentos do comboista (abastecimento, engraxe,
 * reabastecimento) são gravados no IndexedDB e sincronizados com o NestJS em
 * background — ao montar, quando a rede volta e num intervalo. Sem dependência
 * externa (IndexedDB puro).
 */
import { api, ApiError } from "../api/client";

export type OutboxKind =
  | "abastecimento"
  | "lubrificacao"
  | "reabastecimento"
  | "ponto";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  payload: unknown;
  createdAt: number;
  attempts: number;
  /**
   * Chave de idempotência enviada no header `Idempotency-Key`. Estável entre
   * reenvios — o backend descarta a duplicata e devolve a resposta gravada.
   * Opcional para tolerar itens enfileirados antes desta versão.
   */
  idempotencyKey?: string;
  /** true quando o servidor rejeitou (4xx) — não adianta reenviar sozinho. */
  failed?: boolean;
}

/** Resultado de {@link submit}: se sincronizou na hora ou ficou na fila. */
export interface SubmitResult {
  synced: boolean;
}

export interface OutboxCounts {
  pendentes: number;
  falhos: number;
}

/** Linha exibível de um item da fila (pendente/erro) p/ dashboard e histórico. */
export interface LancamentoPendente {
  id: string;
  kind: OutboxKind;
  code: string;
  description: string;
  value: string;
  status: "pendente" | "erro";
}

const PATHS: Record<OutboxKind, string> = {
  abastecimento: "/abastecimentos",
  lubrificacao: "/lubrificacoes",
  reabastecimento: "/reabastecimentos",
  ponto: "/time-records",
};

const DB_NAME = "hu360-comboio";
const STORE = "outbox";

// ---------- IndexedDB (wrapper mínimo) ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

async function listAll(): Promise<OutboxItem[]> {
  const all = await run<OutboxItem[]>("readonly", (s) => s.getAll());
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

// ---------- Pub/sub (para a UI) ----------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const l of listeners) l();
}

// ---------- API pública ----------

export async function enqueue(
  kind: OutboxKind,
  payload: unknown,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<void> {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    idempotencyKey,
  };
  await run("readwrite", (s) => s.add(item));
  notify();
}

/**
 * Registra um lançamento de frota: tenta enviar direto quando há sinal e só
 * cai no outbox se faltar conexão ou o servidor estiver fora. Idempotente — a
 * mesma chave acompanha o registro no envio direto e nos reenvios da fila, então
 * nunca duplica. Use no lugar de `enqueue + flushOutbox` quando a tela precisa
 * saber se sincronizou agora (mensagem precisa, não "salvo quando der sinal").
 *
 * - online + 2xx → `{ synced: true }` (nada vai para a fila)
 * - 4xx (validação/sessão/saldo) → lança `ApiError` (a tela mostra o erro)
 * - 409 "processando" (idempotência transitória), 5xx, rede ou offline →
 *   enfileira e devolve `{ synced: false }` (sincroniza sozinho depois)
 */
export async function submit(
  kind: OutboxKind,
  payload: unknown,
): Promise<SubmitResult> {
  const idempotencyKey = crypto.randomUUID();
  const online = typeof navigator === "undefined" || navigator.onLine;

  if (online) {
    try {
      await api.post(PATHS[kind], payload, { idempotencyKey });
      return { synced: true };
    } catch (e) {
      const definitivo =
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 409;
      // Rejeição definitiva (ex.: saldo insuficiente, sessão): não enfileira —
      // reenviar daria o mesmo erro. A tela mostra a mensagem.
      if (definitivo) throw e;
      // 409 transitório, 5xx ou falha de rede: salva offline e segue.
    }
  }

  await enqueue(kind, payload, idempotencyKey);
  return { synced: false };
}

export async function getCounts(): Promise<OutboxCounts> {
  const all = await listAll();
  return {
    pendentes: all.filter((i) => !i.failed).length,
    falhos: all.filter((i) => i.failed).length,
  };
}

/** Itens da fila, mais recentes primeiro. */
export async function listItems(): Promise<OutboxItem[]> {
  return (await listAll()).reverse();
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Mapeia um item da fila para uma linha exibível. */
export function itemParaLancamento(item: OutboxItem): LancamentoPendente {
  const p = asRecord(item.payload);
  const status: LancamentoPendente["status"] = item.failed ? "erro" : "pendente";

  if (item.kind === "lubrificacao") {
    const pontos = Array.isArray(p.greasedPoints) ? p.greasedPoints.length : 0;
    return {
      id: item.id,
      kind: item.kind,
      code: str(p.plateOrChassis) || "—",
      description: `${pontos} ponto${pontos !== 1 ? "s" : ""}`,
      value: "engraxe",
      status,
    };
  }
  if (item.kind === "ponto") {
    return {
      id: item.id,
      kind: item.kind,
      code: str(p.tipo) || "ponto",
      description: "Batida de ponto",
      value: "ponto",
      status,
    };
  }
  if (item.kind === "reabastecimento") {
    return {
      id: item.id,
      kind: item.kind,
      code: "Comboio",
      description: "Reabastecimento",
      value: `${num(p.receivedLiters)} L`,
      status,
    };
  }
  return {
    id: item.id,
    kind: item.kind,
    code: str(p.plateOrChassis) || "—",
    description: "Abastecimento",
    value: `${num(p.liters)} L`,
    status,
  };
}

let sincronizando = false;

/** Tenta enviar os itens pendentes ao back. Best-effort, não lança. */
export async function flushOutbox(): Promise<void> {
  if (sincronizando) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  sincronizando = true;
  try {
    const pendentes = (await listAll()).filter((i) => !i.failed);
    for (const item of pendentes) {
      try {
        await api.post(PATHS[item.kind], item.payload, {
          idempotencyKey: item.idempotencyKey,
        });
        await run("readwrite", (s) => s.delete(item.id));
        notify();
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
          // Rejeição do servidor (validação/sessão): marca como falho e segue.
          await run("readwrite", (s) =>
            s.put({ ...item, attempts: item.attempts + 1, failed: true }),
          );
          notify();
          continue;
        }
        // Rede ou erro do servidor (5xx): para e tenta de novo depois.
        break;
      }
    }
  } finally {
    sincronizando = false;
  }
}
