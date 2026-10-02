/**
 * Cache de leitura (read-through) sobre a tabela `cache` do Dexie. As consultas
 * ao NestJS gravam aqui o último resultado conhecido, e as telas lêem daqui
 * primeiro (offline-first) enquanto revalidam em background — ver {@link useCached}.
 */
import { db } from "../db";
import { PREFIXOS_ANTIGOS } from "./cache-keys";

// --- Pub/sub: avisa quem está montado quando uma chave é regravada (ex.: o
// syncAll atualizou o cache em background). Sem isso, a tela montada não re-lê
// o cache novo e fica mostrando o dado velho. ---
type CacheListener = (key: string) => void;
const listeners = new Set<CacheListener>();

export function subscribeCache(listener: CacheListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(key: string): void {
  for (const l of listeners) l(key);
}

/** Lê o dado cacheado de uma chave; undefined quando nunca foi gravado. */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const row = await db.cache.get(key);
  return row?.data as T | undefined;
}

/** Grava (ou sobrescreve) o dado de uma chave, carimbando o instante. */
export async function cachePut<T>(key: string, data: T): Promise<void> {
  await db.cache.put({ key, data, cachedAt: Date.now() });
  notify(key);
}

/** Instante (epoch ms) em que a chave foi cacheada; undefined se não existe. */
export async function cacheAge(key: string): Promise<number | undefined> {
  return (await db.cache.get(key))?.cachedAt;
}

/** Lê dado + instante numa transação só (usado pela revalidação com TTL). */
export async function cacheEntry<T>(
  key: string,
): Promise<{ data: T; cachedAt: number } | undefined> {
  const row = await db.cache.get(key);
  return row ? { data: row.data as T, cachedAt: row.cachedAt } : undefined;
}

/** true quando o cache está vencido (ou não existe) para o TTL informado. */
export function isStale(cachedAt: number | undefined, ttl: number): boolean {
  return cachedAt === undefined || Date.now() - cachedAt > ttl;
}

/**
 * Troca o dado de uma chave SEM mexer no carimbo de tempo: o cache continua
 * tão velho quanto era, e a próxima revalidação acontece no prazo de sempre.
 * Para emendas locais (ex.: a batida que acabou de subir) — não é resposta do
 * servidor e não pode fazer o cache parecer fresco.
 */
export async function cachePatch<T>(
  key: string,
  mudar: (atual: T | undefined) => T | undefined,
): Promise<void> {
  const row = await db.cache.get(key);
  const novo = mudar(row?.data as T | undefined);
  if (novo === undefined) return;
  await db.cache.put({ key, data: novo, cachedAt: row?.cachedAt ?? 0 });
  notify(key);
}

/** Apaga do aparelho os caches de chaves que o app não usa mais. */
export async function limparCachesAntigos(): Promise<void> {
  for (const prefixo of PREFIXOS_ANTIGOS) {
    await db.cache.where("key").startsWith(prefixo).delete();
  }
}
