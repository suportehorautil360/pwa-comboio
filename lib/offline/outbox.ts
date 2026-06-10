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
  /** true quando o servidor rejeitou (4xx) — não adianta reenviar sozinho. */
  failed?: boolean;
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
): Promise<void> {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  await run("readwrite", (s) => s.add(item));
  notify();
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
        await api.post(PATHS[item.kind], item.payload);
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
