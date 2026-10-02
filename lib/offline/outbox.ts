/**
 * Outbox offline-first: os lançamentos do comboista (abastecimento, engraxe,
 * reabastecimento, ponto, ajustes/solicitações de ponto) são gravados no
 * IndexedDB (via Dexie — {@link db}) e sincronizados com o NestJS em background
 * — ao montar, quando a rede volta, num intervalo e via Background Sync.
 *
 * Robustez (Fase 1): backoff exponencial por item (`nextAttemptAt`), teto de
 * tentativas ({@link MAX_ATTEMPTS}) e dead-letter (`failed`) com reprocesso/descarte
 * manual ({@link retryItem}/{@link discardItem}). Idempotência via `Idempotency-Key`
 * estável entre reenvios — o backend descarta a duplicata.
 */
import { api, ApiError } from "../api/client";
import { db, OUTBOX_PATHS, type OutboxItem, type OutboxKind } from "../db";
import { guardarBatidaEnviada } from "../ponto/cache-batidas";
import { getSessionUser } from "../session";
import { migrarFila, precisaMigrar } from "./migrar-rotas";

export type { OutboxItem, OutboxKind } from "../db";

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

/** Opções de enfileiramento (path dinâmico, método, chave de idempotência). */
export interface EnqueueOptions {
  /** Path explícito — obrigatório p/ kinds dinâmicos (ex.: editar-ponto). */
  path?: string;
  method?: "POST" | "PATCH";
  idempotencyKey?: string;
}

// ---------- Backoff ----------

/** Teto de tentativas antes de mandar o item para o dead-letter. */
export const MAX_ATTEMPTS = 8;
const BASE_DELAY = 5_000; // 5s
const MAX_DELAY = 300_000; // 5min

/** Atraso (ms) da próxima tentativa: exponencial com teto e jitter ±20%. */
export function backoffDelay(attempts: number): number {
  const exp = Math.min(BASE_DELAY * 2 ** (attempts - 1), MAX_DELAY);
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.round(exp * jitter);
}

/** Espera depois de um 429 (limite de requisições): a janela do back é de 1 min. */
const ESPERA_LIMITE_DE_TAXA = 60_000;

/**
 * Rejeição definitiva do servidor: reenviar daria o mesmo erro. 409 (ainda
 * processando), 408 e 429 (limite de requisições) são transitórios — o 429
 * importa no ponto: a rota de batida aceita 10 por minuto, e uma fila com mais
 * batidas que isso (dias sem sinal) não pode mandar o excedente para os erros.
 */
export function ehRejeicaoDefinitiva(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 408 &&
    e.status !== 409 &&
    e.status !== 429
  );
}

// ---------- Helpers ----------

function resolvePath(kind: OutboxKind, override?: string): string {
  const path = override ?? OUTBOX_PATHS[kind];
  if (!path) {
    throw new Error(`outbox: path obrigatório para o kind "${kind}"`);
  }
  return path;
}

/** Itens ordenados por chegada (FIFO). */
function listAll(): Promise<OutboxItem[]> {
  return db.outbox.orderBy("createdAt").toArray();
}

// ---------- Pub/sub (para a UI) ----------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

// ---------- API pública ----------

export async function enqueue(
  kind: OutboxKind,
  payload: unknown,
  opts?: EnqueueOptions,
): Promise<void> {
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    kind,
    path: resolvePath(kind, opts?.path),
    method: opts?.method ?? "POST",
    payload,
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    idempotencyKey: opts?.idempotencyKey ?? crypto.randomUUID(),
  };
  await db.outbox.add(item);
  notify();
  void requestBackgroundSync();
}

/**
 * Registra uma escrita: tenta enviar direto quando há sinal e só cai no outbox
 * se faltar conexão ou o servidor estiver fora. Idempotente — a mesma chave
 * acompanha o registro no envio direto e nos reenvios da fila, então nunca
 * duplica. Use no lugar de `enqueue + flushOutbox` quando a tela precisa saber
 * se sincronizou agora (mensagem precisa, não "salvo quando der sinal").
 *
 * - online + 2xx → `{ synced: true }` (nada vai para a fila)
 * - 4xx (validação/sessão/saldo, ≠408/409/429) → lança `ApiError` (a tela mostra o erro)
 * - 409 "processando", 429, 5xx, rede ou offline → enfileira e devolve `{ synced: false }`
 */
export async function submit(
  kind: OutboxKind,
  payload: unknown,
  opts?: Pick<EnqueueOptions, "path" | "method">,
): Promise<SubmitResult> {
  const path = resolvePath(kind, opts?.path);
  const method = opts?.method ?? "POST";
  const idempotencyKey = crypto.randomUUID();
  const online = typeof navigator === "undefined" || navigator.onLine;

  if (online) {
    try {
      const resposta = await sendItem({ path, method, payload, idempotencyKey });
      await aoEnviar(kind, resposta);
      return { synced: true };
    } catch (e) {
      // Rejeição definitiva (ex.: saldo insuficiente, sessão): não enfileira —
      // reenviar daria o mesmo erro. A tela mostra a mensagem.
      if (ehRejeicaoDefinitiva(e)) throw e;
      // 409/429 transitório, 5xx ou falha de rede: salva offline e segue.
    }
  }

  await enqueue(kind, payload, { ...opts, idempotencyKey });
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

/**
 * Volta um item do dead-letter para pendente e elegível imediatamente. Não
 * dispara o envio — quem reprocessa na UI chama `flushOutbox()` em seguida (ou
 * o agendador o pega no próximo tick/online).
 */
export async function retryItem(id: string): Promise<void> {
  await db.outbox.update(id, {
    failed: false,
    attempts: 0,
    nextAttemptAt: 0,
    lastError: undefined,
  });
  notify();
}

/** Descarta de vez um item da fila (ex.: erro definitivo que não cabe reenviar). */
export async function discardItem(id: string): Promise<void> {
  await db.outbox.delete(id);
  notify();
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
  if (item.kind === "ponto" || item.kind === "editar-ponto") {
    return {
      id: item.id,
      kind: item.kind,
      code: str(p.tipo) || "ponto",
      description:
        item.kind === "editar-ponto" ? "Ajuste de ponto" : "Batida de ponto",
      value: "ponto",
      status,
    };
  }
  if (item.kind === "solicitacao") {
    return {
      id: item.id,
      kind: item.kind,
      code: str(p.tipo) || "solicitação",
      description: "Solicitação de ponto",
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

// ---------- Sincronização ----------

function sendItem(item: {
  path: string;
  method: "POST" | "PATCH";
  payload: unknown;
  idempotencyKey?: string;
}): Promise<unknown> {
  const opts = { idempotencyKey: item.idempotencyKey };
  return item.method === "PATCH"
    ? api.patch(item.path, item.payload, opts)
    : api.post(item.path, item.payload, opts);
}

/** O que fazer com a resposta de um envio que deu certo. Nunca derruba o envio. */
async function aoEnviar(kind: OutboxKind, resposta: unknown): Promise<void> {
  if (kind !== "ponto") return;
  try {
    await guardarBatidaEnviada(resposta);
  } catch {
    /* a folha se acerta na próxima leitura do servidor */
  }
}

/**
 * Reescreve os itens que apontam para rotas removidas do back (o ponto antigo,
 * `/time-records`) para as de hoje — ver {@link migrarFila}. Barato quando não
 * há o que migrar, e é o caso normal.
 */
export async function migrarRotasAntigas(): Promise<number> {
  const todos = await listAll();
  if (!todos.some(precisaMigrar)) return 0;
  const u = getSessionUser();
  const mudados = migrarFila(
    todos,
    u ? { prefeituraId: u.prefeituraId, nome: u.nome, cpf: u.cpf } : null,
  );
  if (mudados.length === 0) return 0;
  await db.outbox.bulkPut(mudados);
  notify();
  return mudados.length;
}

let sincronizando = false;

/**
 * Tenta enviar os itens pendentes ao back. Best-effort, não lança.
 * - 2xx → remove da fila.
 * - 4xx (≠408/409/429) → dead-letter (`failed`), segue para o próximo.
 * - 429 → espera 1 min sem gastar tentativa e para o lote.
 * - 5xx/408/409/rede → incrementa tentativa e agenda backoff; estoura
 *   MAX_ATTEMPTS vira dead-letter. Para o lote (rede provavelmente caiu).
 *
 * Antes de enviar, migra os itens gravados para rotas que o back removeu.
 */
export async function flushOutbox(): Promise<void> {
  if (sincronizando) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  sincronizando = true;
  try {
    await migrarRotasAntigas();
    const agora = Date.now();
    const elegiveis = (await listAll()).filter(
      (i) => !i.failed && i.nextAttemptAt <= agora,
    );
    for (const item of elegiveis) {
      try {
        const resposta = await sendItem(item);
        // A folha recebe a batida ANTES de ela sair da fila: sem intervalo em
        // que a linha do dia apareça como "Sem registro".
        await aoEnviar(item.kind, resposta);
        await db.outbox.delete(item.id);
        notify();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "erro de envio";
        if (e instanceof ApiError && e.status === 429) {
          // Limite de requisições: não é falha do item e não gasta tentativa.
          // Espera a janela do servidor e para o lote.
          await db.outbox.update(item.id, {
            nextAttemptAt: Date.now() + ESPERA_LIMITE_DE_TAXA,
            lastError: msg,
          });
          notify();
          break;
        }
        if (ehRejeicaoDefinitiva(e)) {
          // Rejeição do servidor (validação/sessão): dead-letter e segue.
          await db.outbox.update(item.id, {
            failed: true,
            attempts: item.attempts + 1,
            lastError: msg,
          });
          notify();
          continue;
        }
        const attempts = item.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await db.outbox.update(item.id, {
            failed: true,
            attempts,
            lastError: msg,
          });
          notify();
          continue;
        }
        // Rede/5xx/409 transitório: agenda nova tentativa e para o lote.
        await db.outbox.update(item.id, {
          attempts,
          nextAttemptAt: Date.now() + backoffDelay(attempts),
          lastError: msg,
        });
        notify();
        break;
      }
    }
  } finally {
    sincronizando = false;
  }
}

/** Acorda o Service Worker p/ esvaziar a fila quando a rede voltar (app fechado). */
async function requestBackgroundSync(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    // sync nem sempre tipado no lib.dom
    await (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync?.register("flush-outbox");
  } catch {
    /* sem suporte a Background Sync: cai no tick/online */
  }
}
