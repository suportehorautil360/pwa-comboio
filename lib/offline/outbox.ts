/**
 * Outbox offline-first: os lançamentos do comboista (abastecimento, engraxe,
 * reabastecimento) são gravados no IndexedDB e sincronizados com o NestJS em
 * background — ao montar, quando a rede volta e num intervalo. Sem dependência
 * externa (IndexedDB puro).
 */
import { api, ApiError } from "../api/client";

export type OutboxKind = "abastecimento" | "lubrificacao" | "reabastecimento";

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

const PATHS: Record<OutboxKind, string> = {
  abastecimento: "/abastecimentos",
  lubrificacao: "/lubrificacoes",
  reabastecimento: "/reabastecimentos",
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
